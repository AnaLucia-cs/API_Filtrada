import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def obtener_conexion():
    database_url = os.getenv("DATABASE_URL")
    return psycopg2.connect(database_url)

def init_db():
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        
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
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(50) PRIMARY KEY,
                pickup_lat DOUBLE PRECISION NOT NULL,
                pickup_lon DOUBLE PRECISION NOT NULL,
                dropoff_lat DOUBLE PRECISION NOT NULL,
                dropoff_lon DOUBLE PRECISION NOT NULL,
                payout_mxn NUMERIC(10, 2) NOT NULL,
                decision_ia VARCHAR(20),
                explicacion TEXT,
                color_prioridad VARCHAR(20) DEFAULT '#28a745'
            );
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        print("Tablas inicializadas correctamente.")
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
        print(f"Error guardando telemetría: {e}")

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
        print(f"Error guardando en historial_viajes: {e}")

def guardar_orden(order, decision_ia=None, explicacion=None, color_prioridad='#28a745'):
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO orders (id, pickup_lat, pickup_lon, dropoff_lat, dropoff_lon, payout_mxn, decision_ia, explicacion, color_prioridad)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING;
        """, (
            order.id,
            order.pickup.lat,
            order.pickup.lon,
            order.dropoff.lat,
            order.dropoff.lon,
            order.payout_mxn,
            decision_ia,
            explicacion,
            color_prioridad
        ))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error guardando orden: {e}")

def obtener_pedidos_pendientes():
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, pickup_lat, pickup_lon, dropoff_lat, dropoff_lon, payout_mxn, decision_ia, explicacion, color_prioridad 
            FROM orders;
        """)
        filas = cur.fetchall()
        cur.close()
        conn.close()

        pedidos = []
        for f in filas:
            pedidos.append({
                "id": f[0],
                "pickupLat": f[1],
                "pickupLon": f[2],
                "dropoffLat": f[3],
                "dropoffLon": f[4],
                "tarifa": float(f[5]),
                "decisionIa": f[6],
                "explicacion": f[7],
                "prioridad": f[8] or '#28a745'
            })
        return pedidos
    except Exception as e:
        print(f"Error al obtener órdenes: {e}")
        return []

if __name__ == "__main__":
    init_db()