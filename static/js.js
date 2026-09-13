let condicionSeleccionada = null;

// =========================================================
// PEDIDOS ACTIVOS Y ESTADO DEL REPARTIDOR
// =========================================================
const pedidosActivos = new Set();
let marcadorOrigen = null;
let ubicacionRepartidor = null;
let pedidoEnCurso = null;

// =========================================================
// ELEMENTOS DE CONDICIONES
// =========================================================
const botonesCondicion = document.querySelectorAll(".condicion");

// =========================================================
// SELECCIONAR CONDICIÓN
// =========================================================
botonesCondicion.forEach(
    boton => {
        boton.addEventListener(
            "click",
            evento => {
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

                botonesCondicion.forEach(
                    otroBoton => {
                        otroBoton.classList.remove("condicion-seleccionada");
                    }
                );

                condicionSeleccionada = {
                    tipo: tipo,
                    emoji: emoji,
                    boton: boton
                };

                boton.classList.add("condicion-seleccionada");
                console.log("Condición seleccionada:", condicionSeleccionada);
            }
        );
    }
);

// =========================================================
// CREAR MAPA DE MTY
// =========================================================
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [-100.3161, 25.6866],
    zoom: 12
});

// =========================================================
// CLICK EN MAPA (REPARTIDOR O CONDICIÓN)
// =========================================================
map.on(
    "click",
    async function (e) {
        const lon = e.lngLat.lng;
        const lat = e.lngLat.lat;

        // Si hay una condición seleccionada, colocarla en lugar de mover al repartidor
        if (condicionSeleccionada) {
            await colocarCondicion(
                lat,
                lon,
                condicionSeleccionada
            );
            return;
        }

        const url = `https://router.project-osrm.org/nearest/v1/driving/${lon},${lat}`;

        try {
            const respuesta = await fetch(url);
            const datos = await respuesta.json();

            if (datos.code !== "Ok") {
                console.error("No se encontró una calle cercana.");
                return;
            }

            const nuevoOrigen = datos.waypoints[0].location;
            console.log("Nuevo origen / repartidor:", nuevoOrigen);

            ubicacionRepartidor = nuevoOrigen;

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

            console.log("Repartidor seleccionado:", ubicacionRepartidor);

            // Si ya hay un pedido aceptado, actualizar ruta automáticamente hacia el punto de recogida
            if (pedidoEnCurso) {
                console.log("Actualizando ruta del repartidor hacia el punto de recogida...");
                await calcularRuta(
                    ubicacionRepartidor, 
                    [pedidoEnCurso.recogidaLng, pedidoEnCurso.recogidaLat], 
                    "ruta-trayecto-1"
                );
            }

        } catch (error) {
            console.error("Error al buscar la calle:", error);
        }
    }
);

// =========================================================
// COLOCAR CONDICIÓN EN EL MAPA
// =========================================================
async function colocarCondicion(
    lat,
    lon,
    condicion
) {
    console.log("Buscando calle cercana para condición...");

    const url = `https://router.project-osrm.org/nearest/v1/driving/${lon},${lat}`;

    try {
        const respuesta = await fetch(url);
        if (!respuesta.ok) {
            throw new Error("OSRM no respondió correctamente.");
        }

        const datos = await respuesta.json();
        if (
            datos.code !== "Ok" ||
            !datos.waypoints ||
            datos.waypoints.length === 0
        ) {
            throw new Error("No se encontró una calle cercana.");
        }

        const coordenadas = datos.waypoints[0].location;
        const lngCalle = coordenadas[0];
        const latCalle = coordenadas[1];

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

        if (!respuestaFlask.ok) {
            marcador.remove();
            throw new Error("Flask no pudo guardar la condición.");
        }

        const resultado = await respuestaFlask.json();
        if (resultado.calle) {
            elemento.title = resultado.calle;
        }

        condicionSeleccionada = null;
        botonesCondicion.forEach(
            boton => {
                boton.classList.remove("condicion-seleccionada");
            }
        );

        console.log("Condición colocada correctamente:", {
            tipo: condicion.tipo,
            emoji: condicion.emoji,
            lat: latCalle,
            lng: lngCalle,
            calle: resultado.calle
        });
    } catch (error) {
        console.error("Error colocando condición:", error);
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
    numeroElemento.style.boxShadow = "0 1px 5px rgba(0,0,0,0.35)";
    numeroElemento.style.marginTop = "2px";
    numeroElemento.style.whiteSpace = "nowrap";

    elemento.appendChild(icono);
    elemento.appendChild(numeroElemento);

    return new maplibregl.Marker({
        element: elemento,
        anchor: anchor
    })
    .setLngLat(coordenadas)
    .addTo(map);
}

// =========================================================
// CALCULAR RUTA (OSRM)
// =========================================================
async function calcularRuta(
    origen,
    destino,
    idRuta = "ruta"
) {
    const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${origen[0]},${origen[1]};` +
        `${destino[0]},${destino[1]}` +
        `?steps=true&geometries=geojson&overview=full`;

    try {
        const respuesta = await fetch(url);
        const datos = await respuesta.json();
        
        if (datos.code !== "Ok") {
            console.error("No se encontró una ruta.");
            return;
        }

        const ruta = datos.routes[0];

        const geojson = {
            type: 'Feature',
            geometry: ruta.geometry
        };

        if (map.getSource(idRuta)) {
            map.getSource(idRuta).setData(geojson);
        } else {
            map.addSource(idRuta, {
                type: 'geojson',
                data: geojson
            });

            const colorRuta = idRuta === "ruta-trayecto-1" ? "#3887be" : "#2ecc71";

            map.addLayer({
                id: idRuta,
                type: 'line',
                source: idRuta,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': colorRuta,
                    'line-width': 5,
                    'line-opacity': 0.8
                }
            });
        }
    } catch (error) {
        console.error("Error al calcular la ruta:", error);
    }
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
    recogidaLat,
    recogidaLng,
    destinoLat,
    destinoLng
}) {
    if (
        typeof recogidaLat !== "number" ||
        typeof recogidaLng !== "number" ||
        typeof destinoLat !== "number" ||
        typeof destinoLng !== "number"
    ) {
        console.error("El pedido necesita coordenadas válidas de recogida y destino.");
        return;
    }

    const contenedor = document.getElementById("display-message");

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
    addressRecogida.textContent = "📍 Recogida: Buscando dirección...";

    const addressDestino = document.createElement("div");
    addressDestino.classList.add("address");
    addressDestino.textContent = "🏁 Destino: Buscando dirección...";

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
    messageContent.appendChild(addressRecogida);
    messageContent.appendChild(addressDestino);
    messageContent.appendChild(buttons);

    mensaje.appendChild(time);
    mensaje.appendChild(indicator);
    mensaje.appendChild(messageContent);

    contenedor.appendChild(mensaje);

    const marcadorRecogida = crearMarcadorEmoji("📦", id, [recogidaLng, recogidaLat], "bottom");
    const marcadorDestino = crearMarcadorEmoji("📍", id, [destinoLng, destinoLat], "bottom");

    const pedido = {
        id,
        titulo,
        detalles,
        prioridad,
        tiempo,
        recogidaLat,
        recogidaLng,
        destinoLat,
        destinoLng,
        mensaje,
        marcadorRecogida,
        marcadorDestino,
        timer: null,
        aceptado: false
    };

    pedidosActivos.add(pedido);
    mensaje.pedido = pedido;

    obtenerDireccion(recogidaLat, recogidaLng)
        .then(direccion => { addressRecogida.textContent = "📍 Recogida: " + direccion; })
        .catch(() => { addressRecogida.textContent = "📍 Recogida: Dirección no disponible"; });

    obtenerDireccion(destinoLat, destinoLng)
        .then(direccion => { addressDestino.textContent = "🏁 Destino: " + direccion; })
        .catch(() => { addressDestino.textContent = "🏁 Destino: Dirección no disponible"; });

    let tiempoRestante = tiempo;
    time.style.width = "100%";
    time.style.transition = `width ${tiempo}s linear`;

    setTimeout(() => { time.style.width = "0%"; }, 50);

    pedido.timer = setInterval(() => {
        tiempoRestante--;
        if (tiempoRestante <= 0) {
            eliminarPedido(pedido);
        }
    }, 1000);

    acceptButton.addEventListener("click", () => { aceptarPedido(pedido); });
    rejectButton.addEventListener("click", () => { rechazarPedido(pedido); });

    mensaje.addEventListener("click", evento => {
        if (evento.target.tagName === "BUTTON") return;
        enfocarPedidoCompleto(pedido);
    });

    return mensaje;
}

// =========================================================
// ENFOCAR REPARTIDOR + RECOGIDA + DESTINO
// =========================================================
function enfocarPedidoCompleto(pedido) {
    if (!ubicacionRepartidor) {
        console.error("No existe ubicación del repartidor.");
        return;
    }

    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(ubicacionRepartidor);
    bounds.extend([pedido.recogidaLng, pedido.recogidaLat]);
    bounds.extend([pedido.destinoLng, pedido.destinoLat]);

    map.fitBounds(bounds, {
        padding: { top: 50, bottom: 250, left: 40, right: 40 },
        maxZoom: 15,
        duration: 1200
    });
}

// =========================================================
// ACEPTAR PEDIDO
// =========================================================
async function aceptarPedido(pedidoAceptado) {
    console.log("Pedido aceptado:", pedidoAceptado);

    if (!ubicacionRepartidor) {
        alert("Primero selecciona la ubicación del repartidor en el mapa.");
        return;
    }

    try {
        const urlRuta = `https://router.project-osrm.org/route/v1/driving/${ubicacionRepartidor[0]},${ubicacionRepartidor[1]};${pedidoAceptado.recogidaLng},${pedidoAceptado.recogidaLat}?overview=false`;
        const respRuta = await fetch(urlRuta);
        const datosRuta = await respRuta.json();
        
        let distanciaKm = 5.0; 
        if (datosRuta.code === "Ok" && datosRuta.routes.length > 0) {
            distanciaKm = datosRuta.routes[0].distance / 1000; 
        }

        const respuesta = await fetch("/api/evaluar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                distancia_km: distanciaKm,
                tarifa_mxn: 50.0, 
                trafico: "Moderado"
            })
        });

        if (!respuesta.ok) throw new Error("Error procesando el pedido con la IA.");
        await respuesta.json();

    } catch (error) {
        console.error("No se pudo aceptar el pedido:", error);
        return;
    }

    if (pedidoAceptado.timer) {
        clearInterval(pedidoAceptado.timer);
        pedidoAceptado.timer = null;
    }

    pedidosActivos.forEach(pedido => {
        if (pedido !== pedidoAceptado) {
            eliminarPedido(pedido);
        }
    });

    pedidoAceptado.aceptado = true;

    if (pedidoAceptado.mensaje) {
        pedidoAceptado.mensaje.remove();
        pedidoAceptado.mensaje = null;
    }

    pedidosActivos.clear();
    pedidosActivos.add(pedidoAceptado);

    pedidoEnCurso = pedidoAceptado; 

    enfocarPedidoCompleto(pedidoAceptado);

    await calcularRuta(
        ubicacionRepartidor, 
        [pedidoAceptado.recogidaLng, pedidoAceptado.recogidaLat], 
        "ruta-trayecto-1"
    );

    await calcularRuta(
        [pedidoAceptado.recogidaLng, pedidoAceptado.recogidaLat], 
        [pedidoAceptado.destinoLng, pedidoAceptado.destinoLat], 
        "ruta-trayecto-2"
    );
}

// =========================================================
// RECHAZAR PEDIDO
// =========================================================
function rechazarPedido(pedido) {
    console.log("Pedido rechazado:", pedido.id);
    eliminarPedido(pedido);
}

// =========================================================
// ELIMINAR PEDIDO
// =========================================================
function eliminarPedido(pedido) {
    if (pedido.aceptado) return;

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
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const respuesta = await fetch(url);

    if (!respuesta.ok) throw new Error("No se pudo obtener la dirección.");

    const datos = await respuesta.json();
    return datos.display_name;
}

// =========================================================
// EJEMPLO DE PEDIDOS INICIALES
// =========================================================
crearPedido({
    id: 123,
    prioridad: "#9e1111",
    tiempo: 30,
    titulo: "Pedido #123",
    detalles: "Recoger paquete y entregar.",
    recogidaLat: 25.6866,
    recogidaLng: -100.3161,
    destinoLat: 25.7000,
    destinoLng: -100.2900
});

crearPedido({
    id: 456,
    prioridad: "#53bb0d",
    tiempo: 30,
    titulo: "Pedido #456",
    detalles: "Recoger paquete y entregar.",
    recogidaLat: 25.6860,
    recogidaLng: -100.3157,
    destinoLat: 25.7300,
    destinoLng: -100.2900
});