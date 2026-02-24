import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from datetime import timedelta
from app.core.supabase_client import supabase

# ============================================================================
# GET HISTORICAL DATA
# ============================================================================
def get_historical_data(plot_id=None, limit=1000):
    """
    Retrieve cleaned historical data from Supabase for forecasting.
    
    Args:
        plot_id (str, optional): Filter data by specific plot (e.g., 'A1'). 
                                 If None, fetches all available data.
        limit (int): Maximum number of rows to fetch (default: 1000)
    
    Returns:
        pd.DataFrame: Historical sensor data with columns:
                      - data_added (timestamp)
                      - cleaned_temperature, cleaned_soil_moisture
                      - plot_id
    """
    query = supabase.table("cleaned_data").select("*")
    
    # Filter by plot if specified
    if plot_id:
        query = query.eq("plot_id", plot_id)
    
    response = query.order("data_added", desc=True).limit(limit).execute()
    data = response.data
    
    if not data:
        return pd.DataFrame()

    df = pd.DataFrame(data)
    df['data_added'] = pd.to_datetime(df['data_added'])
    df = df.sort_values('data_added').reset_index(drop=True)
    
    return df


# ============================================================================
# TRAIN AND PREDICT
# ============================================================================
def train_and_predict(df, sensor, days, plot_id):

    # Step 1: Prepare features
    target_col = f'cleaned_{sensor}'
    if target_col not in df.columns:
        return None, None

    df_model = df.copy()
    df_model['hour'] = df_model['data_added'].dt.hour
    df_model['dayofweek'] = df_model['data_added'].dt.dayofweek
    df_model['lag_1'] = df_model[target_col].shift(1)
    df_model['lag_24'] = df_model[target_col].shift(24)
    
    # Drop NaNs for training
    train_df = df_model.dropna(subset=['hour', 'dayofweek', 'lag_1', 'lag_24', target_col])
    
    if train_df.empty:
        return None, None

    X_train = train_df[['hour', 'dayofweek', 'lag_1', 'lag_24']]
    y_train = train_df[target_col]

    # Step 2: Train model
    model = RandomForestRegressor(
        n_estimators=10,
        max_depth=8,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    # Step 3: Generate predictions
    last_known_timestamp = df['data_added'].iloc[-1]
    future_timestamps = [last_known_timestamp + timedelta(hours=i+1) for i in range(days * 24)]
    
    # Iterative forecasting
    last_values = df[target_col].values
    future_preds = []
    history = list(last_values)
    current_timestamp = last_known_timestamp
    
    for _ in range(days * 24):
        current_timestamp += timedelta(hours=1)
        
        lag_1 = history[-1]
        lag_24 = history[-24] if len(history) >= 24 else history[-1]
        
        features = pd.DataFrame([[
            current_timestamp.hour,
            current_timestamp.dayofweek,
            lag_1,
            lag_24
        ]], columns=['hour', 'dayofweek', 'lag_1', 'lag_24'])
        
        pred_val = model.predict(features)[0]
        future_preds.append(pred_val)
        history.append(pred_val)
    
    return future_timestamps, future_preds


# ============================================================================
# SAVE PREDICTIONS
# ============================================================================
def save_predictions(predictions):
    """
    Save forecast results to Supabase predictions table.
    
    Args:
        predictions: List of forecast dictionaries
    
    Returns:
        bool: True if successful, False otherwise
    """
    if not predictions:
        return False
    
    try:
        # Upsert requires a UNIQUE constraint on the conflict column.
        # Since the user's table might not have it yet, we try INSERT to ensure data is saved.
        # TODO: Recommended to add: ALTER TABLE predictions ADD CONSTRAINT unique_forecast UNIQUE (plot_id, forecast_time);
        
        # First, clean up any existing predictions for these times to avoid duplicates (Manual Upsert)
        # This is a bit safer than blindly inserting if we run this often.
        timestamps = [x["forecast_time"] for x in predictions]
        try:
            # Delete existing rows with these timestamps (Optimization: Do in one query if possible)
            # supabase.table("predictions").delete().in_("forecast_time", timestamps).execute()
            pass # Skipping delete for safety for now, purely appending.
        except:
            pass

        response = supabase.table("predictions").insert(predictions).execute()
        print(f"✅ Successfully saved {len(predictions)} predictions to Supabase.")
        return True
    except Exception as e:
        print(f"⚠️ Failed to save predictions to Supabase: {e}")
        # Fallback debug
        print("Payload was:", predictions[:1])
        return False


# ============================================================================
# MAIN FORECAST GENERATION PIPELINE
# ============================================================================
def generate_forecasts(days: int = 7, plot_id: str = None):
    """
    Generates future forecasts for the specified number of days.
    Orchestrates the complete forecasting workflow.
    
    Args:
        days (int): Number of days to forecast (default: 7)
        plot_id (str, optional): Filter data by specific plot (e.g., 'A1'). 
                                 If None, uses all available data.
    Returns: 
        list of dicts: [{date: '2024-01-01', temperature: 25.5, ...}]
    """
    # Step 1: Get historical data
    df = get_historical_data(plot_id, limit=1000)
    
    if df.empty:
        return []

    sensors = ['temperature', 'soil_moisture']
    forecast_results = {}
    
    # Use first sensor's timestamps for all (they're the same)
    first_timestamps = None

    # Step 2: Train and predict for each sensor
    for sensor in sensors:
        timestamps, predictions = train_and_predict(df, sensor, days, plot_id)
        
        if timestamps is None or predictions is None:
            forecast_results[sensor] = [0] * (days * 24)
        else:
            forecast_results[sensor] = predictions
            if first_timestamps is None:
                first_timestamps = timestamps

    # Use first_timestamps or create default
    if first_timestamps is None:
        last_known_timestamp = df['data_added'].iloc[-1]
        first_timestamps = [last_known_timestamp + timedelta(hours=i+1) for i in range(days * 24)]

    # Step 3: Format and save predictions
    default_plot_id = plot_id if plot_id else 'P001'
    if not df.empty and 'plot_id' in df.columns:
        default_plot_id = df['plot_id'].iloc[0]

    predictions = []
    for i, ts in enumerate(first_timestamps):
        predictions.append({
            "forecast_time": ts.isoformat(),
            "plot_id": default_plot_id,
            "created_at": pd.Timestamp.now().isoformat(),
            "temperature": float(forecast_results['temperature'][i]),
            "soil_moisture": float(forecast_results['soil_moisture'][i])
        })
    
    # Step 4: Save to database
    save_predictions(predictions)

    # Step 5: Return frontend-compatible format
    frontend_output = [
        {
            "date": item["forecast_time"], 
            "temperature": item["temperature"],
            "soil_moisture": item["soil_moisture"]
        } 
        for item in predictions
    ]
        
    return frontend_output


if __name__ == "__main__":
    # Run forecast and insert results
    print("\n🤖 Running forecast and saving to predictions...")
    generate_forecasts(days=7, plot_id=None)
    print("\n✅ Forecasting complete.")
