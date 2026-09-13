import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("No se encontró GEMINI_API_KEY en el archivo .env")

genai.configure(api_key=api_key)

def analizar_y_explicar(distancia_km, tarifa_mxn, trafico):
    prompt = f"""
    Eres 'The Courier', un asistente inteligente para repartidores. Evalúa este pedido:
    - Distancia: {distancia_km} km
    - Tarifa: ${tarifa_mxn} MXN
    - Tráfico: {trafico}
    
    Responde estrictamente en formato JSON con estas claves:
    "decision": "ACEPTAR" o "RECHAZAR",
    "explicacion": "Una justificación de máximo 2 líneas sobre la rentabilidad y conveniencia.",
    "color": "Usa '#28a745' si es muy conveniente/verde, '#ffc107' si es moderado/amarillo, o '#dc3545' si no es conveniente/rojo."
    """

    model = genai.GenerativeModel(
        model_name="gemini-3.8-flash",
        generation_config={"response_mime_type": "application/json"}
    )

    response = model.generate_content(prompt)
    return json.loads(response.text)