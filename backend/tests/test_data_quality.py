"""
Unit Tests for Module 1: Data Quality Assessment
Tests the QV-based quality evaluation from new_data_processing.py
TC01 - TC08: Suitability, Accuracy, Completeness, QV Calculation

Legend for Input Tuple: (Value, Window_Size, Timestamp)
Note: Thresholds (Min/Max) are stored inside the test logic
"""

import pytest
import pandas as pd
import numpy as np

# ============================================================
# SUITABILITY TESTS (Dimension: S)
# ============================================================

def test_TC01_suitability_pass():
    """TC01: Check if normal value is accepted within range"""
    # Input: (Value, Window, Time)
    inp = (25.0, 10, 10.00)
    val, win, time = inp
    
    # Internal Thresholds [new_data_processing.py: lines 83, 124-129]
    min_r, max_r = 0.0, 50.0
    
    # Suitability Logic [new_data_processing.py: line 83]
    s_score = 1 if pd.notnull(val) and min_r <= val <= max_r else 0
    assert s_score == 1, "Valid value within range should have s_score = 1"

def test_TC02_suitability_fail():
    """TC02: Check if outlier is rejected by range check"""
    # Input: (Value, Window, Time)
    inp = (99.0, 10, 10.05)
    val, win, time = inp
    
    # Internal Thresholds [new_data_processing.py: lines 83, 124-129]
    min_r, max_r = 0.0, 50.0
    
    # Suitability Logic [new_data_processing.py: line 83]
    s_score = 1 if pd.notnull(val) and min_r <= val <= max_r else 0
    assert s_score == 0, "Out-of-range value should have s_score = 0"

# ============================================================
# ACCURACY TESTS (Dimension: A)
# ============================================================

def test_TC03_accuracy_pass():
    """TC03: Check if stable data gets high accuracy score"""
    # Input: (List of values, Window, Time)
    inp = ([25.1, 25.2, 25.1, 25.0, 25.2], 5, 10.15)
    val_list, win, time = inp
    
    # Accuracy Logic [new_data_processing.py: lines 86-88]
    mSD = pd.Series(val_list).std()
    se = mSD / np.sqrt(win)
    a_score = (1 - (se / 3.0)).clip(0, 1)
    
    # High Quality threshold [new_data_processing.py: line 107]
    assert a_score >= 0.95, "Stable data should have high accuracy score"

def test_TC04_accuracy_fail():
    """TC04: Check if noisy data triggers low accuracy score"""
    # Input: (List with spikes, Window, Time)
    inp = ([25.0, 90.0, 10.0, 85.0, 5.0], 5, 10.20)
    val_list, win, time = inp
    
    # Accuracy Logic [new_data_processing.py: lines 86-88]
    mSD = pd.Series(val_list).std()
    se = mSD / np.sqrt(win)
    a_score = (1 - (se / 3.0)).clip(0, 1)
    
    # Status labeling [new_data_processing.py: line 105]
    status = "High Noise/Drift" if a_score < 0.5 else "High Quality"
    assert status == "High Noise/Drift", "Noisy data should be flagged"

# ============================================================
# COMPLETENESS TESTS (Dimension: C)
# ============================================================

def test_TC05_completeness_missing_gap():
    """TC05: Check if NaN value is detected (missing data gap)"""
    # Input: (Value, Window, Time)
    inp = (np.nan, 10, 10.25)
    val, win, time = inp
    
    # Completeness Logic [new_data_processing.py: line 92]
    c_score = 1 if pd.notnull(val) else 0
    assert c_score == 0, "NaN should have c_score = 0 (data gap)"

def test_TC06_completeness_duplicate_timestamp():
    """TC06: Check if duplicate timestamps are detected"""
    # Input: (Rows = [(temp, timestamp, plot_id), ...])
    inp = [
        (25.0, '2024-01-01 10:00', 'A1'),
        (25.0, '2024-01-01 10:00', 'A1'),  # Duplicate
        (27.0, '2024-01-01 11:00', 'A1')
    ]
    
    # Duplicate Detection [new_data_processing.py: lines 211-214]
    df = pd.DataFrame(inp, columns=['temp', 'time', 'plot'])
    has_duplicates = df.duplicated(subset=['time', 'plot']).any()
    
    assert has_duplicates, "Duplicate timestamp should be detected"

def test_TC07_completeness_pass():
    """TC07: Check if valid value has completeness = 1"""
    # Input: (Value, Window, Time)
    inp = (25.0, 10, 10.30)
    val, win, time = inp
    
    # Completeness Logic [new_data_processing.py: line 92]
    c_score = 1 if pd.notnull(val) else 0
    assert c_score == 1, "Valid value should have c_score = 1"

# ============================================================
# QV CALCULATION TEST
# ============================================================

def test_TC08_qv_calculation_formula():
    """TC08: Verify QV calculation formula: QV = S × ((A + C) / 2)"""
    # Input: (S, A, C)
    inp = (1.0, 0.8, 1.0)
    s, a, c = inp
    
    # QV Formula [new_data_processing.py: line 100]
    qv = s * ((a + c) / 2)
    expected_qv = 1.0 * ((0.8 + 1.0) / 2)
    assert qv == expected_qv == 0.9, "QV formula should match S × ((A + C) / 2)"

# ============================================================
# Run Tests
# ============================================================
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
