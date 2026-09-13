# OptiDrive - By Se Nos Filtró la API

Plataforma inteligente de optimización operativa, evaluación de rentabilidad en tiempo real y telemetría para repartidores y flotas de última milla.

---

## Desafío (The Courier)

En la economía de entregas bajo demanda, los repartidores enfrentan una fuerte asimetría de información: disponen de 10 segundos para evaluar pedidos basándose únicamente en la tarifa bruta ofrecida por la aplicación. Esta dinámica oculta variables críticas como:

* Tráfico pesado y tiempos muertos en ralentí.
* Costo real de combustible y depreciación vehicular por kilómetro.
* Retornos en vacío desde zonas de baja demanda.

**OptiDrive** actúa como un copiloto financiero y operativo que calcula el margen neto real de cada solicitud antes de aceptarla, justificando en lenguaje natural por qué conviene o no realizar el viaje.

---

## Características Principales

* **Evaluación de Rentabilidad Neta:** Analiza pedidos dinámicos cruzando distancia, tarifa ofrecida y condiciones de tráfico en tiempo real.


* **Inteligencia Artificial Explicable (XAI):** Integra Google Gemini para generar explicaciones transparentes y recomendaciones accionables (`ACEPTAR` o `RECHAZAR`).


* **Persistencia y Series de Tiempo:** Registra la telemetría del vehículo (`telemetry_logs`) y el historial de decisiones tomadas por la IA (`historial_viajes`) en PostgreSQL.


* **Simulación Logística:** Incorpora motores de optimización de rutas y cumplimiento de contratos de entrega.


* **Interfaz de Control:** Dashboard interactivo con mapas en tiempo real, gestión de perfiles y ajustes de operación.



---

## Arquitectura y Stack Tecnológico

* **Infraestructura:** VPS Ubuntu en Vultr, proxy inverso con Nginx y dominio personalizado (`optidrive.tech`).
* **Backend:** Python 3, Flask, `python-dotenv`, `pytest`.


* **Motor de IA:** Google Gemini API vía `google-genai` / `google-generativeai`.


* **Base de Datos:** PostgreSQL (TigerData) conectado con `psycopg2-binary`.


* **Frontend:** HTML5, CSS3, JavaScript nativo con peticiones asíncronas (`fetch`) y Jinja2.



---

## Estructura del Proyecto

```text
API_Filtrada/
├── app.py                      # Punto de entrada del servidor Flask y definición de rutas
├── requirements.txt            # Dependencias del proyecto
├── pedido.json                 # Carga de prueba de solicitud de entrega
├── pedido_aceptado.json        # Datos de simulación de orden en curso
├── modules/                    # Módulos de lógica de negocio
│   ├── __init__.py
│   ├── contract.py             # Lógica y validación de contratos de entrega
│   ├── database.py             # Conexión a TigerData y esquemas SQL
│   ├── explainer.py            # Integración con Gemini API para evaluación de pedidos
│   ├── optimizer.py            # Cálculo de eficiencia operativa y costos
│   └── simulation.py           # Simulación de telemetría y desplazamientos (ticks)
├── static/                     # Archivos estáticos de frontend
│   ├── general.css             # Estilos globales y diseño responsivo
│   └── js.js                   # Lógica de mapas, eventos y consumo de API
├── templates/                  # Vistas Jinja2
│   ├── home.html               # Vista principal con el mapa interactivo y métricas
│   ├── profile.html            # Vista de perfil del repartidor y estadísticas
│   └── configuracion.html      # Parámetros operativos y preferencias del sistema
└── tests/                      # Suite de pruebas automatizadas
    └── test_app.py             # Pruebas unitarias de endpoints y lógica de la app

```

---

## Configuración e Instalación

### 1. Requisitos Previos

* Python 3.10 o superior.
* Servidor PostgreSQL (TigerData).
* API Key de Google Gemini.

### 2. Clonar el Repositorio

```bash
git clone https://github.com/analucia-cs/api_filtrada.git
cd api_filtrada

```

### 3. Entorno Virtual y Dependencias

```bash
# Crear entorno virtual
python3 -m venv venv

# Activar en Linux/macOS
source venv/bin/activate

# Activar en Windows PowerShell
# .\venv\Scripts\Activate.ps1

# Instalar paquetes requeridos
pip install -r requirements.txt
pip install psycopg2-binary python-dotenv google-genai google-generativeai

```

### 4. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con la siguiente estructura:

```env
PORT=5000
DATABASE_URL="postgresql://tsdbadmin:TU_PASSWORD@TU_HOST:TU_PUERTO/tsdb?sslmode=require"
GEMINI_API_KEY="AIzaSy..."

```

---

## Ejecución

### Desarrollo Local

```bash
python3 app.py

```

Accede desde el navegador en `http://localhost:5000`.

### Despliegue en Servidor (Vultr + Nginx)

Para mantener el proceso activo en segundo plano dentro del VPS:

```bash
screen -S courier
source venv/bin/activate
python3 app.py

```

Desacopla la sesión presionando **`Ctrl + A`** y luego **`D`**. Con Nginx configurado hacia `[http://127.0.0.1:5000](http://127.0.0.1:5000)`, la aplicación responderá directamente en `[http://optidrive.tech](http://optidrive.tech)`.

---

## Endpoints de la API

* `GET /`: Carga la interfaz principal con el mapa (`home.html`).


* `GET /perfil`: Despliega las métricas históricas del operador (`profile.html`).


* `GET /configuracion`: Panel de ajustes del sistema (`configuracion.html`).


* `POST /api/evaluar`: Recibe variables de un pedido y retorna la decisión asistida por IA junto a su explicación.


* **Payload esperado:**
```json
{
  "distancia_km": 8.5,
  "tarifa_mxn": 95.0,
  "trafico": "Alto"
}

```


* **Respuesta:**
```json
{
  "status": "success",
  "decision": "RECHAZAR",
  "explicacion": "El margen operativo proyectado es inferior al umbral mínimo debido al costo de combustible bajo congestión alta."
}

```





---

## Pruebas Automatizadas

Ejecuta la suite de pruebas unitarias con:

```bash
pytest tests/test_app.py

```




