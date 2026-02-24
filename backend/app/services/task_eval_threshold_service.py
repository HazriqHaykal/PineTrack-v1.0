from typing import Any, Dict, Optional, Tuple
import logging

from app.core.supabase_client import supabase

logger = logging.getLogger(__name__)

TASK_EVAL_DEFAULTS: Dict[str, float] = {
    "soil_moisture_min": 15.0,
    "soil_moisture_max": 25.0,
    "temperature_min": 22.0,
    "temperature_max": 32.0,
    "rain_mm_min": 2.0,
    "rain_mm_heavy": 10.0,
    "waterlogging_hours": 24.0,
}


def _normalize_row(row: Optional[Dict[str, Any]]) -> Dict[str, float]:
    if not row:
        return {}

    keys = [
        "soil_moisture_min",
        "soil_moisture_max",
        "temperature_min",
        "temperature_max",
        "rain_mm_min",
        "rain_mm_heavy",
        "waterlogging_hours",
    ]
    thresholds: Dict[str, float] = {}
    for key in keys:
        value = row.get(key)
        if value is not None:
            thresholds[key] = value
    return thresholds


def _fetch_active_or_latest() -> Optional[Dict[str, Any]]:
    try:
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
        if row:
            return row

        latest = (
            supabase.table("task_eval_thresholds")
            .select("*")
            .order("updated_at", desc=True)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return (latest.data or [None])[0]
    except Exception as exc:
        logger.warning("Failed to fetch task_eval_thresholds: %s", exc)
        return None


def get_task_eval_thresholds_payload() -> Tuple[Dict[str, float], Optional[Dict[str, Any]]]:
    row = _fetch_active_or_latest()
    thresholds = _normalize_row(row)
    return thresholds, row
