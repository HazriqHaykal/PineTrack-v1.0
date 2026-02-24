import pandas as pd
import numpy as np
import os
from app.core.supabase_client import supabase #configure supabase client for the sensor data
from app.services.threshold_service import DEFAULT_THRESHOLDS, get_active_thresholds


def get_thresholds():
    """
    Fetch dynamic thresholds from the database.
    Returns default threshold values if table is empty or error occurs.
    """
    try:
        thresholds = get_active_thresholds()
        if thresholds:
            return {**DEFAULT_THRESHOLDS, **thresholds}
    except Exception as e:
        print(f"Warning: Could not fetch thresholds from database: {e}")
    
    # Return default thresholds if database fetch fails
    return DEFAULT_THRESHOLDS.copy()


# ============================================================================
# GET RAW DATA
# ============================================================================
def get_raw_data(plot_id=None):
    if plot_id:
        print(f"Fetching raw data for plot: {plot_id}")
    else:
        print("Fetching all raw data from Supabase...")
    
    # Fetch all data with pagination (Supabase has 1000 row limit per request)
    all_data = []
    limit = 1000  # Supabase default limit
    offset = 0
    
    while True:
        # Build query to fetch rows in chunks of 1000
        query = supabase.table("raw_data").select("*")
        
        # Apply plot filter if specified
        if plot_id:
            query = query.eq("plot_id", plot_id)
        
        # Execute query with pagination
        response = query.range(offset, offset + limit - 1).execute()
        data = response.data
        all_data.extend(data)
        
        # If we got fewer than 1000 rows, we've reached the end
        if len(data) < limit:
            break
            
        offset += limit

    df_raw = pd.DataFrame(all_data)
    
    # Check if we have any data
    if df_raw.empty:
        print("No data found in 'raw_data' table.")
        return df_raw
    
    print(f"Successfully fetched {len(df_raw)} rows.")

    # Convert timestamp to datetime and sort by time
    df_raw['data_added'] = pd.to_datetime(df_raw['data_added'])
    df_raw = df_raw.sort_values('data_added').reset_index(drop=True)
    
    return df_raw


# ============================================================================
# EVALUATE DATA QUALITY
# ============================================================================
def evaluate_data_quality(df, sensor_name, min_range, max_range, m_window, sensitivity=1.0):
    """
    Calculate Quality Value (QV) for sensor data across 3 dimensions:
    1. Suitability: Is the value within realistic bounds?
    2. Accuracy: Is the sensor stable or noisy?
    3. Completeness: Are there missing values or time gaps?
    
    """
    # 1. SUITABILITY SCORE: Check if value is within realistic bounds
    # Score = 1 if value is in range, 0 if out of range or NaN
    s_score = df[sensor_name].apply(lambda v: 1 if pd.notnull(v) and min_range <= v <= max_range else (0 if pd.notnull(v) else 0))
    
    # 2. ACCURACY SCORE: Check if sensor is stable (not noisy/drifting)
    # Uses rolling standard deviation to detect noise
    mSD = df[sensor_name].rolling(window=m_window, min_periods=1).std()
    se = mSD / np.sqrt(m_window)
    a_score = (1 - (se / sensitivity)).clip(0, 1).fillna(1.0)
    
    # 3. COMPLETENESS SCORE: Check for missing values
    # Score = 1 if value exists, 0 if NaN (data gap)
    c_score = df[sensor_name].apply(lambda x: 1 if pd.notnull(x) else 0)
    
    # 4. CALCULATE FINAL QV AND ASSIGN STATUS LABEL
    def get_status(row_idx):
        s, a, c = s_score.iloc[row_idx], a_score.iloc[row_idx], c_score.iloc[row_idx]
        
        # If value is NaN, it's a data gap (QV = 0)
        if pd.isna(df[sensor_name].iloc[row_idx]):
             return 0.0, "Data Gap"
        
        # Calculate QV: if suitability or completeness is 0, QV = 0
        # Otherwise, QV = suitability × average(accuracy, completeness)
        qv = 0.0 if (s == 0 or c == 0) else s * ((a + c) / 2)
        
        # Assign status label based on which dimension failed
        if s == 0: return qv, "Unsuitable Range"
        if c == 0: return qv, "Data Gap"
        if a < 0.5: return qv, "High Noise/Drift"
        return qv, "High Quality" if qv >= 0.75 else "Moderate Quality"

    qv_values, statuses = zip(*[get_status(i) for i in range(len(df))])
    return list(qv_values), list(statuses)


# ============================================================================
# CLEAN DATA BASED ON QUALITY ASSESSMENT
# ============================================================================
def clean_data(df_raw, qv_results):
    print("Applying dimension-specific data cleaning based on QV assessment...")
    df_cleaned = df_raw.copy()
    
    # Track how many issues we fixed in each dimension
    cleaning_stats = {
        'suitability': 0,    # Count of outliers (out-of-range values) cleaned
        'accuracy': 0,       # Count of outliers (noise/drift) cleaned
        'completeness': 0    # Count of missing data filled + duplicates removed
    }
    
    # Define sensors to process
    sensors = ['temperature', 'soil_moisture']
    
    # Process each sensor
    for s in sensors:
        # Calculate statistics for this sensor (used for outlier detection)
        mean, std = df_raw[s].mean(), df_raw[s].std()
        median = df_raw[s].median()
        
        # Skip if no standard deviation (e.g., all values are the same)
        if pd.isna(std):
            continue
        
        # Get the QV statuses for this sensor
        statuses = qv_results[s]['qv_statuses']
        
        print(f"\n  Processing {s.upper()}:")
        
        # Apply cleaning based on the specific quality dimension problem
        for idx, status in enumerate(statuses):
            # Skip high-quality data (no cleaning needed)
            if status == "High Quality":
                continue
            
            value = df_cleaned.loc[idx, s]
            original_value = value
            cleaned = False
            
            # ----------------------------------------------------------------
            # SUITABILITY CLEANING: Fix out-of-range values
            # ----------------------------------------------------------------
            if status == "Unsuitable Range":
                # Replace out-of-range value with median
                df_cleaned.loc[idx, s] = median
                cleaning_stats['suitability'] += 1
                cleaned = True
                print(f"    [SUITABILITY] Row {idx}: {original_value:.2f} -> {median:.2f} (Outlier - out of range)")
            
            # ----------------------------------------------------------------
            # ACCURACY CLEANING: Fix noise/drift outliers
            # ----------------------------------------------------------------
            elif status == "High Noise/Drift":
                # Check if it's a statistical outlier using 3-sigma rule
                is_outlier = (value < (mean - 3*std)) or (value > (mean + 3*std))
                if is_outlier:
                    df_cleaned.loc[idx, s] = median
                    cleaning_stats['accuracy'] += 1
                    cleaned = True
                    print(f"    [ACCURACY] Row {idx}: {original_value:.2f} -> {median:.2f} (Outlier - noise/drift)")
            
            # ----------------------------------------------------------------
            # COMPLETENESS CLEANING: Fill missing data
            # ----------------------------------------------------------------
            elif status == "Data Gap":
                # Fill missing values (NaN) or broken sensor readings (0)
                if pd.isna(value) or value == 0:
                    df_cleaned.loc[idx, s] = median
                    cleaning_stats['completeness'] += 1
                    cleaned = True
                    print(f"    [COMPLETENESS] Row {idx}: {original_value if not pd.isna(original_value) else 'NaN'} -> {median:.2f} (Filled missing data)")
            
            # ----------------------------------------------------------------
            # MODERATE QUALITY: Apply cleaning if necessary
            # ----------------------------------------------------------------
            elif status == "Moderate Quality":
                # Check for statistical outliers
                is_outlier = (value < (mean - 3*std)) or (value > (mean + 3*std))
                # Check for broken sensor (soil moisture = 0 is invalid)
                is_broken_sensor = (s == 'soil_moisture' and value == 0)
                
                if is_outlier:
                    df_cleaned.loc[idx, s] = median
                    cleaning_stats['accuracy'] += 1
                    cleaned = True
                    print(f"    [ACCURACY-MOD] Row {idx}: {original_value:.2f} -> {median:.2f} (Moderate outlier)")
                elif is_broken_sensor:
                    df_cleaned.loc[idx, s] = median
                    cleaning_stats['completeness'] += 1
                    cleaned = True
                    print(f"    [COMPLETENESS-MOD] Row {idx}: {original_value:.2f} -> {median:.2f} (Moderate gap)")
        
        # SAFETY CHECK: If cleaned value is 0 but raw was not 0, revert to raw
        # This prevents accidentally setting valid data to 0
        mask = (df_cleaned[s] == 0) & (df_raw[s] != 0)
        df_cleaned.loc[mask, s] = df_raw.loc[mask, s]
    
    # ----------------------------------------------------------------
    # Remove duplicate rows
    # ----------------------------------------------------------------
    print(f"\n  Removing duplicates (Completeness)...")
    rows_before = len(df_cleaned)
    # Remove exact duplicates based on timestamp + plot_id
    df_cleaned = df_cleaned.drop_duplicates(subset=['data_added', 'plot_id'], keep='first').reset_index(drop=True)
    duplicates_removed = rows_before - len(df_cleaned)
    cleaning_stats['completeness'] += duplicates_removed
    if duplicates_removed > 0:
        print(f"    [COMPLETENESS] Removed {duplicates_removed} duplicate rows")
    
    # Print summary of cleaning operations
    print(f"\n📊 Cleaning Summary:")
    print(f"  - Suitability issues fixed: {cleaning_stats['suitability']} (outliers - out of range)")
    print(f"  - Accuracy issues fixed: {cleaning_stats['accuracy']} (outliers - noise/drift)")
    print(f"  - Completeness issues fixed: {cleaning_stats['completeness']} (missing data + duplicates)")
    print(f"  - Total cleaned: {sum(cleaning_stats.values())}")
    
    # Fill missing device_id if column exists
    if 'device_id' in df_cleaned.columns:
        df_cleaned['device_id'] = df_cleaned['device_id'].ffill().bfill()
    
    return df_cleaned, cleaning_stats


# ============================================================================
# SECTION 5: MAIN DATA PROCESSING PIPELINE
# ============================================================================

def data_processing_pipeline(plot_id=None):
    """
    NEW DATA PROCESSING FLOW (QV-based selective cleaning):
    ========================================================
    Step 1: Fetch raw sensor data from Supabase
    Step 2: Calculate Quality Value (QV) on RAW data FIRST (before any cleaning)
    Step 3: Apply dimension-specific cleaning ONLY to low-quality data:
            - Suitability issues → Clean outliers (out-of-range values)
            - Accuracy issues → Clean outliers (noise/drift)
            - Completeness issues → Fill missing data & remove duplicates
    Step 4: Prepare final dataset with both raw and cleaned values
    Step 5: Upload to Supabase with QV metrics
    
    Args:
        plot_id (str, optional): Filter data by specific plot (e.g., 'A1', 'A2'). 
                                 If None, processes all plots.
    """
    # Step 1: Fetch dynamic thresholds from database
    thresholds = get_thresholds()
    print(f"Using thresholds: {thresholds}")
    
    # Step 2: Fetch raw data from Supabase
    df_raw = get_raw_data(plot_id)
    
    # Check if we have any data
    if df_raw.empty:
        return
    
    # Verify that required sensor columns exist
    print("Checking required columns...")
    required_columns = ['temperature', 'soil_moisture']
    if not all(col in df_raw.columns for col in required_columns):
        print(f"Missing one of the required columns: {required_columns}")
        return
    
    # Step 3: Calculate QV on raw data (before any cleaning)
    print("Running Quality Assessment on raw data...")
    sensors = ['temperature', 'soil_moisture']
    
    # Store QV results for each sensor
    qv_results = {}
    for s in sensors:
        if s == 'temperature':
            # Calculate QV for temperature with its specific thresholds
            qv_values, qv_statuses = evaluate_data_quality(
                df_raw, s,
                thresholds['temperature_min'],
                thresholds['temperature_max'],
                10, 3.0  # window=10, sensitivity=3.0
            )
        else:  # soil_moisture
            # Calculate QV for soil moisture with its specific thresholds
            qv_values, qv_statuses = evaluate_data_quality(
                df_raw, s,
                thresholds['soil_moisture_min'],
                thresholds['soil_moisture_max'],
                10, 2.0  # window=10, sensitivity=2.0
            )
        
        # Store both QV values and status labels for this sensor
        qv_results[s] = {
            'qv_values': qv_values,
            'qv_statuses': qv_statuses
        }
    
    # Step 4: Apply dimension-specific data cleaning
    df_cleaned, cleaning_stats = clean_data(df_raw, qv_results)

    # Step 5: Prepare final dataset and upload
    upload_cleaned_data(df_raw, df_cleaned, qv_results)
    
    print("✅ Success! All data processed and stored.")
    print(f"📊 Cleaned only low-quality data based on QV assessment.")


# ============================================================================
# UPLOAD CLEANED DATA
# ============================================================================
def upload_cleaned_data(df_raw, df_cleaned, qv_results):
    print("Preparing final dataset...")
    
    # Define sensors to include
    sensors = ['temperature', 'soil_moisture']
    
    final_df = df_cleaned.copy()
    
    # Prepare columns with both RAW and CLEANED values
    # This allows us to compare original vs cleaned data later
    for s in sensors:
        final_df[f'{s}_clean'] = df_cleaned[s]  # The cleaned values
        final_df[f'{s}_raw'] = df_raw[s]        # The original raw values
    
    # Ensure plot_id is always filled (replace any NaN with 'UNKNOWN')
    final_df['plot_id'] = final_df['plot_id'].fillna('UNKNOWN')

    # Build records for Supabase upload
    # Prepare list of dictionaries (one per row) for Supabase insertion
    records = []
    
    for i, row in final_df.iterrows():
        # Helper function to clean values for JSON compatibility
        # Converts NaN and Inf to None (null in JSON)
        def clean_val(val):
            return val if pd.notnull(val) and not np.isinf(val) else None

        records.append({
            "plot_id": str(row['plot_id']),
            "data_added": row['data_added'].isoformat(),
            
            # RAW DATA (Original sensor readings)
            "temperature": clean_val(row['temperature_raw']),
            "soil_moisture": clean_val(row['soil_moisture_raw']),
            
            # CLEANED DATA (After dimension-specific cleaning)
            "cleaned_temperature": clean_val(row['temperature_clean']),
            "cleaned_soil_moisture": clean_val(row['soil_moisture_clean']),
            
            # QUALITY METRICS (Calculated on the raw data before cleaning)
            "temperature_qv": qv_results['temperature']['qv_values'][i],
            "temperature_status": qv_results['temperature']['qv_statuses'][i],
            "soil_moisture_qv": qv_results['soil_moisture']['qv_values'][i],
            "soil_moisture_status": qv_results['soil_moisture']['qv_statuses'][i],
        })

    # Upload to Supabase (batched inserts)
    print(f"Uploading {len(records)} rows to 'cleaned_data_test'...")
    
    # Upload in chunks of 500 rows to prevent timeout errors
    chunk_size = 500
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        try:
            supabase.table("cleaned_data_test").insert(chunk).execute()
            print(f"Pushed rows {i} to {i + len(chunk)}")
        except Exception as e:
            print(f"Error at batch {i}: {e}")


# ============================================================================
# GETTER METHODS
# ============================================================================
def get_cleaned_data(plot_id=None, limit=1000):
    print(f"Fetching cleaned data from database...")
    
    query = supabase.table("cleaned_data_test").select("*")
    
    if plot_id:
        query = query.eq("plot_id", plot_id)
    
    response = query.limit(limit).order("data_added", desc=True).execute()
    
    if not response.data:
        print("No cleaned data found.")
        return pd.DataFrame()
    
    df = pd.DataFrame(response.data)
    df['data_added'] = pd.to_datetime(df['data_added'])
    
    print(f"Retrieved {len(df)} cleaned records.")
    return df


if __name__ == "__main__":
    data_processing_pipeline()
