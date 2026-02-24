from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, Tuple

import joblib
import pandas as pd

logger = logging.getLogger(__name__)

_STATUS_CLASSIFIER = None
_DELAY_PREDICTOR = None


def get_model_paths() -> Dict[str, Path]:
    model_dir = Path(__file__).resolve().parents[1] / "ai_models"
    return {
        "model_dir": model_dir,
        "status_classifier": model_dir / "status_classifier.pkl",
        "delay_predictor": model_dir / "delay_predictor.pkl",
    }


def load_status_classifier():
    global _STATUS_CLASSIFIER
    if _STATUS_CLASSIFIER is None:
        paths = get_model_paths()
        try:
            _STATUS_CLASSIFIER = joblib.load(paths["status_classifier"])
        except Exception:
            logger.exception("Failed to load status classifier model")
            _STATUS_CLASSIFIER = None
    return _STATUS_CLASSIFIER


def load_delay_predictor():
    global _DELAY_PREDICTOR
    if _DELAY_PREDICTOR is None:
        paths = get_model_paths()
        try:
            _DELAY_PREDICTOR = joblib.load(paths["delay_predictor"])
        except Exception:
            logger.exception("Failed to load delay predictor model")
            _DELAY_PREDICTOR = None
    return _DELAY_PREDICTOR


def _build_feature_frame(features: Dict[str, Any]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "soil_moisture": float(features.get("soil_moisture") or 0.0),
                "temperature": float(features.get("temperature") or 0.0),
                "nitrogen": float(features.get("nitrogen") or 0.0),
                "rain_today": float(features.get("rain_today") or 0.0),
                "rain_next_3d": float(features.get("rain_next_3d") or 0.0),
                "task_type": str(features.get("task_type") or ""),
            }
        ]
    )


def predict_ai_status(features: Dict[str, Any]) -> Tuple[str, float]:
    classifier = load_status_classifier()
    if classifier is None:
        return "Proceed", 0.5

    frame = _build_feature_frame(features)
    try:
        pred_label = classifier.predict(frame)[0]
        confidence = 0.5
        if hasattr(classifier, "predict_proba"):
            probs = classifier.predict_proba(frame)
            if probs is not None and len(probs):
                confidence = float(max(probs[0]))
        return str(pred_label), confidence
    except Exception:
        logger.exception("AI status prediction failed")
        return "Proceed", 0.5


def predict_delay_days(features: Dict[str, Any]) -> int:
    predictor = load_delay_predictor()
    if predictor is None:
        return 0

    frame = _build_feature_frame(features)
    try:
        pred = predictor.predict(frame)[0]
    except Exception:
        logger.exception("AI delay prediction failed")
        return 0

    delay = int(round(float(pred)))
    if delay < 0:
        return 0
    if delay > 14:
        return 14
    return delay
