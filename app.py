from flask import Flask, jsonify, render_template, request

import json
import os
import requests
import threading
from datetime import datetime
from modules.explainer import analizar_y_explicar
from modules.database import init_db, guardar_pedido


app = Flask(__name__)
# =========================================================
# VARIABLES GLOBALES
# =========================================================
# Último pedido aceptado
pedido_aceptado = None
# Lista de condiciones activas
condiciones = []
# =========================================================
# ARCHIVOS JSON
# =========================================================
ARCHIVO_PEDIDO = "pedido_aceptado.json"
ARCHIVO_CONDICIONES = "pedido.json"
# =========================================================
# CARGAR CONDICIONES EXISTENTES
# =========================================================
def cargar_condiciones():
    global condiciones
    # Si no existe el archivo, empezamos con una lista vacía
    if not os.path.exists(ARCHIVO_CONDICIONES):
        condiciones = []
        return
    try:
        with open(
            ARCHIVO_CONDICIONES,
            "r",
            encoding="utf-8"
        ) as archivo:
            datos = json.load(archivo)
        # Verificar que realmente sea una lista
        if isinstance(datos, list):
            condiciones = datos
        else:
            condiciones = []
    except Exception as error:
        print(
            "Error leyendo pedido.json:",
            error
        )
        condiciones = []
# =========================================================
# GUARDAR CONDICIONES
# =========================================================
def guardar_condiciones():
    try:
        with open(
            ARCHIVO_CONDICIONES,
            "w",
            encoding="utf-8"
        ) as archivo:
            json.dump(
                condiciones,
                archivo,
                indent=4,
                ensure_ascii=False
            )
        return True
    except Exception as error:
        print(
            "Error guardando condiciones:",
            error
        )
        return False


def completar_calles_pedido(pedido):
    global pedido_aceptado

    ubicaciones = (
        ("repartidor", pedido["repartidor"]),
        ("recogida", pedido["recogida"]),
        ("destino", pedido["destino"])
    )

    for nombre, ubicacion in ubicaciones:
        ubicacion["calle"] = obtener_calle(
            ubicacion["lat"],
            ubicacion["lng"]
        )

    if pedido_aceptado is not pedido:
        return

    try:
        with open(
            ARCHIVO_PEDIDO,
            "w",
            encoding="utf-8"
        ) as archivo:
            json.dump(
                pedido,
                archivo,
                indent=4,
                ensure_ascii=False
            )
    except Exception as error:
        print(
            "Error actualizando calles del pedido:",
            error
        )
# =========================================================
# OBTENER NOMBRE DE LA CALLE
# USANDO NOMINATIM
# =========================================================
def obtener_calle(
    lat,
    lng
):
    url = (
        "https://nominatim.openstreetmap.org/reverse"
        f"?format=json"
        f"&lat={lat}"
        f"&lon={lng}"
        f"&zoom=18"
        f"&addressdetails=1"
        f"&accept-language=es"
    )
    headers = {
        "User-Agent":
            "InfoSysChallenge/1.0"
    }
    try:
        respuesta = requests.get(
            url,
            headers=headers,
            timeout=10
        )
        if not respuesta.ok:
            print(
                "Nominatim respondió:",
                respuesta.status_code
            )
            return "Calle no disponible"
        datos = respuesta.json()
    except Exception as error:
        print(
            "Error consultando Nominatim:",
            error
        )
        return "Calle no disponible"
    # =====================================================
    # DIRECCIÓN
    # =====================================================
    address = datos.get(
            "address",
            {}
        )
    # =====================================================
    # BUSCAR NOMBRE DE CALLE
    # =====================================================
    calle = (
        address.get("road")
        or
        address.get("pedestrian")
        or
        address.get("street")
        or
        address.get("residential")
    )
    if calle:
        return calle
    # =====================================================
    # SI NO ENCONTRAMOS "ROAD"
    # USAMOS LA DIRECCIÓN COMPLETA
    # =====================================================
    return datos.get(
        "display_name",
        "Calle no disponible"
    )
# =========================================================
# PÁGINA PRINCIPAL
# =========================================================
@app.get("/")
def index():
    return render_template(
        "home.html"
    )

@app.get("/profile")
def profile():
    return render_template(
        "profile.html"
    )

@app.get("/configuracion")
def configuracion():
    return render_template(
        "configuracion.html"
    )
# =========================================================
# RECIBIR CONDICIÓN DEL MAPA
# =========================================================
@app.post("/api/condicion")
def recibir_condicion():
    global condiciones
    # =====================================================
    # RECIBIR JSON
    # =====================================================
    datos = request.get_json(
            silent=True
        )
    if not datos:
        return jsonify({
            "ok":
                False,
            "error":
                "El cuerpo de la solicitud debe ser JSON."
        }), 400
    # =====================================================
    # OBTENER DATOS
    # =====================================================
    tipo = datos.get("tipo")
    emoji = datos.get("emoji")
    lat = datos.get("lat")
    lng = datos.get("lng")
    # =====================================================
    # VALIDAR
    # =====================================================
    if tipo is None:
        return jsonify({
            "ok":
                False,
            "error":
                "Falta el tipo de condición."
        }), 400
    if lat is None or lng is None:
        return jsonify({
            "ok":
                False,
            "error":
                "Faltan las coordenadas."
        }), 400
    # =====================================================
    # OBTENER CALLE
    # =====================================================
    calle = obtener_calle(
            lat,
            lng
        )
    # =====================================================
    # CREAR ID
    # =====================================================
    id_condicion = int(
            datetime.now().timestamp()
            * 1000
        )
    # =====================================================
    # CREAR OBJETO
    # =====================================================
    condicion = {
        "id":
            id_condicion,
        "tipo":
            tipo,
        "emoji":
            emoji,
        "lat":
            lat,
        "lng":
            lng,
        "calle":
            calle,
        "fecha":
            datetime.now().isoformat()
    }
    # =====================================================
    # AGREGAR A LA LISTA
    # =====================================================
    condiciones.append(
        condicion
    )
    # =====================================================
    # GUARDAR JSON
    # =====================================================
    guardado = guardar_condiciones()
    if not guardado:
        # Si no se pudo guardar,
        # quitamos el elemento de memoria.
        condiciones.pop()
        return jsonify({
            "ok":
                False,
            "error":
                "No se pudo guardar la condición."
        }), 500
    # =====================================================
    # MOSTRAR EN TERMINAL
    # =====================================================
    print()
    print(
        "========================================"
    )
    print(
        "NUEVA CONDICIÓN"
    )
    print(
        "========================================"
    )
    print(
        "ID:",
        id_condicion
    )
    print(
        "Tipo:",
        tipo
    )
    print(
        "Emoji:",
        emoji
    )
    print(
        "Coordenadas:",
        lat,
        lng
    )
    print(
        "Calle:",
        calle
    )
    print(
        "========================================"
    )
    print()
    # =====================================================
    # RESPUESTA A JAVASCRIPT
    # =====================================================
    return jsonify({
        "ok":
            True,
        "mensaje":
            "Condición guardada correctamente.",
        "calle":
            calle,
        "condicion":
            condicion
    })
# =========================================================
# CONSULTAR TODAS LAS CONDICIONES
# =========================================================
@app.get("/api/condiciones")
def obtener_condiciones():
    return jsonify({
        "ok":
            True,
        "condiciones":
            condiciones
    })

# =========================================================
# EVALUAR PEDIDO CON IA (Función recuperada)
# =========================================================
@app.post("/api/evaluar")
def evaluar_pedido():
    datos = request.get_json(silent=True)
    if not datos:
        return jsonify({"ok": False, "error": "Se requiere un JSON válido."}), 400

    distancia_km = datos.get("distancia_km", 0.0)
    tarifa_mxn = datos.get("tarifa_mxn", 0.0)
    trafico = datos.get("trafico", "Normal")

    # Lógica de evaluación o simulación de respuesta de Gemini / IA
    evaluacion = {
        "ok": True,
        "recomendacion": "Aceptar",
        "motivo": f"La distancia es de {distancia_km} km con una tarifa de ${tarifa_mxn} MXN y tráfico {trafico}.",
        "distancia_km": distancia_km,
        "tarifa_mxn": tarifa_mxn
    }

    return jsonify(evaluacion)

# =========================================================
# ACEPTAR PEDIDO
# =========================================================
@app.post("/api/pedido/aceptar")
def aceptar_pedido():
    global pedido_aceptado
    # =====================================================
    # RECIBIR JSON
    # =====================================================
    pedido = request.get_json(
            silent=True
        )
    if not pedido:
        return jsonify({
            "ok":
                False,
            "error":
                "El cuerpo de la solicitud debe ser JSON."
        }), 400
    # =====================================================
    # VERIFICAR CAMPOS
    # =====================================================
    required_fields = (
        "pedido_id",
        "repartidor",
        "recogida",
        "destino"
    )
    missing_fields = [
        field
        for field in required_fields
        if field not in pedido
    ]
    if missing_fields:
        return jsonify({
            "ok":
                False,
            "error":
                "Faltan datos del pedido.",
            "campos_faltantes":
                missing_fields
        }), 400
    # =====================================================
    # ID
    # =====================================================
    pedido_id = pedido["pedido_id"]
    # =====================================================
    # REPARTIDOR
    # =====================================================
    repartidor = pedido["repartidor"]
    if (
        "lat" not in repartidor
        or
        "lng" not in repartidor
    ):
        return jsonify({
            "ok":
                False,
            "error":
                "Faltan las coordenadas del repartidor."
        }), 400
    repartidor_lat = repartidor["lat"]
    repartidor_lng = repartidor["lng"]
    # =====================================================
    # RECOGIDA
    # =====================================================
    recogida = pedido["recogida"]
    if (
        "lat" not in recogida
        or
        "lng" not in recogida
    ):
        return jsonify({
            "ok":
                False,
            "error":
                "Faltan las coordenadas de recogida."
        }), 400
    recogida_lat = recogida["lat"]
    recogida_lng = recogida["lng"]
    # =====================================================
    # DESTINO
    # =====================================================
    destino = pedido["destino"]
    if (
        "lat" not in destino
        or
        "lng" not in destino
    ):
        return jsonify({
            "ok":
                False,
            "error":
                "Faltan las coordenadas de destino."
        }), 400
    destino_lat = destino["lat"]
    destino_lng = destino["lng"]
    # =====================================================
    # CREAR PEDIDO
    # =====================================================
    pedido_nuevo = {
        "pedido_id":
            pedido_id,
        "repartidor": {
            "lat":
                repartidor_lat,
            "lng":
                repartidor_lng,
            "calle":
                repartidor.get("calle", "Consultando...")
        },
        "recogida": {
            "lat":
                recogida_lat,
            "lng":
                recogida_lng,
            "calle":
                recogida.get("calle", "Consultando...")
        },
        "destino": {
            "lat":
                destino_lat,
            "lng":
                destino_lng,
            "calle":
                destino.get("calle", "Consultando...")
        }
    }
    # =====================================================
    # GUARDAR EN VARIABLE GLOBAL
    # =====================================================
    pedido_aceptado = pedido_nuevo
    # =====================================================
    # GUARDAR JSON
    # =====================================================
    try:
        with open(
            ARCHIVO_PEDIDO,
            "w",
            encoding="utf-8"
        ) as archivo:
            json.dump(
                pedido_aceptado,
                archivo,
                indent=4,
                ensure_ascii=False
            )
    except Exception as error:
        print(
            "Error guardando pedido:",
            error
        )

    threading.Thread(
        target=completar_calles_pedido,
        args=(pedido_nuevo,),
        daemon=True
    ).start()
    # =====================================================
    # MOSTRAR
    # =====================================================
    print()
    print(
        "========================================"
    )
    print(
        "PEDIDO GUARDADO"
    )
    print(
        "========================================"
    )
    print(
        "ID:",
        pedido_aceptado["pedido_id"]
    )
    print(
        "Repartidor:",
        pedido_aceptado["repartidor"]
    )
    print(
        "Recogida:",
        pedido_aceptado["recogida"]
    )
    print(
        "Destino:",
        pedido_aceptado["destino"]
    )
    print(
        "========================================"
    )
    print()
    # =====================================================
    # RESPUESTA
    # =====================================================
    return jsonify({
        "ok":
            True,
        "mensaje":
            "Pedido aceptado y guardado.",
        "pedido":
            pedido_aceptado
    })
# =========================================================
# CONSULTAR PEDIDO ACEPTADO
# =========================================================
@app.get("/api/pedido/aceptado")
def obtener_pedido_aceptado():
    if pedido_aceptado is None:
        return jsonify({
            "ok":
                False,
            "mensaje":
                "No hay ningún pedido aceptado."
        }), 404
    return jsonify({
        "ok":
            True,
        "pedido":
            pedido_aceptado
    })


# =========================================================
# INICIAR SERVIDOR
# =========================================================

if __name__ == "__main__":
    # Cargar las condiciones que ya existían
    # en pedido.json al arrancar Flask.
    cargar_condiciones()
    app.run(
        debug=True
    )
