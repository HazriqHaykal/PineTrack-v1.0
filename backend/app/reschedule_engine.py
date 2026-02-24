from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd

from app.ai_inference import predict_delay_days
from app.routers.recommendations import generate_insight_recommendations
from app.services.task_eval_threshold_service import get_task_eval_thresholds_payload, TASK_EVAL_DEFAULTS

logger = logging.getLogger(__name__)

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def normalize_weather_df(weather_forecast: List[Dict[str, Any]]) -> pd.DataFrame:
    try:
        df = pd.DataFrame(weather_forecast or [])
    except Exception:
        logger.exception("Failed to build weather DataFrame")
        return pd.DataFrame()

    if df.empty:
        return df

    if "rain" not in df.columns and "precipitation" in df.columns:
        df["rain"] = df["precipitation"]

    if "datetime" not in df.columns:
        if "time" in df.columns:
            df["datetime"] = pd.to_datetime(df["time"], errors="coerce")
        elif "date" in df.columns:
            df["datetime"] = pd.to_datetime(df["date"], errors="coerce")

    if "datetime" in df.columns:
        df["date_str"] = pd.to_datetime(df["datetime"], errors="coerce").dt.strftime("%Y-%m-%d")
    else:
        df["date_str"] = None

    if "rain" in df.columns:
        df["rain"] = pd.to_numeric(df["rain"], errors="coerce").fillna(0.0)
    else:
        df["rain"] = 0.0

    return df


def build_daily_rain_calendar(weather_df: pd.DataFrame) -> Dict[str, float]:
    if weather_df is None or weather_df.empty or "date_str" not in weather_df.columns:
        return {}

    try:
        daily = weather_df.groupby("date_str")["rain"].sum()
        return daily.to_dict()
    except Exception:
        logger.exception("Failed to build rain calendar")
        return {}


def _parse_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        value = value[:10]
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def is_iso_date(value: str) -> bool:
    if not isinstance(value, str):
        return False
    candidate = value[:10]
    if not _ISO_DATE_RE.match(candidate):
        return False
    try:
        datetime.strptime(candidate, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def find_next_clear_day(
    start_date: str,
    calendar: Dict[str, float],
    max_rain: float = 2.0,
    horizon_days: int = 14,
) -> Optional[str]:
    base_date = _parse_date(start_date)
    if not base_date:
        return None

    for offset in range(1, horizon_days + 1):
        candidate = base_date + timedelta(days=offset)
        candidate_str = candidate.isoformat()
        rain_val = float(calendar.get(candidate_str, 0.0) or 0.0)
        if rain_val <= max_rain:
            return candidate_str

    return None


def _get_sensor_value(sensor_summary: Optional[object], key: str) -> float:
    if sensor_summary is None:
        return 0.0
    if isinstance(sensor_summary, dict):
        return float(sensor_summary.get(key) or 0.0)
    return float(getattr(sensor_summary, key, 0.0) or 0.0)


def _append_reason(reason: Optional[str], suffix: str) -> str:
    base = (reason or "").strip()
    if base:
        return f"{base} | {suffix}"
    return suffix


def suggest_date_for_task(
    task: Dict[str, Any],
    sensor_summary: Optional[object],
    weather_calendar: Dict[str, float],
) -> Optional[str]:
    original_date = task.get("original_date") or task.get("task_date")
    base_date = _parse_date(original_date)
    if not base_date:
        return None

    soil_moisture = _get_sensor_value(sensor_summary, "avg_moisture")
    temperature = _get_sensor_value(sensor_summary, "avg_temp")

    base_str = base_date.isoformat()
    rain_today = float(weather_calendar.get(base_str, 0.0) or 0.0)
    rain_next_3d = 0.0
    for offset in range(1, 4):
        next_date = base_date + timedelta(days=offset)
        rain_next_3d += float(weather_calendar.get(next_date.isoformat(), 0.0) or 0.0)

    features = {
        "soil_moisture": soil_moisture,
        "temperature": temperature,
        "rain_today": rain_today,
        "rain_next_3d": rain_next_3d,
        "task_type": str(task.get("type") or "").lower(),
    }

    delay_days = predict_delay_days(features)
    candidate_date = base_date + timedelta(days=delay_days)
    candidate_str = candidate_date.isoformat()

    if float(weather_calendar.get(candidate_str, 0.0) or 0.0) > 2.0:
        return find_next_clear_day(candidate_str, weather_calendar, max_rain=2.0, horizon_days=14)

    return candidate_str


def get_insights_with_real_dates(
    tasks: List[Dict[str, Any]],
    weather_forecast: List[Dict[str, Any]],
    sensor_summary: Optional[object],
) -> List[Dict[str, Any]]:
    weather_df = normalize_weather_df(weather_forecast or [])
    calendar = build_daily_rain_calendar(weather_df)

    # Load thresholds from database
    task_thresholds, _ = get_task_eval_thresholds_payload()
    if not task_thresholds:
        task_thresholds = TASK_EVAL_DEFAULTS

    try:
        recs = generate_insight_recommendations(tasks, weather_df, sensor_summary, task_thresholds)
    except Exception:
        logger.exception("Failed to generate insight recommendations")
        return []

    task_map = {t.get("id"): t for t in tasks or [] if t.get("id")}
    enriched: List[Dict[str, Any]] = []

    for rec in recs or []:
        if not isinstance(rec, dict):
            enriched.append(rec)
            continue

        if rec.get("type") == "RESCHEDULE":
            task_id = rec.get("task_id")
            if task_id and not str(task_id).startswith("trigger_") and rec.get("original_date"):
                task = task_map.get(task_id)
                if task:
                    try:
                        real_date = suggest_date_for_task(task, sensor_summary, calendar)
                    except Exception:
                        logger.exception("Failed to compute AI suggested date for task %s", task_id)
                        real_date = None

                    if real_date:
                        rec["suggested_date"] = real_date
                        rec["reason"] = _append_reason(rec.get("reason"), "AI delay + weather-validated date")
                    else:
                        rec["reason"] = _append_reason(
                            rec.get("reason"),
                            "AI could not find suitable date in horizon",
                        )

        enriched.append(rec)

    return enriched
