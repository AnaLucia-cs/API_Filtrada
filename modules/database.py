import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def obtener_conexion():
    # Esto busca tu URL segura en el archivo .env sin exponer tu contraseña en GitHub
    database_url = os.getenv("DATABASE_URL")
    return psycopg2.connect(database_url)

def init_db():
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        
        # 1. Tu tabla original de telemetría (ubicación, gasolina, ganancias)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS telemetry_logs (
                id SERIAL PRIMARY KEY,
                tick INT NOT NULL,
                agent_id VARCHAR(50) NOT NULL,
                lat DOUBLE PRECISION NOT NULL,
                lon DOUBLE PRECISION NOT NULL,
                net_earnings NUMERIC(10, 2) NOT NULL,
                fuel_spent NUMERIC(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 2. La nueva tabla para el historial de decisiones de Gemini
        cur.execute('''
            CREATE TABLE IF NOT EXISTS historial_viajes (
                id SERIAL PRIMARY KEY,
                distancia_km FLOAT,
                tarifa_mxn FLOAT,
                trafico VARCHAR(50),
                decision_ia VARCHAR(20),
                explicacion TEXT,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        conn.commit()
        cur.close()
        conn.close()
        print("Tablas 'telemetry_logs' e 'historial_viajes' inicializadas correctamente.")
    except Exception as e:
        print(f"Error inicializando la base de datos: {e}")

def insert_telemetry(tick, agent_id, lat, lon, net_earnings, fuel_spent):
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO telemetry_logs (tick, agent_id, lat, lon, net_earnings, fuel_spent)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (tick, agent_id, lat, lon, net_earnings, fuel_spent))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error guardando telemetría en TigerData: {e}")

def guardar_pedido(distancia, tarifa, trafico, decision, explicacion):
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()
        cursor.execute('''
            INSERT INTO historial_viajes (distancia_km, tarifa_mxn, trafico, decision_ia, explicacion)
            VALUES (%s, %s, %s, %s, %s)
        ''', (distancia, tarifa, trafico, decision, explicacion))
        conexion.commit()
        cursor.close()
        conexion.close()
    except Exception as e:
        print(f"Error guardando el pedido en TigerData: {e}")

if __name__ == "__main__":
    init_db()