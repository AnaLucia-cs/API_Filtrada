import os
import json
from google import genai
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("No se encontró GEMINI_API_KEY en el archivo .env")

# Crear cliente de Gemini
client = genai.Client(api_key=api_key)

def analizar_y_explicar(distancia_km, tarifa_mxn, trafico):
    prompt = f"""
    Eres 'The Courier'. Evalúa este pedido: {distancia_km} km por ${tarifa_mxn} MXN. Tráfico: {trafico}.
    Responde estrictamente en formato JSON con dos claves:
    "decision": "ACEPTAR" o "RECHAZAR"
    "explicacion": "Una justificación de máximo 2 líneas sobre la rentabilidad."
    """

    # Llamada al modelo nuevo
    response = client.models.generate_text(
        model="gemini-2.0-flash",
        prompt=prompt
    )

    # Limpiar posibles bloques ```json
    texto = response.text.strip()
    texto = texto.replace("```json", "").replace("```", "").strip()

    return json.loads(texto)
