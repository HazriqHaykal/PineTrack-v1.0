"""
Main entry point for PineTrack backend application.

- Creates FastAPI app instance
- Registers all API routers
- Configures middleware (CORS, etc.)
- Starts the backend server

Frontend communicates with this file via HTTP requests.
"""

from datetime import datetime
import logging
import os

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError
from app.routers.authentication import router as auth_router
from app.routers.analytics import router as analytics_router
from app.core.supabase_client import supabase
from app.routers.workers import router as workers_router
from app.routers import schedule
from app.routers import plots
from app.routers import tasks
from app.routers import recommendations
from app.routers import config
from app.routers import users
from app.routers import task_eval_thresholds


app = FastAPI(title="PineTrack Backend")
logger = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def _scheduler_enabled() -> bool:
    value = os.getenv("ENABLE_EVAL_SCHEDULER", "true").strip().lower()
    return value not in ("0", "false", "no", "off")


def _fetch_plots_for_evaluation():
    try:
        response = supabase.table("plots").select("id").execute()
        return response.data or []
    except APIError:
        response = supabase.table("plots").select("id").execute()
        return response.data or []


def _run_scheduled_task_evaluation():
    tz = pytz.timezone("Asia/Kuala_Lumpur")
    today = datetime.now(tz).date()
    plots = _fetch_plots_for_evaluation()
    total_updated = 0
    evaluated = 0

    for plot in plots:
        plot_id = plot.get("id")
        if not plot_id:
            continue
        try:
            result = schedule.evaluate_status_threshold_core(
                plot_id=plot_id,
                target_date=today,
                plot_id_for_sensor=plot_id,
                reschedule_days=2,
            )
            total_updated += int(result.get("updated", 0) or 0)
            evaluated += 1
        except Exception:
            logger.exception("Scheduled evaluation failed for plot_id=%s", plot_id)

    logger.info(
        "Scheduled evaluation summary: plots=%s updated=%s",
        evaluated,
        total_updated,
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(analytics_router)
app.include_router(config.router)
app.include_router(task_eval_thresholds.router)

@app.get("/api/health")
def health():
    return {"ok": True, "message": "Backend is running ✅"}

@app.get("/api/db-test")
def db_test():
    # Change "plots" to any table you definitely have
    res = supabase.table("plots").select("*").limit(1).execute()
    return {
        "ok": True,
        "count": len(res.data or []),
        "sample": res.data
    }

app.include_router(workers_router)
app.include_router(schedule.router)
app.include_router(plots.router)
app.include_router(tasks.router)
app.include_router(recommendations.router)
app.include_router(users.router)

@app.on_event("startup")
def start_scheduler():
    global _scheduler
    if not _scheduler_enabled():
        logger.info("Task evaluation scheduler disabled via ENABLE_EVAL_SCHEDULER")
        return
    if _scheduler:
        return

    tz = pytz.timezone("Asia/Kuala_Lumpur")
    _scheduler = BackgroundScheduler(timezone=tz)
    for hour in (6, 10, 14, 18):
        _scheduler.add_job(
            _run_scheduled_task_evaluation,
            CronTrigger(hour=hour, minute=0, timezone=tz),
            id=f"task_eval_{hour}",
            replace_existing=True,
        )
    _scheduler.start()
    logger.info("Task evaluation scheduler started for 06:00, 10:00, 14:00, 18:00")


@app.on_event("shutdown")
def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Task evaluation scheduler stopped")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=5001, reload=True)
