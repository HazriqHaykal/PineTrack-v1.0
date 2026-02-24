from typing import Optional

from pydantic import BaseModel


class TaskEvalThresholds(BaseModel):
    id: str
    name: Optional[str] = None
    is_active: bool
    soil_moisture_min: float
    soil_moisture_max: float
    temperature_min: float
    temperature_max: float
    rain_mm_min: float
    rain_mm_heavy: float
    waterlogging_hours: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TaskEvalThresholdUpdate(BaseModel):
    soil_moisture_min: float
    soil_moisture_max: float
    temperature_min: float
    temperature_max: float
    rain_mm_min: float
    rain_mm_heavy: float
    waterlogging_hours: int
