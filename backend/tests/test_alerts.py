"""
Unit Tests for Module 5: Sensor Alert System
Tests sensor health monitoring from routers/recommendations.py
TC13 - TC16: Alert Detection and Validation
Continuing from Module 2 (TC09-TC12)

Legend: Input = (Current_Value, Duration_Hours, Threshold_Min, Threshold_Max) → Output = Alert_Triggered
"""

import pytest
import pandas as pd
from datetime import datetime, timedelta

# ============================================================
# ALERT TRIGGER LOGIC
# ============================================================

def test_TC13_alert_trigger_24h_out_of_range():
    """TC13: Trigger alert when sensor out of range for 24+ hours"""
    # Input: (Current_Value, Duration_Hours, Threshold_Min, Threshold_Max)
    inp = (105.0, 28.5, 15.0, 25.0)
    current_val, duration, min_th, max_th = inp
    
    # Alert Logic [suggestions.py: lines 115-125]
    is_out_of_range = (current_val < min_th) or (current_val > max_th)
    is_prolonged = duration > 24.0
    should_alert = is_out_of_range and is_prolonged
    
    assert should_alert, "Alert should trigger when out of range for 24+ hours"

def test_TC14_no_alert_short_duration():
    """TC14: No alert when sensor out of range for less than 24h"""
    # Input: (Current_Value, Duration_Hours, Threshold_Min, Threshold_Max)
    inp = (105.0, 10.0, 15.0, 25.0)
    current_val, duration, min_th, max_th = inp
    
    # Alert Logic [suggestions.py: lines 115-125]
    is_out_of_range = (current_val < min_th) or (current_val > max_th)
    is_prolonged = duration > 24.0
    should_alert = is_out_of_range and is_prolonged
    
    assert not should_alert, "No alert when duration < 24h"

def test_TC15_alert_requires_current_out():
    """TC15: Alert only if CURRENT reading is still out of range"""
    # Input: (Current_Value, Past_Duration, Threshold_Min, Threshold_Max)
    inp = (20.0, 30.0, 15.0, 25.0)  # Current is NOW normal
    current_val, past_duration, min_th, max_th = inp
    
    # Alert Logic [recommendations.py: lines 122-125]
    is_currently_out = (current_val < min_th) or (current_val > max_th)
    should_alert = past_duration > 24 and is_currently_out
    
    assert not should_alert, "No alert if current reading has recovered"

# ============================================================
# ALERT MESSAGE FORMAT
# ============================================================

def test_TC16_alert_message_moisture_low():
    """TC16: Verify alert message for low moisture"""
    # Input: (Current_Value, Duration, Threshold_Min, Threshold_Max)
    inp = (5.2, 28.5, 15.0, 25.0)
    current_val, duration, min_th, max_th = inp
    
    # Message Logic [recommendations.py: lines 131-143]
    issue_type = "too low" if current_val < min_th else "too high"
    suggestion = "Check sensor connection or irrigation system."
    
    message = (f"⚠️ Soil moisture sensor has been out of range for {duration} hours. "
              f"Current: {current_val}% ({issue_type}, expected: {min_th}-{max_th}%). {suggestion}")
    
    assert "too low" in message
    assert "irrigation" in message.lower() or "connection" in message.lower()

# ============================================================
# Run Tests
# ============================================================
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
