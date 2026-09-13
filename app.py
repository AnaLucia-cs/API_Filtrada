
from flask import Flask, jsonify, render_template, request
import json
import os
import requests
import threading
import math
from datetime import datetime

from modules.explainer import analizar_y_explicar
from modules.database import (
    init_db,
    guardar_pedido,
    obtener_pedidos_pendientes,
)


app = Flask(__name__)

# =========================================================
# VARIABLES GLOBALES
# =========================================================

pedido_aceptado = None
condiciones = []
ubicacion_conductor = None

ARCHIVO_PEDIDO = "pedido_aceptado.json"
ARCHIVO_CONDICIONES = "pedido.json"


# =========================================================
# CARGAR Y GUARDAR CONDICIONES
# =========================================================

def cargar_condiciones():
    global condiciones

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

        condiciones = datos if isinstance(datos, list) else []

    except Exception as error:
        print("Error leyendo pedido.json:", error)
        condiciones = []


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
        print("Error guardando condiciones:", error)
        return False


# =========================================================
# OBTENER NOMBRE DE CALLE
# =========================================================

def obtener_calle(lat, lng):

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
        "User-Agent": "InfoSysChallenge/1.0"
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
        print("Error consultando Nominatim:", error)
        return "Calle no disponible"

    address = datos.get("address", {})

    calle = (
        address.get("road")
        or address.get("pedestrian")
        or address.get("street")
        or address.get("residential")
    )

    if calle:
        return calle

    return datos.get(
        "display_name",
        "Calle no disponible"
    )


# =========================================================
# COMPLETAR CALLES DEL PEDIDO ACEPTADO
# =========================================================

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
# PÁGINAS
# =========================================================

@app.get("/")
def index():
    return render_template("home.html")


@app.get("/profile")
def profile():
    return render_template("profile.html")


@app.get("/configuracion")
def configuracion():
    return render_template("configuracion.html")


# =========================================================
# API: UBICACIÓN DEL CONDUCTOR
# =========================================================

@app.post("/api/conductor/ubicacion")
def guardar_ubicacion_conductor():

    global ubicacion_conductor

    datos = request.get_json(silent=True)

    if not datos:
        return jsonify({
            "ok": False,
            "error": "El cuerpo debe ser JSON."
        }), 400

    lat = datos.get("lat")
    lng = datos.get("lng")

    try:
        lat = float(lat)
        lng = float(lng)

    except (TypeError, ValueError):
        return jsonify({
            "ok": False,
            "error": "Coordenadas inválidas."
        }), 400

    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return jsonify({
            "ok": False,
            "error": "Coordenadas fuera de rango."
        }), 400

    ubicacion_conductor = {
        "lat": lat,
        "lng": lng,
        "fecha": datetime.now().isoformat()
    }

    print("Ubicación del conductor:", ubicacion_conductor)

    return jsonify({
        "ok": True,
        "ubicacion": ubicacion_conductor
    })


@app.get("/api/conductor/ubicacion")
def obtener_ubicacion_conductor():

    if ubicacion_conductor is None:
        return jsonify({
            "ok": False,
            "mensaje": "El conductor aún no ha seleccionado ubicación."
        }), 404

    return jsonify({
        "ok": True,
        "ubicacion": ubicacion_conductor
    })


# =========================================================
# API: PEDIDOS
# =========================================================

@app.get("/api/pedidos")
def api_pedidos():

    # El backend no entrega pedidos si no hay conductor.
    if ubicacion_conductor is None:
        return jsonify({
            "ok": False,
            "error": "Primero selecciona la ubicación del conductor.",
            "pedidos": []
        }), 403

    pedidos = obtener_pedidos_pendientes()

    return jsonify({
        "ok": True,
        "pedidos": pedidos
    }), 200


# =========================================================
# API: CONDICIONES
# =========================================================

@app.post("/api/condicion")
def recibir_condicion():

    global condiciones

    datos = request.get_json(silent=True)

    if not datos:
        return jsonify({
            "ok": False,
            "error": "El cuerpo de la solicitud debe ser JSON."
        }), 400

    tipo = datos.get("tipo")
    emoji = datos.get("emoji")
    lat = datos.get("lat")
    lng = datos.get("lng")

    if tipo is None:
        return jsonify({
            "ok": False,
            "error": "Falta el tipo de condición."
        }), 400

    if lat is None or lng is None:
        return jsonify({
            "ok": False,
            "error": "Faltan las coordenadas."
        }), 400

    calle = obtener_calle(lat, lng)

    id_condicion = int(
        datetime.now().timestamp() * 1000
    )

    condicion = {
        "id": id_condicion,
        "tipo": tipo,
        "emoji": emoji,
        "lat": lat,
        "lng": lng,
        "calle": calle,
        "fecha": datetime.now().isoformat()
    }

    condiciones.append(condicion)

    guardado = guardar_condiciones()

    if not guardado:
        condiciones.pop()

        return jsonify({
            "ok": False,
            "error": "No se pudo guardar la condición."
        }), 500

    print("\n========================================")
    print("NUEVA CONDICIÓN")
    print("========================================")
    print("ID:", id_condicion)
    print("Tipo:", tipo)
    print("Emoji:", emoji)
    print("Coordenadas:", lat, lng)
    print("Calle:", calle)
    print("========================================\n")

    return jsonify({
        "ok": True,
        "mensaje": "Condición guardada correctamente.",
        "calle": calle,
        "condicion": condicion
    })


@app.get("/api/condiciones")
def obtener_condiciones():

    return jsonify({
        "ok": True,
        "condiciones": condiciones
    })


# =========================================================
# API: EVALUAR PEDIDO CON IA
# =========================================================

@app.post("/api/evaluar")
def evaluar_pedido():

    datos = request.get_json(silent=True)

    if not datos:
        return jsonify({
            "ok": False,
            "error": "Se requiere un JSON válido."
        }), 400

    distancia_km = datos.get("distancia_km", 0.0)
    tarifa_mxn = datos.get("tarifa_mxn", 0.0)
    trafico = datos.get("trafico", "Normal")

    evaluacion = {
        "ok": True,
        "recomendacion": "Aceptar",
        "motivo": (
            f"La distancia es de {distancia_km} km "
            f"con una tarifa de ${tarifa_mxn} MXN "
            f"y tráfico {trafico}."
        ),
        "distancia_km": distancia_km,
        "tarifa_mxn": tarifa_mxn
    }

    return jsonify(evaluacion)


# =========================================================
# API: ACEPTAR PEDIDO
# =========================================================

@app.post("/api/pedido/aceptar")
def aceptar_pedido():

    global pedido_aceptado

    if ubicacion_conductor is None:
        return jsonify({
            "ok": False,
            "error": "Primero selecciona la ubicación del conductor."
        }), 403

    pedido = request.get_json(silent=True)

    if not pedido:
        return jsonify({
            "ok": False,
            "error": "El cuerpo de la solicitud debe ser JSON."
        }), 400

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
            "ok": False,
            "error": "Faltan datos del pedido.",
            "campos_faltantes": missing_fields
        }), 400

    pedido_id = pedido["pedido_id"]

    repartidor = pedido["repartidor"]
    recogida = pedido["recogida"]
    destino = pedido["destino"]

# Tarifa del pedido
    tarifa = pedido.get("tarifa", 0.0)

    try:
        tarifa = float(tarifa)
    except (TypeError, ValueError):
        tarifa = 0.0
    

    for nombre, ubicacion in (
        ("repartidor", repartidor),
        ("recogida", recogida),
        ("destino", destino)
    ):
        if (
            "lat" not in ubicacion
            or "lng" not in ubicacion
        ):
            return jsonify({
                "ok": False,
                "error": f"Faltan coordenadas de {nombre}."
            }), 400

    pedido_nuevo = {
    "pedido_id": pedido_id,

    "tarifa": tarifa,

    "repartidor": {
            "lat": repartidor["lat"],
            "lng": repartidor["lng"],
            "calle": repartidor.get(
                "calle",
                "Consultando..."
            )
        },

        "recogida": {
            "lat": recogida["lat"],
            "lng": recogida["lng"],
            "calle": recogida.get(
                "calle",
                "Consultando..."
            )
        },

        "destino": {
            "lat": destino["lat"],
            "lng": destino["lng"],
            "calle": destino.get(
                "calle",
                "Consultando..."
            )
        }
    }

    pedido_aceptado = pedido_nuevo

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
        print("Error guardando pedido:", error)

    threading.Thread(
        target=completar_calles_pedido,
        args=(pedido_nuevo,),
        daemon=True
    ).start()

    print("\n========================================")
    print("PEDIDO GUARDADO")
    print("========================================")
    print("ID:", pedido_aceptado["pedido_id"])
    print("Repartidor:", pedido_aceptado["repartidor"])
    print("Recogida:", pedido_aceptado["recogida"])
    print("Destino:", pedido_aceptado["destino"])
    print("========================================\n")

    return jsonify({
        "ok": True,
        "mensaje": "Pedido aceptado y guardado.",
        "pedido": pedido_aceptado
    })


@app.get("/api/pedido/aceptado")
def obtener_pedido_aceptado():

    if pedido_aceptado is None:
        return jsonify({
            "ok": False,
            "mensaje": "No hay ningún pedido aceptado."
        }), 404

    return jsonify({
        "ok": True,
        "pedido": pedido_aceptado
    })


# =========================================================
# API: EVITAR OBSTÁCULO
# =========================================================

def calcular_distancia_pto_a_linea(p_obs, p_ruta):

    return math.sqrt(
        (p_obs[0] - p_ruta[0]) ** 2
        + (p_obs[1] - p_ruta[1]) ** 2
    )


@app.post("/api/evitar-obstaculo")
def evitar_obstaculo():

    data = request.get_json(silent=True) or {}

    obstaculo = data.get("obstaculo")
    rutas = data.get("rutas", [])

    if not obstaculo or not rutas:
        return jsonify({
            "status": "error",
            "mejor_ruta": None
        }), 400

    obs_coords = [
        obstaculo["lng"],
        obstaculo["lat"]
    ]

    mejor_ruta = None
    max_distancia_al_obs = -1

    for ruta in rutas:

        puntos = ruta["geometry"]["coordinates"]
        min_dist_a_obs = float("inf")

        for punto in puntos:

            dist = calcular_distancia_pto_a_linea(
                obs_coords,
                punto
            )

            if dist < min_dist_a_obs:
                min_dist_a_obs = dist

        if min_dist_a_obs > max_distancia_al_obs:
            max_distancia_al_obs = min_dist_a_obs
            mejor_ruta = ruta

    if not mejor_ruta and rutas:
        mejor_ruta = rutas[0]

    return jsonify({
        "status": "ok",
        "mejor_ruta": mejor_ruta
    })


# =========================================================
# INICIAR SERVIDOR
# =========================================================

if __name__ == "__main__":

    cargar_condiciones()

    try:
        init_db()
    except Exception as error:
        print("No se pudo inicializar la base de datos:", error)

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )