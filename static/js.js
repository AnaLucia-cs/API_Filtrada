let condicionSeleccionada = null;

// =========================================================
// PEDIDOS ACTIVOS
// =========================================================
const pedidosActivos = new Set();

// =========================================================
// CONDICIÓN SELECCIONADA
// =========================================================

// Aquí guardamos la condición que el usuario quiere colocar


// =========================================================
// ELEMENTOS DE CONDICIONES
// =========================================================

const botonesCondicion =
    document.querySelectorAll(".condicion");


// =========================================================
// SELECCIONAR CONDICIÓN
// =========================================================

botonesCondicion.forEach(
    boton => {

        boton.addEventListener(
            "click",
            evento => {

                evento.stopPropagation();

                // =============================================
                // OBTENER DATOS DEL BOTÓN
                // =============================================

                const tipo =
                    boton.dataset.tipo;

                const emoji =
                    boton.dataset.emoji;


                // =============================================
                // SI YA ESTABA SELECCIONADO, DESACTIVAR
                // =============================================

                if (
                    condicionSeleccionada &&
                    condicionSeleccionada.tipo === tipo
                ) {

                    condicionSeleccionada =
                        null;

                    boton.classList.remove(
                        "condicion-seleccionada"
                    );

                    console.log(
                        "Condición desactivada:",
                        tipo
                    );

                    return;
                }


                // =============================================
                // QUITAR SELECCIÓN ANTERIOR
                // =============================================

                botonesCondicion.forEach(
                    otroBoton => {

                        otroBoton.classList.remove(
                            "condicion-seleccionada"
                        );

                    }
                );


                // =============================================
                // GUARDAR NUEVA CONDICIÓN
                // =============================================

                condicionSeleccionada = {

                    tipo:
                        tipo,

                    emoji:
                        emoji,

                    boton:
                        boton
                };


                boton.classList.add(
                    "condicion-seleccionada"
                );


                console.log(
                    "Condición seleccionada:",
                    condicionSeleccionada
                );

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
// UBI Y MARCADOR DEL REPARTIDOR
// =========================================================
let marcadorOrigen = null;
let ubicacionRepartidor = null;


// =========================================================
// CLICK EN MAPA
// =========================================================

map.on(
    "click",
    async function (e) {

        const lon =
            e.lngLat.lng;

        const lat =
            e.lngLat.lat;


        // =================================================
        // SI HAY UNA CONDICIÓN SELECCIONADA
        // =================================================

        if (condicionSeleccionada) {

            await colocarCondicion(
                lat,
                lon,
                condicionSeleccionada
            );

            return;
        }


        // =================================================
        // SI NO HAY CONDICIÓN
        // EL CLICK ES PARA EL REPARTIDOR
        // =================================================

        const url =
            `https://router.project-osrm.org/nearest/v1/driving/` +
            `${lon},${lat}`;


        try {

            const respuesta =
                await fetch(url);


            const datos =
                await respuesta.json();


            if (datos.code !== "Ok") {

                console.error(
                    "No se encontró una calle cercana."
                );

                return;
            }


            // =================================================
            // COORDENADAS SOBRE LA CALLE
            // =================================================

            const nuevoOrigen =
                datos.waypoints[0].location;


            console.log(
                "Nuevo origen / repartidor:",
                nuevoOrigen
            );


            // =================================================
            // GUARDAR UBICACIÓN
            // =================================================

            ubicacionRepartidor =
                nuevoOrigen;


            // =================================================
            // ACTUALIZAR MARCADOR
            // =================================================

            if (marcadorOrigen !== null) {

                marcadorOrigen
                    .setLngLat(nuevoOrigen);

            }

            else {

                const elRepartidor =
                    document.createElement("div");


                elRepartidor.textContent =
                    "🏍️";


                elRepartidor.style.fontSize =
                    "32px";


                elRepartidor.style.cursor =
                    "pointer";


                elRepartidor.style.userSelect =
                    "none";


                marcadorOrigen =
                    new maplibregl.Marker({
                        element:
                            elRepartidor,

                        anchor:
                            "center"
                    })
                    .setLngLat(nuevoOrigen)
                    .addTo(map);

            }


            console.log(
                "Repartidor seleccionado:",
                ubicacionRepartidor
            );

        }

        catch (error) {

            console.error(
                "Error al buscar la calle:",
                error
            );

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

    console.log(
        "Buscando calle cercana..."
    );


    // =====================================================
    // BUSCAR LA CALLE MÁS CERCANA
    // =====================================================

    const url =
        `https://router.project-osrm.org/nearest/v1/driving/` +
        `${lon},${lat}`;


    try {

        const respuesta =
            await fetch(url);


        if (!respuesta.ok) {

            throw new Error(
                "OSRM no respondió correctamente."
            );

        }


        const datos =
            await respuesta.json();


        if (
            datos.code !== "Ok" ||
            !datos.waypoints ||
            datos.waypoints.length === 0
        ) {

            throw new Error(
                "No se encontró una calle cercana."
            );

        }


        // =================================================
        // COORDENADAS CORREGIDAS SOBRE LA CALLE
        // =================================================

        const coordenadas =
            datos.waypoints[0].location;


        const lngCalle =
            coordenadas[0];

        const latCalle =
            coordenadas[1];


        console.log(
            "Ubicación sobre la calle:",
            latCalle,
            lngCalle
        );


        // =================================================
        // CREAR EMOJI
        // =================================================

        const elemento =
            document.createElement("div");


        elemento.textContent =
            condicion.emoji;


        elemento.style.fontSize =
            "32px";


        elemento.style.cursor =
            "pointer";


        elemento.style.userSelect =
            "none";


        // =================================================
        // COLOCAR EMOJI EN EL MAPA
        // =================================================

        const marcador =
            new maplibregl.Marker({

                element:
                    elemento,

                anchor:
                    "bottom"

            })

            .setLngLat([
                lngCalle,
                latCalle
            ])

            .addTo(map);


        // =================================================
        // ENVIAR A FLASK
        // =================================================

        const respuestaFlask =
            await fetch(
                "/api/condicion",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            tipo:
                                condicion.tipo,

                            emoji:
                                condicion.emoji,

                            lat:
                                latCalle,

                            lng:
                                lngCalle

                        })

                }
            );


        // =================================================
        // VERIFICAR FLASK
        // =================================================

        if (!respuestaFlask.ok) {

            marcador.remove();

            throw new Error(
                "Flask no pudo guardar la condición."
            );

        }


        const resultado =
            await respuestaFlask.json();


        console.log(
            "Respuesta de Flask:",
            resultado
        );


        // =================================================
        // GUARDAR LA CALLE COMO TOOLTIP
        // =================================================

        if (resultado.calle) {

            elemento.title =
                resultado.calle;

        }


        // =================================================
        // QUITAR LA SELECCIÓN
        // =================================================

        condicionSeleccionada =
            null;


        botonesCondicion.forEach(
            boton => {

                boton.classList.remove(
                    "condicion-seleccionada"
                );

            }
        );


        console.log(
            "Condición colocada correctamente:",
            {
                tipo:
                    condicion.tipo,

                emoji:
                    condicion.emoji,

                lat:
                    latCalle,

                lng:
                    lngCalle,

                calle:
                    resultado.calle
            }
        );

    }

    catch (error) {

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

    // =====================================================
    // CONTENEDOR
    // =====================================================
    const elemento =
        document.createElement("div");

    elemento.style.display =
        "flex";

    elemento.style.flexDirection =
        "column";

    elemento.style.alignItems =
        "center";

    elemento.style.cursor =
        "pointer";

    elemento.style.userSelect =
        "none";


    // =====================================================
    // EMOJI
    // =====================================================
    const icono =
        document.createElement("div");

    icono.textContent =
        emoji;

    icono.style.fontSize =
        "32px";

    icono.style.lineHeight =
        "1";


    // =====================================================
    // NÚMERO DEL PEDIDO
    // =====================================================
    const numeroElemento =
        document.createElement("div");

    numeroElemento.textContent =
        `#${numero}`;

    numeroElemento.style.backgroundColor =
        "#ffffff";

    numeroElemento.style.color =
        "#222222";

    numeroElemento.style.fontSize =
        "12px";

    numeroElemento.style.fontWeight =
        "bold";

    numeroElemento.style.padding =
        "2px 6px";

    numeroElemento.style.borderRadius =
        "8px";

    numeroElemento.style.boxShadow =
        "0 1px 5px rgba(0,0,0,0.35)";

    numeroElemento.style.marginTop =
        "2px";

    numeroElemento.style.whiteSpace =
        "nowrap";


    // =====================================================
    // ARMAR ELEMENTO
    // =====================================================
    elemento.appendChild(
        icono
    );

    elemento.appendChild(
        numeroElemento
    );


    // =====================================================
    // CREAR MARKER
    // =====================================================
    return new maplibregl.Marker({
        element: elemento,
        anchor: anchor
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

    // =====================================================
    // UBICACIÓN DE RECOGIDA
    // =====================================================
    recogidaLat,

    recogidaLng,

    // =====================================================
    // UBICACIÓN DE DESTINO
    // =====================================================
    destinoLat,

    destinoLng

}) {


    // =====================================================
    // VALIDAR COORDENADAS
    // =====================================================
    if (

        typeof recogidaLat !== "number" ||

        typeof recogidaLng !== "number" ||

        typeof destinoLat !== "number" ||

        typeof destinoLng !== "number"

    ) {

        console.error(
            "El pedido necesita coordenadas " +
            "válidas de recogida y destino."
        );

        return;
    }


    // =====================================================
    // CONTENEDOR
    // =====================================================
    const contenedor =
        document.getElementById(
            "display-message"
        );


    // =====================================================
    // TARJETA
    // =====================================================
    const mensaje =
        document.createElement("div");

    mensaje.classList.add(
        "mensaje"
    );


    // =====================================================
    // TIMER
    // =====================================================
    const time =
        document.createElement("div");

    time.classList.add(
        "time"
    );


    // =====================================================
    // PRIORIDAD
    // =====================================================
    const indicator =
        document.createElement("div");

    indicator.classList.add(
        "indicator"
    );

    indicator.style.backgroundColor =
        prioridad;


    // =====================================================
    // CONTENIDO
    // =====================================================
    const messageContent =
        document.createElement("div");

    messageContent.classList.add(
        "message-content"
    );


    // =====================================================
    // TÍTULO
    // =====================================================
    const message =
        document.createElement("div");

    message.classList.add(
        "message"
    );

    message.textContent =
        titulo;


    // =====================================================
    // DETALLES
    // =====================================================
    const details =
        document.createElement("div");

    details.classList.add(
        "details"
    );

    details.textContent =
        detalles;


    // =====================================================
    // DIRECCIÓN DE RECOGIDA
    // =====================================================
    const addressRecogida =
        document.createElement("div");

    addressRecogida.classList.add(
        "address"
    );

    addressRecogida.textContent =
        "📍 Recogida: Buscando dirección...";


    // =====================================================
    // DIRECCIÓN DE DESTINO
    // =====================================================
    const addressDestino =
        document.createElement("div");

    addressDestino.classList.add(
        "address"
    );

    addressDestino.textContent =
        "🏁 Destino: Buscando dirección...";


    // =====================================================
    // BOTONES
    // =====================================================
    const buttons =
        document.createElement("div");

    buttons.classList.add(
        "buttons"
    );


    // =====================================================
    // BOTÓN ACEPTAR
    // =====================================================
    const acceptButton =
        document.createElement("button");

    acceptButton.classList.add(
        "accept-button"
    );

    acceptButton.textContent =
        "Aceptar";


    // =====================================================
    // BOTÓN RECHAZAR
    // =====================================================
    const rejectButton =
        document.createElement("button");

    rejectButton.classList.add(
        "reject-button"
    );

    rejectButton.textContent =
        "Rechazar";


    // =====================================================
    // ARMAR BOTONES
    // =====================================================
    buttons.appendChild(
        acceptButton
    );

    buttons.appendChild(
        rejectButton
    );


    // =====================================================
    // ARMAR CONTENIDO
    // =====================================================
    messageContent.appendChild(
        message
    );

    messageContent.appendChild(
        details
    );

    messageContent.appendChild(
        addressRecogida
    );

    messageContent.appendChild(
        addressDestino
    );

    messageContent.appendChild(
        buttons
    );


    // =====================================================
    // ARMAR TARJETA
    // =====================================================
    mensaje.appendChild(
        time
    );

    mensaje.appendChild(
        indicator
    );

    mensaje.appendChild(
        messageContent
    );


    // =====================================================
    // AGREGAR TARJETA AL DOM
    // =====================================================
    contenedor.appendChild(
        mensaje
    );


    // =====================================================
    // MARCADOR DE RECOGIDA
    // =====================================================
    const marcadorRecogida =
        crearMarcadorEmoji(

            "📦",

            id,

            [
                recogidaLng,
                recogidaLat
            ],

            "bottom"

        );


    // =====================================================
    // MARCADOR DE DESTINO
    // =====================================================
    const marcadorDestino =
        crearMarcadorEmoji(

            "📍",

            id,

            [
                destinoLng,
                destinoLat
            ],

            "bottom"

        );


    // =====================================================
    // OBJETO PEDIDO
    // =====================================================
    const pedido = {

        id:
            id,

        titulo:
            titulo,

        detalles:
            detalles,

        prioridad:
            prioridad,

        tiempo:
            tiempo,


        // ================================================
        // RECOGIDA
        // ================================================
        recogidaLat:
            recogidaLat,

        recogidaLng:
            recogidaLng,


        // ================================================
        // DESTINO
        // ================================================
        destinoLat:
            destinoLat,

        destinoLng:
            destinoLng,


        // ================================================
        // ELEMENTOS
        // ================================================
        mensaje:
            mensaje,

        marcadorRecogida:
            marcadorRecogida,

        marcadorDestino:
            marcadorDestino,


        // ================================================
        // TIMER
        // ================================================
        timer:
            null,


        // ================================================
        // ESTADO
        // ================================================
        aceptado:
            false
    };


    // =====================================================
    // GUARDAR PEDIDO
    // =====================================================
    pedidosActivos.add(
        pedido
    );


    // =====================================================
    // GUARDAR REFERENCIA
    // =====================================================
    mensaje.pedido =
        pedido;


    // =====================================================
    // OBTENER DIRECCIÓN DE RECOGIDA
    // =====================================================
    obtenerDireccion(
        recogidaLat,
        recogidaLng
    )

    .then(
        direccion => {

            addressRecogida.textContent =
                "📍 Recogida: " +
                direccion;

        }
    )

    .catch(
        error => {

            console.error(
                error
            );

            addressRecogida.textContent =
                "📍 Recogida: Dirección no disponible";

        }
    );


    // =====================================================
    // OBTENER DIRECCIÓN DE DESTINO
    // =====================================================
    obtenerDireccion(
        destinoLat,
        destinoLng
    )

    .then(
        direccion => {

            addressDestino.textContent =
                "🏁 Destino: " +
                direccion;

        }
    )

    .catch(
        error => {

            console.error(
                error
            );

            addressDestino.textContent =
                "🏁 Destino: Dirección no disponible";

        }
    );


    // =====================================================
    // TIMER
    // =====================================================
    let tiempoRestante =
        tiempo;


    time.style.width =
        "100%";


    time.style.transition =
        `width ${tiempo}s linear`;


    setTimeout(
        () => {

            time.style.width =
                "0%";

        },
        50
    );


    pedido.timer =
        setInterval(
            () => {

                tiempoRestante--;

                if (
                    tiempoRestante <= 0
                ) {

                    eliminarPedido(
                        pedido
                    );

                }

            },
            1000
        );


    // =====================================================
    // ACEPTAR
    // =====================================================
    acceptButton.addEventListener(
        "click",
        () => {

            aceptarPedido(
                pedido,
                acceptButton
            );

        }
    );


    // =====================================================
    // RECHAZAR
    // =====================================================
    rejectButton.addEventListener(
        "click",
        () => {

            rechazarPedido(
                pedido
            );

        }
    );


// =====================================================
// CLICK EN TARJETA
// CENTRAR REPARTIDOR + RECOGIDA + DESTINO
// =====================================================
mensaje.addEventListener(
    "click",
    evento => {

        // =============================================
        // SI PICÓ UN BOTÓN, NO CENTRAR
        // =============================================
        if (
            evento.target.tagName ===
            "BUTTON"
        ) {
            return;
        }
        // =============================================
        // CENTRAR LOS 3 ELEMENTOS
        // =============================================
        enfocarPedidoCompleto(
            pedido
        );
    }
);
    return mensaje;
}


// =========================================================
// ENFOCAR REPARTIDOR + RECOGIDA + DESTINO
// =========================================================
function enfocarPedidoCompleto(
    pedido
) {

    // =====================================================
    // VERIFICAR REPARTIDOR
    // =====================================================
    if (
        !ubicacionRepartidor
    ) {

        console.error(
            "No existe ubicación del repartidor."
        );

        return;
    }


    // =====================================================
    // CREAR BOUNDS
    // =====================================================
    const bounds =
        new maplibregl.LngLatBounds();


    // =====================================================
    // REPARTIDOR
    // ubicacionRepartidor = [lng, lat]
    // =====================================================
    bounds.extend(
        ubicacionRepartidor
    );


    // =====================================================
    // RECOGIDA
    // =====================================================
    bounds.extend([

        pedido.recogidaLng,
        pedido.recogidaLat

    ]);


    // =====================================================
    // DESTINO
    // =====================================================
    bounds.extend([

        pedido.destinoLng,
        pedido.destinoLat

    ]);


    // =====================================================
    // AJUSTAR MAPA
    // =====================================================
    map.fitBounds(

        bounds,

        {

            padding: {
                top: 50,
                bottom: 250,
                left: 40,
                right: 40
            },


            maxZoom:
                15,

            duration:
                1200

        }

    );
}


// =========================================================
// ACEPTAR PEDIDO
// =========================================================
async function aceptarPedido(
    pedidoAceptado,
    acceptButton
) {

    console.log(
        "Pedido aceptado:",
        pedidoAceptado
    );


    // =====================================================
    // VERIFICAR QUE EXISTE REPARTIDOR
    // =====================================================
    if (
        !ubicacionRepartidor
    ) {

        alert(
            "Primero selecciona la ubicación " +
            "del repartidor en el mapa."
        );

        return;
    }

    if (
        pedidoAceptado.aceptando
    ) {
        return;
    }

    pedidoAceptado.aceptando = true;
    acceptButton.disabled = true;
    acceptButton.textContent = "Aceptando...";


    // =====================================================
    // ENVIAR DATOS A FLASK
    // =====================================================
    try {

        const respuesta =
            await fetch(
                "/api/pedido/aceptar",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            // =================================
                            // ID
                            // =================================
                            pedido_id:
                                pedidoAceptado.id,


                            // =================================
                            // REPARTIDOR
                            // =================================
                            repartidor: {

                                lat:
                                    ubicacionRepartidor[1],

                                lng:
                                    ubicacionRepartidor[0]

                            },


                            // =================================
                            // RECOGIDA
                            // =================================
                            recogida: {

                                lat:
                                    pedidoAceptado.recogidaLat,

                                lng:
                                    pedidoAceptado.recogidaLng

                            },


                            // =================================
                            // DESTINO
                            // =================================
                            destino: {

                                lat:
                                    pedidoAceptado.destinoLat,

                                lng:
                                    pedidoAceptado.destinoLng

                            }

                        })

                }
            );


        // =================================================
        // VERIFICAR RESPUESTA
        // =================================================
        if (
            !respuesta.ok
        ) {

            throw new Error(
                "Error enviando pedido al servidor."
            );

        }


        const datos =
            await respuesta.json();


        console.log(
            "Respuesta de Flask:",
            datos
        );

    }

    catch (error) {

        console.error(
            "No se pudo aceptar el pedido:",
            error
        );

        pedidoAceptado.aceptando = false;
        acceptButton.disabled = false;
        acceptButton.textContent = "Aceptar";


        // =================================================
        // NO CONTINUAR SI FLASK FALLA
        // =================================================
        return;
    }


    // =====================================================
    // ELIMINAR LOS DEMÁS PEDIDOS
    // =====================================================
    pedidosActivos.forEach(
        pedido => {

            if (
                pedido !==
                pedidoAceptado
            ) {

                eliminarPedido(
                    pedido
                );

            }

        }
    );


    // =====================================================
    // MARCAR COMO ACEPTADO
    // =====================================================
    pedidoAceptado.aceptado =
        true;


    // =====================================================
    // DETENER TIMER
    // =====================================================
    if (
        pedidoAceptado.timer
    ) {

        clearInterval(
            pedidoAceptado.timer
        );

        pedidoAceptado.timer =
            null;
    }


    // =====================================================
    // ELIMINAR TARJETA
    // =====================================================
    if (
        pedidoAceptado.mensaje
    ) {

        pedidoAceptado.mensaje.remove();

    }


    // =====================================================
    // LIMPIAR LISTA
    // =====================================================
    pedidosActivos.clear();


    pedidosActivos.add(
        pedidoAceptado
    );


    // =====================================================
    // MOSTRAR REPARTIDOR + RECOGIDA + DESTINO
    // =====================================================
    enfocarPedidoCompleto(
        pedidoAceptado
    );


    // =====================================================
    // MOSTRAR INFORMACIÓN
    // =====================================================
    console.log(
        "================================"
    );

    console.log(
        "PEDIDO ACEPTADO"
    );

    console.log(
        "================================"
    );

    console.log(
        "Pedido:",
        pedidoAceptado.id
    );

    console.log(
        "Repartidor:",
        ubicacionRepartidor
    );

    console.log(
        "Recogida:",
        pedidoAceptado.recogidaLat,
        pedidoAceptado.recogidaLng
    );

    console.log(
        "Destino:",
        pedidoAceptado.destinoLat,
        pedidoAceptado.destinoLng
    );
}


// =========================================================
// RECHAZAR PEDIDO
// =========================================================
function rechazarPedido(
    pedido
) {

    console.log(
        "Pedido rechazado:",
        pedido.id
    );


    eliminarPedido(
        pedido
    );
}


// =========================================================
// ELIMINAR PEDIDO
// =========================================================
function eliminarPedido(
    pedido
) {

    // =====================================================
    // DETENER TIMER
    // =====================================================
    if (
        pedido.timer
    ) {

        clearInterval(
            pedido.timer
        );

        pedido.timer =
            null;
    }


    // =====================================================
    // ELIMINAR MARCADOR DE RECOGIDA
    // =====================================================
    if (
        pedido.marcadorRecogida
    ) {

        pedido.marcadorRecogida.remove();

        pedido.marcadorRecogida =
            null;
    }


    // =====================================================
    // ELIMINAR MARCADOR DE DESTINO
    // =====================================================
    if (
        pedido.marcadorDestino
    ) {

        pedido.marcadorDestino.remove();

        pedido.marcadorDestino =
            null;
    }


    // =====================================================
    // ELIMINAR TARJETA
    // =====================================================
    if (
        pedido.mensaje
    ) {

        pedido.mensaje.remove();

        pedido.mensaje =
            null;
    }


    // =====================================================
    // QUITAR DE PEDIDOS ACTIVOS
    // =====================================================
    pedidosActivos.delete(
        pedido
    );
}


// =========================================================
// OBTENER DIRECCIÓN
// =========================================================
async function obtenerDireccion(
    lat,
    lng
) {

    const url =
        `https://nominatim.openstreetmap.org/reverse` +
        `?format=json` +
        `&lat=${lat}` +
        `&lon=${lng}` +
        `&zoom=18` +
        `&addressdetails=1`;


    const respuesta =
        await fetch(
            url
        );


    if (
        !respuesta.ok
    ) {

        throw new Error(
            "No se pudo obtener la dirección."
        );

    }


    const datos =
        await respuesta.json();


    return datos.display_name;
}


// =========================================================
// EJEMPLO DE PEDIDO
// =========================================================
crearPedido({
    id:123,
    prioridad:"#9e1111",
    tiempo:90,
    titulo:"Pedido #123",
    detalles:"Recoger paquete y entregar.",
    // =====================================================
    // 📦 RECOGIDA
    // =====================================================
    recogidaLat:25.6866,
    recogidaLng:-100.3161,
    // =====================================================
    // 📍 DESTINO
    // =====================================================
    destinoLat:25.7000,
    destinoLng:-100.2900
});

crearPedido({
    id:456,
    prioridad:"#53bb0d",
    tiempo:90,
    titulo:"Pedido #123",
    detalles:"Recoger paquete y entregar.",
    // =====================================================
    // 📦 RECOGIDA
    // =====================================================
    recogidaLat:25.6860,
    recogidaLng:-100.3157,
    // =====================================================
    // 📍 DESTINO
    // =====================================================
    destinoLat:25.7300,
    destinoLng:-100.2900
});