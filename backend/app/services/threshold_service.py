from typing import Any, Dict, Optional, Tuple
import logging

from app.core.supabase_client import supabase

logger = logging.getLogger(__name__)

DEFAULT_THRESHOLDS: Dict[str, float] = {
    "temperature_min": 24.0,
    "temperature_max": 32.0,
    "soil_moisture_min": 40.0,
    "soil_moisture_max": 70.0,
}


def _normalize_threshold_row(row: Optional[Dict[str, Any]]) -> Dict[str, float]:
    if not row:
        return {}

    thresholds: Dict[str, float] = {}

    direct_keys = [
        "temperature_min",
        "temperature_max",
        "soil_moisture_min",
        "soil_moisture_max",
        "nitrogen_min",
        "nitrogen_max",
        "ph_min",
        "ph_max",
    ]
    for key in direct_keys:
        value = row.get(key)
        if value is not None:
            thresholds[key] = value

    mapping = {
        "moisture_min": "soil_moisture_min",
        "moisture_max": "soil_moisture_max",
        "nitrogen_min": "nitrogen_min",
        "nitrogen_max": "nitrogen_max",
        "ph_min": "ph_min",
        "ph_max": "ph_max",
    }
    for src, dest in mapping.items():
        value = row.get(src)
        if value is not None and dest not in thresholds:
            thresholds[dest] = value

    return thresholds


def _fetch_latest_threshold_row(name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    try:
        query = supabase.table("thresholds").select("*")
        if name:
            logger.info("Threshold profile name ignored for thresholds table: %s", name)
        response = query.order("updated_at", desc=True).limit(1).execute()
    except Exception as exc:
        logger.warning("Failed to fetch thresholds: %s", exc)
        return None

    return (response.data or [None])[0]


def get_active_threshold_payload(
    name: Optional[str] = None,
) -> Tuple[Dict[str, float], Optional[Dict[str, Any]]]:
    row = _fetch_latest_threshold_row(name)
    thresholds = _normalize_threshold_row(row)
    return thresholds, row


def get_active_thresholds(name: Optional[str] = None) -> Dict[str, float]:
    thresholds, _ = get_active_threshold_payload(name)
    return thresholds
