from typing import Any, Dict, Optional
import logging

from postgrest.exceptions import APIError

from app.core.supabase_client import supabase

logger = logging.getLogger(__name__)

_SENSOR_FIELDS_BASE = (
    "device_id, data_added, temperature, soil_moisture, nitrogen, "
    "cleaned_temperature, cleaned_soil_moisture, cleaned_nitrogen"
)
_SENSOR_FIELDS_WITH_PROCESSED = f"{_SENSOR_FIELDS_BASE}, processed_at"


def _execute_latest_query(device_id: int, select_fields: str, order_field: str):
    return (
        supabase.table("cleaned_data")
        .select(select_fields)
        .eq("device_id", device_id)
        .order(order_field, desc=True)
        .limit(1)
        .execute()
    )


def fetch_latest_cleaned_row(device_id: int) -> Optional[Dict[str, Any]]:
    row = None
    has_processed_at = True

    try:
        res = _execute_latest_query(device_id, _SENSOR_FIELDS_WITH_PROCESSED, "data_added")
        row = (res.data or [None])[0]
    except APIError as exc:
        has_processed_at = False
        logger.warning(
            "cleaned_data select with processed_at failed; retrying without processed_at: %s",
            exc,
        )
        res = _execute_latest_query(device_id, _SENSOR_FIELDS_BASE, "data_added")
        row = (res.data or [None])[0]

    if row and row.get("data_added") is None and has_processed_at:
        try:
            fallback_res = _execute_latest_query(
                device_id, _SENSOR_FIELDS_WITH_PROCESSED, "processed_at"
            )
            row = (fallback_res.data or [None])[0] or row
        except APIError as exc:
            logger.warning("cleaned_data processed_at fallback failed: %s", exc)

    return row


def build_latest_sensor_reading(device_id: int) -> Optional[Dict[str, Any]]:
    row = fetch_latest_cleaned_row(device_id)
    if not row:
        return None

    return {
        "device_id": row.get("device_id", device_id),
        "timestamp": row.get("data_added") or row.get("processed_at"),
        "temperature": row.get("cleaned_temperature")
        if row.get("cleaned_temperature") is not None
        else row.get("temperature"),
        "soil_moisture": row.get("cleaned_soil_moisture")
        if row.get("cleaned_soil_moisture") is not None
        else row.get("soil_moisture"),
        "nitrogen": row.get("cleaned_nitrogen")
        if row.get("cleaned_nitrogen") is not None
        else row.get("nitrogen"),
    }
