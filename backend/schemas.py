from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class WardBase(BaseModel):
    id: str
    name: str
    capacity: int

class Ward(WardBase):
    class Config:
        from_attributes = True

class DailyCensusBase(BaseModel):
    date: date
    ward_id: str
    occupancy: int

class DailyCensus(DailyCensusBase):
    id: int
    class Config:
        from_attributes = True

class ForecastBase(BaseModel):
    run_date: date
    target_date: date
    ward_id: str
    p10: float
    p50: float
    p90: float
    model_version: str

class Forecast(ForecastBase):
    id: int
    class Config:
        from_attributes = True

class AlertBase(BaseModel):
    date: date
    ward_id: str
    severity: str
    reason_1: Optional[str] = None
    reason_2: Optional[str] = None
    reason_3: Optional[str] = None
    recommendation: Optional[str] = None
    is_acknowledged: bool = False

class Alert(AlertBase):
    id: int
    class Config:
        from_attributes = True
