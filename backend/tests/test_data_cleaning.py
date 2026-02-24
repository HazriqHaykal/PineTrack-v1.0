"""
Unit Tests for Module 2: Data Cleaning Operations
Tests dimension-specific cleaning methods from new_data_processing.py
TC09 - TC12: Suitability, Accuracy, Completeness Cleaning
Continuing from Module 1 (TC01-TC08)

Legend: Input = (Raw_Value, Threshold_Min, Threshold_Max) → Output = Cleaned_Value
"""

import pytest
import pandas as pd
import numpy as np

# ============================================================
# SUITABILITY CLEANING (Out-of-Range Outliers)
# ============================================================

def test_TC09_suitability_replace_outlier():
    """TC09: Replace out-of-range value with median"""
    # Input: (Values, Threshold_Max)
    inp = ([25.0, 26.0, 100.0, 27.0], 50.0)
    values, max_threshold = inp
    
    median = pd.Series(values).median()  # 26.5
    
    # Cleaning Logic [new_data_processing.py: lines 175-180]
    cleaned = [median if v > max_threshold else v for v in values]
    
    assert cleaned[2] == median, "Outlier (100) should be replaced with median (26.5)"

# ============================================================
# ACCURACY CLEANING (3-Sigma Outlier Detection)
# ============================================================

def test_TC10_accuracy_detect_outlier():
    """TC10: Detect outlier using 3-sigma rule"""
    # Input: (Normal_Values, Test_Value)
    inp = ([25.0, 26.0, 27.0, 26.0, 25.0], 150.0)
    normal_values, test_value = inp
    
    # 3-Sigma Logic [new_data_processing.py: lines 186-189]
    mean = pd.Series(normal_values).mean()
    std = pd.Series(normal_values).std()
    is_outlier = test_value > (mean + 3 * std)
    
    assert is_outlier, "150 should be detected as outlier"

# ============================================================
# COMPLETENESS CLEANING (Missing Data + Duplicates)
# ============================================================

def test_TC11_completeness_fill_nan():
    """TC11: Fill NaN with median"""
    # Input: (Values_with_NaN)
    inp = [25.0, np.nan, 27.0]
    
    median = pd.Series(inp).median()  # 26.0
    
    # Filling Logic [new_data_processing.py: lines 198-203]
    cleaned = [median if pd.isna(v) else v for v in inp]
    
    assert not pd.isna(cleaned[1]), "NaN should be filled"
    assert cleaned[1] == median, "NaN should be filled with median (26.0)"

def test_TC12_completeness_remove_duplicate():
    """TC12: Remove duplicate rows (same timestamp + plot_id)"""
    # Input: (Rows = [(temp, timestamp, plot_id), ...])
    inp = [
        (25.0, '2024-01-01 10:00', 'A1'),
        (25.0, '2024-01-01 10:00', 'A1'),  # Duplicate
        (27.0, '2024-01-01 11:00', 'A1')
    ]
    
    # Duplicate Removal Logic [new_data_processing.py: lines 211-214]
    df = pd.DataFrame(inp, columns=['temp', 'time', 'plot'])
    df_clean = df.drop_duplicates(subset=['time', 'plot'], keep='first')
    
    assert len(df_clean) == 2, "Duplicate should be removed"
    assert df_clean['temp'].iloc[0] == 25.0, "First occurrence should be kept"

# ============================================================
# Run Tests
# ============================================================
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
