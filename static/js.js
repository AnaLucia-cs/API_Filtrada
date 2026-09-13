
let condicionSeleccionada = null;

// =========================================================
// PEDIDOS ACTIVOS Y ESTADO DEL CONDUCTOR
// =========================================================

const pedidosActivos = new Set();

let marcadorOrigen = null;
let ubicacionRepartidor = null;

let pedidosCargados = false;
let cargandoPedidos = false;

let pedidoEnCurso = null;
let fasePedido = "hacia_recogida";

// =========================================================
// ELEMENTOS DE CONDICIONES
// =========================================================

const botonesCondicion = document.querySelectorAll(".condicion");

botonesCondicion.forEach(boton => {

    boton.addEventListener("click", evento => {

        evento.stopPropagation();

        const tipo = boton.dataset.tipo;
        const emoji = boton.dataset.emoji;

        if (
            condicionSeleccionada &&
            condicionSeleccionada.tipo === tipo
        ) {
            condicionSeleccionada = null;
            boton.classList.remove("condicion-seleccionada");
            console.log("Condición desactivada:", tipo);
            return;
        }

        botonesCondicion.forEach(otroBoton => {
            otroBoton.classList.remove("condicion-seleccionada");
        });

        condicionSeleccionada = {
            tipo,
            emoji,
            boton
        };

        boton.classList.add("condicion-seleccionada");

        console.log("Condición seleccionada:", condicionSeleccionada);
    });
});


// =========================================================
// CREAR MAPA DE MONTERREY
// =========================================================

const map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [-100.3161, 25.6866],
    zoom: 12
});


// =========================================================
// DISTANCIA HAVERSINE
// =========================================================
// Devuelve kilómetros entre dos puntos GPS.
// Las coordenadas se reciben como:
// [lng, lat]

function distanciaHaversine(origen, destino) {

    const R = 6371;

    const lng1 = origen[0] * Math.PI / 180;
    const lat1 = origen[1] * Math.PI / 180;

    const lng2 = destino[0] * Math.PI / 180;
    const lat2 = destino[1] * Math.PI / 180;

    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;

    const a =
        Math.sin(dLat / 2) ** 2
        +
        Math.cos(lat1)
        * Math.cos(lat2)
        * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return R * c;
}


// =========================================================
// COLOR SEGÚN POSICIÓN
// =========================================================
// Más arriba = verde.
// Más abajo = rojo.

function obtenerColorDistancia(indice, total) {

    if (total <= 1) {
        return "#28a745";
    }

    const porcentaje = indice / (total - 1);

    const rojo = Math.round(40 + 180 * porcentaje);
    const verde = Math.round(167 - 130 * porcentaje);
    const azul = Math.round(69 - 30 * porcentaje);

    return `rgb(${rojo}, ${verde}, ${azul})`;
}


// =========================================================
// LIMPIAR PEDIDOS
// =========================================================

function limpiarPedidos() {

    pedidosActivos.forEach(pedido => {

        if (pedido.timer) {
            clearInterval(pedido.timer);
            pedido.timer = null;
        }

        if (pedido.marcadorRecogida) {
            pedido.marcadorRecogida.remove();
            pedido.marcadorRecogida = null;
        }

        if (pedido.marcadorDestino) {
            pedido.marcadorDestino.remove();
            pedido.marcadorDestino = null;
        }

        if (pedido.mensaje) {
            pedido.mensaje.remove();
            pedido.mensaje = null;
        }
    });

    pedidosActivos.clear();

    const contenedor = document.getElementById("display-message");

    if (contenedor) {
        contenedor.innerHTML = "";
    }
}


// =========================================================
// CARGAR PEDIDOS DESDE FLASK
// =========================================================
// IMPORTANTE:
// Esta función solamente se llama después de seleccionar
// al conductor.

async function cargarPedidosEnMapa() {

    if (!ubicacionRepartidor) {
        console.warn(
            "No se cargan pedidos: falta ubicación del conductor."
        );
        return;
    }

    if (pedidosCargados || cargandoPedidos) {
        return;
    }

    cargandoPedidos = true;

    try {

        const respuesta = await fetch("/api/pedidos");

        if (!respuesta.ok) {

            if (respuesta.status === 403) {
                throw new Error(
                    "Flask requiere primero la ubicación del conductor."
                );
            }

            throw new Error(
                `Error HTTP ${respuesta.status}`
            );
        }

        const datos = await respuesta.json();

        if (!datos.ok) {
            throw new Error(
                datos.error || "No se pudieron cargar los pedidos."
            );
        }

        const pedidos = datos.pedidos || [];

        // No se crean tarjetas ni marcadores antes de ordenar.
        const pedidosOrdenados = pedidos
            .map(pedido => {

                const recogida = [
                    Number(pedido.pickupLon),
                    Number(pedido.pickupLat)
                ];

                const distancia = distanciaHaversine(
                    ubicacionRepartidor,
                    recogida
                );

                return {
                    ...pedido,
                    distanciaConductorKm: distancia
                };
            })
            .sort((a, b) => {
                return (
                    a.distanciaConductorKm
                    - b.distanciaConductorKm
                );
            });

        limpiarPedidos();

        pedidosOrdenados.forEach((pedido, indice) => {

            const color = obtenerColorDistancia(
                indice,
                pedidosOrdenados.length
            );

            crearPedido({
                id: pedido.id,
                prioridad: color,
                tiempo: 30,
                titulo: `Pedido ${pedido.id}`,
                detalles: (
                    `${pedido.explicacion || "Recoger paquete y entregar."} `
                    + `- Tarifa: $${pedido.tarifa} MXN`
                ),
                tarifa: pedido.tarifa,
                recogidaLat: pedido.pickupLat,
                recogidaLng: pedido.pickupLon,
                destinoLat: pedido.dropoffLat,
                destinoLng: pedido.dropoffLon,
                distanciaConductorKm: pedido.distanciaConductorKm,
                posicion: indice + 1
            });
        });

        pedidosCargados = true;

        console.log(
            "Pedidos cargados y ordenados por distancia:",
            pedidosOrdenados
        );

    } catch (error) {

        console.error(
            "Error al cargar pedidos:",
            error
        );

    } finally {

        cargandoPedidos = false;
    }
}


// =========================================================
// MAPA CARGADO
// =========================================================
// Aquí NO se cargan los pedidos automáticamente.

map.on("load", () => {

    console.log("Mapa cargado correctamente.");

    // Los pedidos esperan al clic del conductor.
});


// =========================================================
// CLICK EN MAPA
// =========================================================
// Si hay condición seleccionada, coloca condición.
// Si no, coloca/mueve al conductor.

map.on("click", async function (e) {

    const lon = e.lngLat.lng;
    const lat = e.lngLat.lat;

    if (condicionSeleccionada) {

        await colocarCondicion(
            lat,
            lon,
            condicionSeleccionada
        );

        return;
    }

    const url =
        `https://router.project-osrm.org/nearest/v1/driving/`
        + `${lon},${lat}`;

    try {

        const respuesta = await fetch(url);
        const datos = await respuesta.json();

        if (
            datos.code !== "Ok"
            || !datos.waypoints
            || datos.waypoints.length === 0
        ) {
            console.error("No se encontró una calle cercana.");
            return;
        }

        const nuevoOrigen = datos.waypoints[0].location;

        const primeraUbicacion =
            ubicacionRepartidor === null;

        ubicacionRepartidor = nuevoOrigen;

        // Crear o mover marcador del conductor.
        if (marcadorOrigen !== null) {

            marcadorOrigen.setLngLat(nuevoOrigen);

        } else {

            const elRepartidor = document.createElement("div");

            elRepartidor.textContent = "🏍️";
            elRepartidor.style.fontSize = "32px";
            elRepartidor.style.cursor = "pointer";
            elRepartidor.style.userSelect = "none";

            marcadorOrigen = new maplibregl.Marker({
                element: elRepartidor,
                anchor: "center"
            })
                .setLngLat(nuevoOrigen)
                .addTo(map);
        }

        console.log(
            "Conductor seleccionado:",
            ubicacionRepartidor
        );

        // Enviar ubicación a Flask.
        const respuestaFlask = await fetch(
            "/api/conductor/ubicacion",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    lat: nuevoOrigen[1],
                    lng: nuevoOrigen[0]
                })
            }
        );

        if (!respuestaFlask.ok) {
            throw new Error(
                "Flask no aceptó la ubicación del conductor."
            );
        }

        const resultadoFlask = await respuestaFlask.json();

        if (!resultadoFlask.ok) {
            throw new Error(
                resultadoFlask.error || "Error guardando ubicación."
            );
        }

        // PRIMER CLIC:
        // cargar pedidos y calcular distancias.
        if (primeraUbicacion) {

            await cargarPedidosEnMapa();

        } else {

            // Si el conductor se mueve y no hay pedido activo,
            // volvemos a ordenar las tarjetas.
            if (!pedidoEnCurso) {

                pedidosCargados = false;

                await cargarPedidosEnMapa();
            }
        }

        // Si hay pedido activo, actualizar la ruta.
        if (pedidoEnCurso) {

            const idRutaActiva =
                fasePedido === "hacia_recogida"
                    ? "ruta-trayecto-1"
                    : "ruta-trayecto-2";

            const destinoFase =
                fasePedido === "hacia_recogida"
                    ? [
                        pedidoEnCurso.recogidaLng,
                        pedidoEnCurso.recogidaLat
                    ]
                    : [
                        pedidoEnCurso.destinoLng,
                        pedidoEnCurso.destinoLat
                    ];

            await calcularRuta(
                ubicacionRepartidor,
                destinoFase,
                idRutaActiva
            );
        }

    } catch (error) {

        console.error(
            "Error al seleccionar conductor:",
            error
        );
    }
});


// =========================================================
// COLOCAR CONDICIÓN
// =========================================================

async function colocarCondicion(lat, lon, condicion) {

    const url =
        `https://router.project-osrm.org/nearest/v1/driving/`
        + `${lon},${lat}`;

    try {

        const respuesta = await fetch(url);

        if (!respuesta.ok) {
            throw new Error(
                "OSRM no respondió correctamente."
            );
        }

        const datos = await respuesta.json();

        if (
            datos.code !== "Ok"
            || !datos.waypoints
            || datos.waypoints.length === 0
        ) {
            throw new Error(
                "No se encontró una calle cercana."
            );
        }

        const [lngCalle, latCalle] =
            datos.waypoints[0].location;

        const elemento = document.createElement("div");

        elemento.textContent = condicion.emoji;
        elemento.style.fontSize = "32px";
        elemento.style.cursor = "pointer";
        elemento.style.userSelect = "none";

        const marcador = new maplibregl.Marker({
            element: elemento,
            anchor: "bottom"
        })
            .setLngLat([lngCalle, latCalle])
            .addTo(map);

        try {

            const respuestaFlask = await fetch(
                "/api/condicion",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        tipo: condicion.tipo,
                        emoji: condicion.emoji,
                        lat: latCalle,
                        lng: lngCalle
                    })
                }
            );

            if (respuestaFlask.ok) {

                const resultado = await respuestaFlask.json();

                if (resultado.calle) {
                    elemento.title = resultado.calle;
                }
            }

        } catch (apiError) {

            console.warn(
                "Backend /api/condicion no disponible:",
                apiError
            );
        }

        condicionSeleccionada = null;

        botonesCondicion.forEach(boton => {
            boton.classList.remove("condicion-seleccionada");
        });

        if (pedidoEnCurso && ubicacionRepartidor) {

            await evaluarYRecalcularRutas(
                lngCalle,
                latCalle
            );
        }

    } catch (error) {

        console.error(
            "Error colocando condición:",
            error
        );
    }
}


// =========================================================
// CREAR MARCADOR CON EMOJI + NÚMERO
// =========================================================

function crearMarcadorEmoji(
    emoji,
    numero,
    coordenadas,
    anchor = "bottom"
) {

    const elemento = document.createElement("div");

    elemento.style.display = "flex";
    elemento.style.flexDirection = "column";
    elemento.style.alignItems = "center";
    elemento.style.cursor = "pointer";
    elemento.style.userSelect = "none";

    const icono = document.createElement("div");

    icono.textContent = emoji;
    icono.style.fontSize = "32px";
    icono.style.lineHeight = "1";

    const numeroElemento = document.createElement("div");

    numeroElemento.textContent = `#${numero}`;
    numeroElemento.style.backgroundColor = "#ffffff";
    numeroElemento.style.color = "#222222";
    numeroElemento.style.fontSize = "12px";
    numeroElemento.style.fontWeight = "bold";
    numeroElemento.style.padding = "2px 6px";
    numeroElemento.style.borderRadius = "8px";
    numeroElemento.style.boxShadow =
        "0 1px 5px rgba(0,0,0,0.35)";
    numeroElemento.style.marginTop = "2px";
    numeroElemento.style.whiteSpace = "nowrap";

    elemento.appendChild(icono);
    elemento.appendChild(numeroElemento);

    return new maplibregl.Marker({
        element: elemento,
        anchor
    })
        .setLngLat(coordenadas)
        .addTo(map);
}


// =========================================================
// CREAR PEDIDO
// =========================================================

function crearPedido({
    id = null,
    prioridad = "#9783f0",
    tiempo = 30,
    titulo = "Pedido",
    detalles = "",
    tarifa = 50.0,
    recogidaLat,
    recogidaLng,
    destinoLat,
    destinoLng,
    distanciaConductorKm = null,
    posicion = null
}) {

    // PROTECCIÓN PRINCIPAL:
    // Nunca crear tarjetas sin conductor.
    if (!ubicacionRepartidor) {

        console.warn(
            "Se intentó crear un pedido sin conductor."
        );

        return null;
    }

    const contenedor =
        document.getElementById("display-message");

    if (!contenedor) {

        console.error(
            "No se encontró #display-message."
        );

        return null;
    }

    const mensaje = document.createElement("div");
    mensaje.classList.add("mensaje");

    const time = document.createElement("div");
    time.classList.add("time");

    const indicator = document.createElement("div");
    indicator.classList.add("indicator");
    indicator.style.backgroundColor = prioridad;

    const messageContent = document.createElement("div");
    messageContent.classList.add("message-content");

    const message = document.createElement("div");
    message.classList.add("message");
    message.textContent = titulo;

    const details = document.createElement("div");
    details.classList.add("details");
    details.textContent = detalles;

    const addressRecogida = document.createElement("div");
    addressRecogida.classList.add("address");
    addressRecogida.textContent =
        "📍 Recogida: Buscando dirección...";

    const addressDestino = document.createElement("div");
    addressDestino.classList.add("address");
    addressDestino.textContent =
        "🏁 Destino: Buscando dirección...";

    const distancia = document.createElement("div");
    distancia.classList.add("address");

    distancia.textContent =
        distanciaConductorKm !== null
            ? `🚗 Distancia: ${distanciaConductorKm.toFixed(2)} km`
            : "🚗 Distancia: No disponible";

    const posicionElemento = document.createElement("div");
    posicionElemento.classList.add("address");

    posicionElemento.textContent =
        posicion !== null
            ? `📊 Posición: #${posicion}`
            : "";

    const buttons = document.createElement("div");
    buttons.classList.add("buttons");

    const acceptButton = document.createElement("button");
    acceptButton.classList.add("accept-button");
    acceptButton.textContent = "Aceptar";

    const rejectButton = document.createElement("button");
    rejectButton.classList.add("reject-button");
    rejectButton.textContent = "Rechazar";

    buttons.appendChild(acceptButton);
    buttons.appendChild(rejectButton);

    messageContent.appendChild(message);
    messageContent.appendChild(details);
    messageContent.appendChild(distancia);
    messageContent.appendChild(posicionElemento);
    messageContent.appendChild(addressRecogida);
    messageContent.appendChild(addressDestino);
    messageContent.appendChild(buttons);

    mensaje.appendChild(time);
    mensaje.appendChild(indicator);
    mensaje.appendChild(messageContent);

    contenedor.appendChild(mensaje);

    const marcadorRecogida = crearMarcadorEmoji(
        "📦",
        id,
        [recogidaLng, recogidaLat],
        "bottom"
    );

    const marcadorDestino = crearMarcadorEmoji(
        "📍",
        id,
        [destinoLng, destinoLat],
        "bottom"
    );

    const pedido = {
        id,
        titulo,
        detalles,
        prioridad,
        tiempo,
        tarifa,

        recogidaLat,
        recogidaLng,
        destinoLat,
        destinoLng,

        distanciaConductorKm,
        posicion,

        mensaje,
        marcadorRecogida,
        marcadorDestino,

        timer: null,
        aceptado: false
    };

    pedidosActivos.add(pedido);

    mensaje.pedido = pedido;

    obtenerDireccion(
        recogidaLat,
        recogidaLng
    )
        .then(dir => {
            addressRecogida.textContent =
                "📍 Recogida: " + dir;
        })
        .catch(() => {
            addressRecogida.textContent =
                "📍 Recogida: Dirección no disponible";
        });

    obtenerDireccion(
        destinoLat,
        destinoLng
    )
        .then(dir => {
            addressDestino.textContent =
                "🏁 Destino: " + dir;
        })
        .catch(() => {
            addressDestino.textContent =
                "🏁 Destino: Dirección no disponible";
        });

    let tiempoRestante = tiempo;

    time.style.width = "100%";
    time.style.transition =
        `width ${tiempo}s linear`;

    setTimeout(() => {
        time.style.width = "0%";
    }, 50);

    pedido.timer = setInterval(() => {

        tiempoRestante--;

        if (tiempoRestante <= 0) {
            eliminarPedido(pedido);
        }

    }, 1000);

    acceptButton.addEventListener(
        "click",
        () => aceptarPedido(pedido)
    );

    rejectButton.addEventListener(
        "click",
        () => rechazarPedido(pedido)
    );

    mensaje.addEventListener("click", evento => {

        if (evento.target.tagName === "BUTTON") {
            return;
        }

        enfocarPedidoCompleto(pedido);
    });

    return mensaje;
}


// =========================================================
// ENFOCAR PEDIDO
// =========================================================

function enfocarPedidoCompleto(pedido) {

    if (!ubicacionRepartidor) {

        alert(
            "Primero selecciona la ubicación del conductor."
        );

        return;
    }

    const bounds = new maplibregl.LngLatBounds();

    bounds.extend(ubicacionRepartidor);

    bounds.extend([
        pedido.recogidaLng,
        pedido.recogidaLat
    ]);

    bounds.extend([
        pedido.destinoLng,
        pedido.destinoLat
    ]);

    map.fitBounds(bounds, {
        padding: {
            top: 50,
            bottom: 250,
            left: 40,
            right: 40
        },
        maxZoom: 15,
        duration: 1200
    });
}


// =========================================================
// ACEPTAR PEDIDO
// =========================================================

async function aceptarPedido(pedidoAceptado) {

    if (!ubicacionRepartidor) {

        alert(
            "Primero selecciona la ubicación del conductor."
        );

        return;
    }

    try {

        const respuestaBackend = await fetch(
            "/api/pedido/aceptar",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    pedido_id: pedidoAceptado.id,

                    repartidor: {
                        lat: ubicacionRepartidor[1],
                        lng: ubicacionRepartidor[0]
                    },

                    recogida: {
                        lat: pedidoAceptado.recogidaLat,
                        lng: pedidoAceptado.recogidaLng
                    },

                    destino: {
                        lat: pedidoAceptado.destinoLat,
                        lng: pedidoAceptado.destinoLng
                    }
                })
            }
        );

        if (!respuestaBackend.ok) {

            const errorDatos =
                await respuestaBackend.json().catch(() => ({}));

            throw new Error(
                errorDatos.error ||
                "El servidor rechazó el pedido."
            );
        }

    } catch (e) {

        console.error(
            "No se pudo aceptar el pedido:",
            e
        );

        alert(
            "No se pudo aceptar el pedido."
        );

        return;
    }

    // Evaluación secundaria con IA.
    try {

        const urlRuta =
            `https://router.project-osrm.org/route/v1/driving/`
            + `${ubicacionRepartidor[0]},${ubicacionRepartidor[1]};`
            + `${pedidoAceptado.recogidaLng},${pedidoAceptado.recogidaLat}`
            + `?overview=false`;

        const respRuta = await fetch(urlRuta);
        const datosRuta = await respRuta.json();

        let distanciaKm = 0;

        if (
            datosRuta.code === "Ok"
            && datosRuta.routes.length > 0
        ) {
            distanciaKm =
                datosRuta.routes[0].distance / 1000;
        }

        await fetch(
            "/api/evaluar",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    distancia_km: distanciaKm,
                    tarifa_mxn: pedidoAceptado.tarifa || 50.0,
                    trafico: "Moderado"
                })
            }
        );

    } catch (error) {

        console.warn(
            "Error en evaluación secundaria:",
            error
        );
    }

    // Limpiar tarjetas y temporizadores.
    pedidosActivos.forEach(pedido => {

        if (pedido !== pedidoAceptado) {
            eliminarPedido(pedido);
        }
    });

    if (pedidoAceptado.timer) {
        clearInterval(pedidoAceptado.timer);
        pedidoAceptado.timer = null;
    }

    pedidoAceptado.aceptado = true;

    if (pedidoAceptado.mensaje) {
        pedidoAceptado.mensaje.remove();
        pedidoAceptado.mensaje = null;
    }

    pedidosActivos.clear();
    pedidosActivos.add(pedidoAceptado);

    pedidoEnCurso = pedidoAceptado;
    fasePedido = "hacia_recogida";

    enfocarPedidoCompleto(pedidoAceptado);

    await calcularRuta(
        ubicacionRepartidor,
        [
            pedidoAceptado.recogidaLng,
            pedidoAceptado.recogidaLat
        ],
        "ruta-trayecto-1"
    );

    await calcularRuta(
        [
            pedidoAceptado.recogidaLng,
            pedidoAceptado.recogidaLat
        ],
        [
            pedidoAceptado.destinoLng,
            pedidoAceptado.destinoLat
        ],
        "ruta-trayecto-2"
    );
}


// =========================================================
// RECHAZAR PEDIDO
// =========================================================

function rechazarPedido(pedido) {
    eliminarPedido(pedido);
}


// =========================================================
// ELIMINAR PEDIDO
// =========================================================

function eliminarPedido(pedido) {

    if (pedido.aceptado) {
        return;
    }

    if (pedido.timer) {
        clearInterval(pedido.timer);
        pedido.timer = null;
    }

    if (pedido.marcadorRecogida) {
        pedido.marcadorRecogida.remove();
        pedido.marcadorRecogida = null;
    }

    if (pedido.marcadorDestino) {
        pedido.marcadorDestino.remove();
        pedido.marcadorDestino = null;
    }

    if (pedido.mensaje) {
        pedido.mensaje.remove();
        pedido.mensaje = null;
    }

    pedidosActivos.delete(pedido);
}


// =========================================================
// OBTENER DIRECCIÓN
// =========================================================

async function obtenerDireccion(lat, lng) {

    const url =
        `https://nominatim.openstreetmap.org/reverse`
        + `?format=json`
        + `&lat=${lat}`
        + `&lon=${lng}`
        + `&zoom=18`
        + `&addressdetails=1`;

    const respuesta = await fetch(url);

    if (!respuesta.ok) {
        throw new Error(
            "No se pudo obtener la dirección."
        );
    }

    const datos = await respuesta.json();

    return datos.display_name || "Dirección desconocida";
}


// =========================================================
// CALCULAR RUTA CON OSRM
// =========================================================

async function calcularRuta(
    origen,
    destino,
    idRuta = "ruta"
) {

    const url =
        `https://router.project-osrm.org/route/v1/driving/`
        + `${origen[0]},${origen[1]};`
        + `${destino[0]},${destino[1]}`
        + `?alternatives=true`
        + `&geometries=geojson`
        + `&overview=full`;

    try {

        const respuesta = await fetch(url);
        const datos = await respuesta.json();

        if (
            datos.code !== "Ok"
            || !datos.routes
            || datos.routes.length === 0
        ) {
            console.error("No se encontró una ruta.");
            return;
        }

        const geojson = {
            type: "Feature",
            geometry: datos.routes[0].geometry
        };

        if (map.getSource(idRuta)) {

            map.getSource(idRuta).setData(geojson);

        } else {

            map.addSource(idRuta, {
                type: "geojson",
                data: geojson
            });

            const colorRuta =
                idRuta === "ruta-trayecto-1"
                    ? "#3887be"
                    : "#2ecc71";

            if (!map.getLayer(idRuta)) {

                map.addLayer({
                    id: idRuta,
                    type: "line",
                    source: idRuta,

                    layout: {
                        "line-join": "round",
                        "line-cap": "round"
                    },

                    paint: {
                        "line-color": colorRuta,
                        "line-width": 5,
                        "line-opacity": 0.8
                    }
                });
            }
        }

    } catch (error) {

        console.error(
            "Error al calcular la ruta:",
            error
        );
    }
}


// =========================================================
// EVALUAR OBSTÁCULO Y RECALCULAR RUTAS
// =========================================================

async function evaluarYRecalcularRutas(
    lngObstaculo,
    latObstaculo
) {

    if (!pedidoEnCurso || !ubicacionRepartidor) {
        return;
    }

    try {

        const esHaciaRecogida =
            fasePedido === "hacia_recogida";

        const origen =
            esHaciaRecogida
                ? ubicacionRepartidor
                : [
                    pedidoEnCurso.recogidaLng,
                    pedidoEnCurso.recogidaLat
                ];

        const destino =
            esHaciaRecogida
                ? [
                    pedidoEnCurso.recogidaLng,
                    pedidoEnCurso.recogidaLat
                ]
                : [
                    pedidoEnCurso.destinoLng,
                    pedidoEnCurso.destinoLat
                ];

        const idRutaActual =
            esHaciaRecogida
                ? "ruta-trayecto-1"
                : "ruta-trayecto-2";

        const urlOsrm =
            `https://router.project-osrm.org/route/v1/driving/`
            + `${origen[0]},${origen[1]};`
            + `${destino[0]},${destino[1]}`
            + `?alternatives=true`
            + `&geometries=geojson`
            + `&overview=full`;

        const respOsrm = await fetch(urlOsrm);
        const datosOsrm = await respOsrm.json();

        if (
            datosOsrm.code === "Ok"
            && datosOsrm.routes
            && datosOsrm.routes.length > 0
        ) {

            try {

                const respEva = await fetch(
                    "/api/evitar-obstaculo",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            obstaculo: {
                                lng: lngObstaculo,
                                lat: latObstaculo
                            },
                            rutas: datosOsrm.routes
                        })
                    }
                );

                if (respEva.ok) {

                    const resultado = await respEva.json();

                    if (
                        resultado.mejor_ruta
                        && map.getSource(idRutaActual)
                    ) {

                        map.getSource(idRutaActual).setData({
                            type: "Feature",
                            geometry: resultado.mejor_ruta.geometry
                        });

                        return;
                    }
                }

            } catch (e) {

                console.warn(
                    "Fallback: no se pudo evaluar obstáculo.",
                    e
                );
            }

            if (map.getSource(idRutaActual)) {

                map.getSource(idRutaActual).setData({
                    type: "Feature",
                    geometry: datosOsrm.routes[0].geometry
                });
            }
        }

    } catch (error) {

        console.error(
            "Error al recalcular ruta por obstáculo:",
            error
        );
    }
}