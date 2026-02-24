from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.supabase_client import supabase
from app.services.threshold_service import DEFAULT_THRESHOLDS, get_active_threshold_payload
from typing import Optional

router = APIRouter(
    prefix="/config",
    tags=["configuration"]
)

# --- REQUEST/RESPONSE MODELS ---
class ThresholdUpdate(BaseModel):
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None
    soil_moisture_min: Optional[float] = None
    soil_moisture_max: Optional[float] = None

class ThresholdResponse(BaseModel):
    id: int
    temperature_min: float
    temperature_max: float
    soil_moisture_min: float
    soil_moisture_max: float
    updated_at: str


@router.get("/thresholds", response_model=ThresholdResponse)
def get_thresholds():
    """
    Get current threshold configuration.
    Returns default values if no config exists.
    """
    try:
        thresholds, row = get_active_threshold_payload()
        merged = {**DEFAULT_THRESHOLDS, **thresholds}
        if row:
            updated_at = row.get("created_at") or row.get("updated_at") or ""
            return {
                "id": row.get("id") or 0,
                "temperature_min": merged["temperature_min"],
                "temperature_max": merged["temperature_max"],
                "soil_moisture_min": merged["soil_moisture_min"],
                "soil_moisture_max": merged["soil_moisture_max"],
                "updated_at": updated_at,
            }

        # Return defaults if table is empty
        return {
            "id": 0,
            "temperature_min": DEFAULT_THRESHOLDS["temperature_min"],
            "temperature_max": DEFAULT_THRESHOLDS["temperature_max"],
            "soil_moisture_min": DEFAULT_THRESHOLDS["soil_moisture_min"],
            "soil_moisture_max": DEFAULT_THRESHOLDS["soil_moisture_max"],
            "updated_at": "",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch thresholds: {str(e)}")


@router.put("/thresholds")
def update_thresholds(thresholds: ThresholdUpdate):
    """
    Update threshold configuration.
    Updates the latest record (single source of truth).
    """
    try:
        _, row = get_active_threshold_payload()
        if not row:
            insert_defaults = {
                "temperature_min": DEFAULT_THRESHOLDS["temperature_min"],
                "temperature_max": DEFAULT_THRESHOLDS["temperature_max"],
                "soil_moisture_min": DEFAULT_THRESHOLDS["soil_moisture_min"],
                "soil_moisture_max": DEFAULT_THRESHOLDS["soil_moisture_max"],
            }
            inserted = supabase.table("thresholds").insert(insert_defaults).execute()
            row = (inserted.data or [None])[0] or {}

        row_id = row.get("id")
        if not row_id:
            raise HTTPException(status_code=500, detail="Failed to locate thresholds row")

        base = {
            "temperature_min": row.get("temperature_min", DEFAULT_THRESHOLDS["temperature_min"]),
            "temperature_max": row.get("temperature_max", DEFAULT_THRESHOLDS["temperature_max"]),
            "soil_moisture_min": row.get("soil_moisture_min", DEFAULT_THRESHOLDS["soil_moisture_min"]),
            "soil_moisture_max": row.get("soil_moisture_max", DEFAULT_THRESHOLDS["soil_moisture_max"]),
        }

        update_data = {
            "temperature_min": (
                thresholds.temperature_min
                if thresholds.temperature_min is not None
                else base["temperature_min"]
            ),
            "temperature_max": (
                thresholds.temperature_max
                if thresholds.temperature_max is not None
                else base["temperature_max"]
            ),
            "soil_moisture_min": (
                thresholds.soil_moisture_min
                if thresholds.soil_moisture_min is not None
                else base["soil_moisture_min"]
            ),
            "soil_moisture_max": (
                thresholds.soil_moisture_max
                if thresholds.soil_moisture_max is not None
                else base["soil_moisture_max"]
            ),
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": "api",
        }

        result = supabase.table("thresholds").update(update_data).eq("id", row_id).execute()
        row = (result.data or [None])[0] or {}
        updated_at = row.get("updated_at") or ""
        return {
            "message": "Thresholds updated successfully",
            "data": {
                "id": row.get("id") or row_id or 0,
                "temperature_min": update_data["temperature_min"],
                "temperature_max": update_data["temperature_max"],
                "soil_moisture_min": update_data["soil_moisture_min"],
                "soil_moisture_max": update_data["soil_moisture_max"],
                "updated_at": updated_at,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update thresholds: {str(e)}")


@router.post("/thresholds/reset")
def reset_thresholds():
    """
    Reset thresholds to default values.
    """
    try:
        _, row = get_active_threshold_payload()
        if not row:
            insert_defaults = {
                "temperature_min": DEFAULT_THRESHOLDS["temperature_min"],
                "temperature_max": DEFAULT_THRESHOLDS["temperature_max"],
                "soil_moisture_min": DEFAULT_THRESHOLDS["soil_moisture_min"],
                "soil_moisture_max": DEFAULT_THRESHOLDS["soil_moisture_max"],
            }
            inserted = supabase.table("thresholds").insert(insert_defaults).execute()
            row = (inserted.data or [None])[0] or {}

        row_id = row.get("id")
        if not row_id:
            raise HTTPException(status_code=500, detail="Failed to locate thresholds row")

        default_data = {
            "temperature_min": DEFAULT_THRESHOLDS["temperature_min"],
            "temperature_max": DEFAULT_THRESHOLDS["temperature_max"],
            "soil_moisture_min": DEFAULT_THRESHOLDS["soil_moisture_min"],
            "soil_moisture_max": DEFAULT_THRESHOLDS["soil_moisture_max"],
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": "system",
        }

        result = supabase.table("thresholds").update(default_data).eq("id", row_id).execute()
        row = (result.data or [None])[0] or {}
        updated_at = row.get("updated_at") or ""
        return {
            "message": "Thresholds reset to defaults",
            "data": {
                "id": row.get("id") or row_id or 0,
                "temperature_min": default_data["temperature_min"],
                "temperature_max": default_data["temperature_max"],
                "soil_moisture_min": default_data["soil_moisture_min"],
                "soil_moisture_max": default_data["soil_moisture_max"],
                "updated_at": updated_at,
            },
        }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset thresholds: {str(e)}")
