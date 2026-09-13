from pydantic import BaseModel
from typing import List, Optional

class Coordinates(BaseModel):
    lat: float
    lon: float

class OrderContract(BaseModel):
    id: str
    pickup: Coordinates
    dropoff: Coordinates
    payout_mxn: float
    prep_time_minutes: int
    time_limit_minutes: int
    status: str = "PENDING"

class AgentState(BaseModel):
    agent_id: str
    coords: Coordinates
    net_earnings: float
    fuel_spent: float
    current_order: Optional[OrderContract] = None

class TickResponse(BaseModel):
    tick: int
    shift_remaining_minutes: int
    baseline_agent: AgentState
    smart_agent: AgentState
    available_orders: Optional[List[OrderContract]] = []
