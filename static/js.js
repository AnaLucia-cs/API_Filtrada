let condicionSeleccionada = null;

// =========================================================
// PEDIDOS ACTIVOS Y ESTADO DEL REPARTIDOR
// =========================================================
const pedidosActivos = new Set();
let marcadorOrigen = null;
let ubicacionRepartidor = null;
let pedidoEnCurso = null;
let fasePedido = 'hacia_recogida'; // 'hacia_recogida' | 'hacia_destino'

// =========================================================
// ELEMENTOS DE CONDICIONES
// =========================================================
const botonesCondicion = document.querySelectorAll(".condicion");

// =========================================================
// SELECCIONAR CONDICIÓN
// =========================================================
botonesCondicion.forEach(boton => {
    boton.addEventListener("click", evento => {
        evento.stopPropagation();

        const tipo = boton.dataset.tipo;
        const emoji = boton.dataset.emoji;

        if (condicionSeleccionada && condicionSeleccionada.tipo === tipo) {
            condicionSeleccionada = null;
            boton.classList.remove("condicion-seleccionada");
            console.log("Condición desactivada:", tipo);
            return;
        }

        botonesCondicion.forEach(otroBoton => {
            otroBoton.classList.remove("condicion-seleccionada");
        });

        condicionSeleccionada = { tipo, emoji, boton };
        boton.classList.add("condicion-seleccionada");
        console.log("Condición seleccionada:", condicionSeleccionada);
    });
});

// =========================================================
// CREAR MAPA DE MTY
// =========================================================
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [-100.3161, 25.6866],
    zoom: 12
});

// Esperar a que cargue el mapa antes de interactuar con capas
map.on('load', () => {
    console.log("Mapa cargado correctamente.");
    
    // Inicializar pedidos de ejemplo solo cuando el DOM y el mapa estén listos
    crearPedido({
        id: 123,
        prioridad: "#9e1111",
        tiempo: 30,
        titulo: "Pedido #123",
        detalles: "Recoger paquete y entregar.",
        tarifa: 65.0,
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
        tarifa: 45.0,
        recogidaLat: 25.6860,
        recogidaLng: -100.3157,
        destinoLat: 25.7300,
        destinoLng: -100.2900
    });
});

// =========================================================
// CLICK EN MAPA (REPARTIDOR O CONDICIÓN)
// =========================================================
map.on("click", async function (e) {
    const lon = e.lngLat.lng;
    const lat = e.lngLat.lat;

    if (condicionSeleccionada) {
        await colocarCondicion(lat, lon, condicionSeleccionada);
        return;
    }

    const url = `https://router.project-osrm.org/nearest/v1/driving/${lon},${lat}`;

    try {
        const respuesta = await fetch(url);
        const datos = await respuesta.json();

        if (datos.code !== "Ok" || !datos.waypoints || datos.waypoints.length === 0) {
            console.error("No se encontró una calle cercana.");
            return;
        }

        const nuevoOrigen = datos.waypoints[0].location;
        ubicacionRepartidor = nuevoOrigen;

        // =========================================================
        // Cambio automático de fase al llegar a la recogida
        // =========================================================
        if (pedidoEnCurso && fasePedido === 'hacia_recogida') {
            const distRecogida = Math.sqrt(
                Math.pow(ubicacionRepartidor[0] - pedidoEnCurso.recogidaLng, 2) + 
                Math.pow(ubicacionRepartidor[1] - pedidoEnCurso.recogidaLat, 2)
            );

            // Menor a 0.0008 (~80-100 metros de distancia)
            if (distRecogida < 0.015) {
                fasePedido = 'hacia_destino';
                console.log("¡Llegó a la recogida! Cambiando a ruta verde (hacia_destino).");

                // =========================================================
                // BORRAR LA RUTA AZUL (CAPA Y FUENTE)
                // =========================================================
                if (map.getLayer("ruta-trayecto-1")) {
                    map.removeLayer("ruta-trayecto-1");
                }
                if (map.getSource("ruta-trayecto-1")) {
                    map.removeSource("ruta-trayecto-1");
                }
                // =================================------------------------
                // BORRAR EL ICONO DE RECOGIDA (📦)
                // =================================------------------------
                if (pedidoEnCurso.marcadorRecogida) {
                    pedidoEnCurso.marcadorRecogida.remove();
                    pedidoEnCurso.marcadorRecogida = null;
                }
                // =================================------------------------
            }
        }
        // =========================================================

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

        if (pedidoEnCurso) {
            const idRutaActiva = fasePedido === 'hacia_recogida' ? "ruta-trayecto-1" : "ruta-trayecto-2";
            const destinoFase = fasePedido === 'hacia_recogida'
                ? [pedidoEnCurso.recogidaLng, pedidoEnCurso.recogidaLat]
                : [pedidoEnCurso.destinoLng, pedidoEnCurso.destinoLat];

            await calcularRuta(ubicacionRepartidor, destinoFase, idRutaActiva);
        }

    } catch (error) {
        console.error("Error al buscar la calle:", error);
    }
});

// =========================================================
// COLOCAR CONDICIÓN EN EL MAPA
// =========================================================
async function colocarCondicion(lat, lon, condicion) {
    const url = `https://router.project-osrm.org/nearest/v1/driving/${lon},${lat}`;

    try {
        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error("OSRM no respondió correctamente.");

        const datos = await respuesta.json();
        if (datos.code !== "Ok" || !datos.waypoints || datos.waypoints.length === 0) {
            throw new Error("No se encontró una calle cercana.");
        }

        const [lngCalle, latCalle] = datos.waypoints[0].location;

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

        // Envío seguro a Flask (envuelve en try/catch por si no hay backend activo)
        try {
            const respuestaFlask = await fetch("/api/condicion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tipo: condicion.tipo,
                    emoji: condicion.emoji,
                    lat: latCalle,
                    lng: lngCalle
                })
            });

            if (respuestaFlask.ok) {
                const resultado = await respuestaFlask.json();
                if (resultado.calle) elemento.title = resultado.calle;
            }
        } catch (apiError) {
            console.warn("Backend /api/condicion no disponible o falló:", apiError);
        }

        const tipoCondicion = condicion.tipo;
        condicionSeleccionada = null;
        botonesCondicion.forEach(b => b.classList.remove("condicion-seleccionada"));

        if (pedidoEnCurso && ubicacionRepartidor) {
            await evaluarYRecalcularRutas(lngCalle, latCalle);
        }

    } catch (error) {
        console.error("Error colocando condición:", error);
    }
}

// =========================================================
// CREAR MARCADOR CON EMOJI + NÚMERO
// =========================================================
function crearMarcadorEmoji(emoji, numero, coordenadas, anchor = "bottom") {
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

    return new maplibregl.Marker({ element: elemento, anchor })
        .setLngLat(coordenadas)
        .addTo(map);
}

// =========================================================
// CALCULAR RUTA CON ALTERNATIVAS (OSRM)
// =========================================================
async function calcularRuta(origen, destino, idRuta = "ruta") {
    const url = `https://router.project-osrm.org/route/v1/driving/${origen[0]},${origen[1]};${destino[0]},${destino[1]}?alternatives=true&geometries=geojson&overview=full`;

    try {
        const respuesta = await fetch(url);
        const datos = await respuesta.json();

        if (datos.code !== "Ok" || !datos.routes || datos.routes.length === 0) {
            console.error("No se encontró una ruta.");
            return;
        }

        const geojson = {
            type: 'Feature',
            geometry: datos.routes[0].geometry
        };

        if (map.getSource(idRuta)) {
            map.getSource(idRuta).setData(geojson);
        } else {
            map.addSource(idRuta, {
                type: 'geojson',
                data: geojson
            });

            const colorRuta = idRuta === "ruta-trayecto-1" ? "#3887be" : "#2ecc71";

            if (!map.getLayer(idRuta)) {
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
    tarifa = 50.0,
    recogidaLat,
    recogidaLng,
    destinoLat,
    destinoLng
}) {
    const contenedor = document.getElementById("display-message");
    if (!contenedor) {
        console.error("No se encontró el elemento #display-message en el DOM.");
        return;
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
        tarifa,
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
        .then(dir => addressRecogida.textContent = "📍 Recogida: " + dir)
        .catch(() => addressRecogida.textContent = "📍 Recogida: Dirección no disponible");

    obtenerDireccion(destinoLat, destinoLng)
        .then(dir => addressDestino.textContent = "🏁 Destino: " + dir)
        .catch(() => addressDestino.textContent = "🏁 Destino: Dirección no disponible");

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

    acceptButton.addEventListener("click", () => aceptarPedido(pedido));
    rejectButton.addEventListener("click", () => rechazarPedido(pedido));

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
    if (!ubicacionRepartidor) {
        alert("Primero selecciona la ubicación del repartidor en el mapa.");
        return;
    }

    // 1. Enviar el pedido aceptado al backend de Flask (/api/pedido/aceptar)
    try {
        const respuestaBackend = await fetch("/api/pedido/aceptar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
        });

        if (!respuestaBackend.ok) {
            console.error("El servidor rechazó el pedido aceptado.");
        }
    } catch (e) {
        console.warn("No se pudo conectar con /api/pedido/aceptar:", e);
    }

    // 2. Evaluar tarifa / distancia con IA (tu ruta /api/evaluar existente)
    try {
        const urlRuta = `https://router.project-osrm.org/route/v1/driving/${ubicacionRepartidor[0]},${ubicacionRepartidor[1]};${pedidoAceptado.recogidaLng},${pedidoAceptado.recogidaLat}?overview=false`;
        const respRuta = await fetch(urlRuta);
        const datosRuta = await respRuta.json();
        
        let distanciaKm = 5.0; 
        if (datosRuta.code === "Ok" && datosRuta.routes.length > 0) {
            distanciaKm = datosRuta.routes[0].distance / 1000; 
        }

        await fetch("/api/evaluar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                distancia_km: distanciaKm,
                tarifa_mxn: pedidoAceptado.tarifa || 50.0, 
                trafico: "Moderado"
            })
        });
    } catch (error) {
        console.warn("Error en evaluación secundaria:", error);
    }

    // 3. Limpieza de interfaz de tarjetas y temporizadores
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
    fasePedido = 'hacia_recogida';

    enfocarPedidoCompleto(pedidoAceptado);

    // 4. Pintar las rutas en el mapa de MapLibre
    await calcularRuta(
        ubicacionRepartidor, 
        [pedidoAceptado.recogidaLng, pedidoAceptado.recogidaLat], 
        "ruta-trayecto-1"
    );

    await calcularRuta(
        [pedidoAceptado.recogidaLng, pedidoAceptado.recogidaLat], 
        [pedidoAceptado.destinoLng, pedidoAceptado.destinoLat], // <-- Corregido (lng, lat)
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
    return datos.display_name || "Dirección desconocida";
}

// =========================================================
// EVALUAR OBSTÁCULO Y RECALCULAR SEGÚN FASE DEL PEDIDO
// =========================================================
async function evaluarYRecalcularRutas(lngObstaculo, latObstaculo) {
    if (!pedidoEnCurso || !ubicacionRepartidor) return;

    try {
        const esHaciaRecogida = (fasePedido === 'hacia_recogida');
        const origen = esHaciaRecogida ? ubicacionRepartidor : [pedidoEnCurso.recogidaLng, pedidoEnCurso.recogidaLat];
        const destino = esHaciaRecogida ? [pedidoEnCurso.recogidaLng, pedidoEnCurso.recogidaLat] : [pedidoEnCurso.destinoLng, pedidoEnCurso.destinoLat];
        const idRutaActual = esHaciaRecogida ? "ruta-trayecto-1" : "ruta-trayecto-2";

        const urlOsrm = `https://router.project-osrm.org/route/v1/driving/${origen[0]},${origen[1]};${destino[0]},${destino[1]}?alternatives=true&geometries=geojson&overview=full`;
        const respOsrm = await fetch(urlOsrm);
        const datosOsrm = await respOsrm.json();

        if (datosOsrm.code === "Ok" && datosOsrm.routes && datosOsrm.routes.length > 0) {
            try {
                const respEva = await fetch("/api/evitar-obstaculo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        obstaculo: { lng: lngObstaculo, lat: latObstaculo },
                        rutas: datosOsrm.routes
                    })
                });

                if (respEva.ok) {
                    const resultado = await respEva.json();
                    if (resultado.mejor_ruta && map.getSource(idRutaActual)) {
                        map.getSource(idRutaActual).setData({
                            type: 'Feature',
                            geometry: resultado.mejor_ruta.geometry
                        });
                        return;
                    }
                }
            } catch (e) {
                // Fallback por si la API /api/evitar-obstaculo no responde
            }

            // Fallback directo a OSRM si el backend no procesa el obstáculo
            if (map.getSource(idRutaActual)) {
                map.getSource(idRutaActual).setData({
                    type: 'Feature',
                    geometry: datosOsrm.routes[0].geometry
                });
            }
        }
    } catch (error) {
        console.error("Error al recalcular ruta por obstáculo:", error);
    }
}