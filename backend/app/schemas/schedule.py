from pydantic import BaseModel
from datetime import date
from typing import Literal, Dict, Optional

class GenerateScheduleRequest(BaseModel):
    start_date: date
    plot_id: str
    mode: Literal["overwrite", "append"] = "overwrite"
    horizon_days: int = 120

class EvaluateThresholdStatusRequest(BaseModel):
    plot_id: str
    date: date
    readings: Optional[Dict[str, float]] = None        # e.g. {"soil_moisture": 78}
    thresholds: Optional[Dict[str, float]] = None      # e.g. {"soil_moisture_max": 70}
    reschedule_days: int = 2
    sensor_plot_id: Optional[int] = None  # Optional: specify which plot's sensor data to use
