from fastapi import APIRouter, HTTPException, Query
from app.core.supabase_client import supabase
from app.forecasting import generate_forecasts
from app.weather_api import get_weather_data, fetch_dashboard_weather
from typing import List, Optional
import time

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"]
)

# --- SIMPLE IN-MEMORY CACHE ---
# Stores the result of generate_forecasts() to avoid re-training models on every refresh.
# Structure: { "data": [...], "timestamp": 1234567890 }
FORECAST_CACHE = {
    "data": None,
    "timestamp": 0,
    "days_param": 0
}
CACHE_DURATION_SECONDS = 21600  # 6 hours (increased for better performance)

@router.get("/weather")
def get_weather_analytics():
    """
    Fetch historical and forecast weather data from Open-Meteo.
    """
    try:
        return get_weather_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/weather/dashboard")
def get_dashboard_weather_data():
    """
    Fetch current weather and 10-day forecast for the dashboard.
    """
    try:
        return fetch_dashboard_weather()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast")
def get_forecast_data(days: int = 7, plot_id: str = None):
    """
    Generate future forecasts using the AI model.
    Args:
        days (int): Number of days to forecast
        plot_id (str, optional): Filter by specific plot (e.g., 'A1')
    Cached for 1 hour to improve performance.
    """
    try:
        # Cap days to prevent timeout
        if days > 90:
            days = 90
        
        # Check Cache
        current_time = time.time()
        if (FORECAST_CACHE["data"] is not None and 
            FORECAST_CACHE["days_param"] == days and
            FORECAST_CACHE.get("plot_id") == plot_id and
            (current_time - FORECAST_CACHE["timestamp"]) < CACHE_DURATION_SECONDS):
            print("🚀 Returning Cached Forecast Data")
            return FORECAST_CACHE["data"]

        plot_msg = f" for plot {plot_id}" if plot_id else ""
        print(f"⚡ Generating New Forecast{plot_msg} (This might take a moment)...")
        data = generate_forecasts(days, plot_id)
        
        # Update Cache
        FORECAST_CACHE["data"] = data
        FORECAST_CACHE["timestamp"] = current_time
        FORECAST_CACHE["days_param"] = days
        FORECAST_CACHE["plot_id"] = plot_id
        
        return data
    except Exception as e:
        print(f"Forecast Error: {e}")
        # If generation fails but we have old cache, maybe return that?
        # For now, just error out.
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
def get_historical_data(days: int = 30, plot_id: str = None):
    """
    Fetch historical data (raw and cleaned) for charts.
    Args:
        days (int): Number of days of history
        plot_id (str, optional): Filter by specific plot (e.g., 'A1')
    """
    try:
        # Limit to reasonable amount: ~24 records/day * days, capped at 500 for performance
        limit = min(days * 24, 500)
        
        query = supabase.table("cleaned_data").select("*")
        
        # Filter by plot if specified
        if plot_id:
            query = query.eq("plot_id", plot_id)
        
        response = query.order("data_added", desc=True).limit(limit).execute()
        
        # Reverse to have chronological order for the chart
        data = response.data[::-1] 
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
