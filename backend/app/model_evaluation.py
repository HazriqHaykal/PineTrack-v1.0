"""
Model Evaluation Module
=======================
This module contains functions for evaluating forecasting model performance.
Used for testing and validation, not required for production forecasting.
"""

import pandas as pd
import math
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from app.forecasting import get_historical_data


# ============================================================================
# EVALUATE MODEL PERFORMANCE
# ============================================================================
def evaluate_model(df, sensor):
    """
    Evaluate model performance on historical data using train/test split.
    
    Args:
        df: Historical data
        sensor: Sensor name (e.g., 'temperature', 'soil_moisture')
    
    Returns:
        dict: Evaluation metrics (RMSE, MAE, R2) or None if evaluation fails
    """
    print(f"\n📊 --- Evaluating Model for: {sensor.upper()} ---")
    
    target_col = f'cleaned_{sensor}'
    if target_col not in df.columns:
        print(f"Skipping {sensor}: Not found.")
        return None

    # Feature Engineering
    df_model = df.copy()
    df_model['hour'] = df_model['data_added'].dt.hour
    df_model['dayofweek'] = df_model['data_added'].dt.dayofweek
    df_model['lag_1'] = df_model[target_col].shift(1)
    df_model['lag_24'] = df_model[target_col].shift(24)
    
    # Drop NaNs
    df_model = df_model.dropna(subset=['hour', 'dayofweek', 'lag_1', 'lag_24', target_col])

    if df_model.empty:
        print("Not enough data.")
        return None

    X = df_model[['hour', 'dayofweek', 'lag_1', 'lag_24']]
    y = df_model[target_col]

    # Train/Test Split (Time-based, not random)
    train_size = int(len(df_model) * 0.8)
    X_train, X_test = X.iloc[:train_size], X.iloc[train_size:]
    y_train, y_test = y.iloc[:train_size], y.iloc[train_size:]

    # Train
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # Predict on Test set
    y_pred = model.predict(X_test)

    # Calculate Metrics
    mse = mean_squared_error(y_test, y_pred)
    rmse = math.sqrt(mse)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print(f"   RMSE (Root Mean Sq Error): {rmse:.4f}")
    print(f"   MAE (Mean Abs Error):      {mae:.4f}")
    print(f"   R-Squared Score:           {r2:.4f}")
    
    return {
        'rmse': rmse,
        'mae': mae,
        'r2': r2
    }


# ============================================================================
# FORECAST EVALUATION PIPELINE
# ============================================================================
def forecast_pipeline():
    """
    Pipeline for model evaluation on historical data.
    Calculates and prints performance metrics (RMSE, MAE, R2).
    """
    print("🤖 Starting AI Forecasting Pipeline (Evaluation Mode)...")

    # Step 1: Fetch historical training data
    print("Fetching historical training data...")
    df = get_historical_data(plot_id=None, limit=2000)
    
    if df.empty:
        print("No training data found in 'cleaned_data'.")
        return

    sensors = ['temperature', 'soil_moisture']
    
    # Step 2: Evaluate model for each sensor
    for sensor in sensors:
        evaluate_model(df, sensor)

    print("\n✅ Evaluation complete.")


if __name__ == "__main__":
    forecast_pipeline()
