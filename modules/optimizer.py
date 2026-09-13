import math

# Coordenadas de referencia en Monterrey
MONTERREY_POIS = [
    {"name": "Tec de Monterrey", "lat": 25.6514, "lon": -100.2895},
    {"name": "Galerías Monterrey", "lat": 25.6880, "lon": -100.3551},
    {"name": "Plaza Fiesta San Agustín", "lat": 25.6534, "lon": -100.3256},
    {"name": "Obispado", "lat": 25.6728, "lon": -100.3470},
    {"name": "Paseo Santa Lucía", "lat": 25.6710, "lon": -100.3000},
]

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Radio de la Tierra en km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def move_towards(current_lat: float, current_lon: float, target_lat: float, target_lon: float, speed_kmh: float, tick_seconds: int):
    """Calcula la nueva posición del repartidor al avanzar durante 'tick_seconds'."""
    dist_total = haversine_distance_km(current_lat, current_lon, target_lat, target_lon)
    if dist_total == 0:
        return target_lat, target_lon
    
    # Distancia recorrida en este tick
    dist_step = (speed_kmh / 3600.0) * tick_seconds
    if dist_step >= dist_total:
        return target_lat, target_lon
    
    fraction = dist_step / dist_total
    new_lat = current_lat + (target_lat - current_lat) * fraction
    new_lon = current_lon + (target_lon - current_lon) * fraction
    return new_lat, new_lon

import math

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0  # Radio de la Tierra en km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def evaluate_order_profitability(distance_km, payout_mxn, fuel_price_per_liter=24.50, km_per_liter=35.0):
    fuel_cost = (distance_km / km_per_liter) * fuel_price_per_liter
    net_profit = payout_mxn - fuel_cost
    return round(net_profit, 2)
