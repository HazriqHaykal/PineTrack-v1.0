from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.core.supabase_client import supabase
from app.schemas.task_eval_thresholds import TaskEvalThresholdUpdate, TaskEvalThresholds
from app.services.task_eval_threshold_service import TASK_EVAL_DEFAULTS, get_task_eval_thresholds_payload

router = APIRouter(prefix="/api/config", tags=["configuration"])


def _validate_payload(payload: TaskEvalThresholdUpdate) -> None:
    if payload.soil_moisture_min < 0 or payload.soil_moisture_max < 0:
        raise HTTPException(status_code=400, detail="Soil moisture thresholds must be non-negative")
    if payload.temperature_min < 0 or payload.temperature_max < 0:
        raise HTTPException(status_code=400, detail="Temperature thresholds must be non-negative")
    if payload.rain_mm_min < 0 or payload.rain_mm_heavy < 0:
        raise HTTPException(status_code=400, detail="Rain thresholds must be non-negative")
    if payload.waterlogging_hours < 1:
        raise HTTPException(status_code=400, detail="Waterlogging hours must be at least 1")
    if payload.soil_moisture_min > payload.soil_moisture_max:
        raise HTTPException(status_code=400, detail="Soil moisture min must be <= max")
    if payload.temperature_min > payload.temperature_max:
        raise HTTPException(status_code=400, detail="Temperature min must be <= max")
    if payload.rain_mm_min >= payload.rain_mm_heavy:
        raise HTTPException(status_code=400, detail="Rain threshold must be less than heavy rain threshold")


@router.get("/task-eval-thresholds", response_model=TaskEvalThresholds)
def get_task_eval_thresholds():
    thresholds, row = get_task_eval_thresholds_payload()
    if not row:
        raise HTTPException(status_code=404, detail="No task evaluation thresholds configured")

    merged = {**TASK_EVAL_DEFAULTS, **thresholds}
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "is_active": bool(row.get("is_active", False)),
        "soil_moisture_min": merged["soil_moisture_min"],
        "soil_moisture_max": merged["soil_moisture_max"],
        "temperature_min": merged["temperature_min"],
        "temperature_max": merged["temperature_max"],
        "rain_mm_min": merged["rain_mm_min"],
        "rain_mm_heavy": merged["rain_mm_heavy"],
        "waterlogging_hours": int(merged["waterlogging_hours"]),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


@router.put("/task-eval-thresholds", response_model=TaskEvalThresholds)
def update_task_eval_thresholds(payload: TaskEvalThresholdUpdate):
    _validate_payload(payload)

    active = (
        supabase.table("task_eval_thresholds")
        .select("*")
        .eq("is_active", True)
        .order("updated_at", desc=True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    row = (active.data or [None])[0]
    if not row:
        raise HTTPException(status_code=400, detail="No active task evaluation thresholds row to update")

    row_id = row.get("id")
    if not row_id:
        raise HTTPException(status_code=500, detail="Failed to locate task evaluation thresholds row")

    update_data = {
        "soil_moisture_min": payload.soil_moisture_min,
        "soil_moisture_max": payload.soil_moisture_max,
        "temperature_min": payload.temperature_min,
        "temperature_max": payload.temperature_max,
        "rain_mm_min": payload.rain_mm_min,
        "rain_mm_heavy": payload.rain_mm_heavy,
        "waterlogging_hours": payload.waterlogging_hours,
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = (
        supabase.table("task_eval_thresholds")
        .update(update_data)
        .eq("id", row_id)
        .execute()
    )
    updated = (result.data or [None])[0]
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update task evaluation thresholds")

    return {
        "id": updated.get("id", row_id),
        "name": updated.get("name"),
        "is_active": bool(updated.get("is_active", False)),
        "soil_moisture_min": updated.get("soil_moisture_min"),
        "soil_moisture_max": updated.get("soil_moisture_max"),
        "temperature_min": updated.get("temperature_min"),
        "temperature_max": updated.get("temperature_max"),
        "rain_mm_min": updated.get("rain_mm_min"),
        "rain_mm_heavy": updated.get("rain_mm_heavy"),
        "waterlogging_hours": int(updated.get("waterlogging_hours") or 0),
        "created_at": updated.get("created_at"),
        "updated_at": updated.get("updated_at"),
    }
