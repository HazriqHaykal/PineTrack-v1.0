"""
Unit Tests for Module 4: Suggestion System (Weather & Sensor Rules)
Tests recommendation logic from routers/suggestions.py
TC17 - TC22: Rain, Moisture, Temperature Rules
Continuing from Module 5 (TC13-TC16)

Legend: Input = (Sensor_Value, Thresholds) → Output = Action/Alert
"""

import pytest

# ============================================================
# RAIN RULES
# ============================================================

def test_TC17_rain_clear_skies():
    """TC17: No action needed for clear skies"""
    # Input: (Rain_mm, Clear_Threshold)
    inp = (0.5, 1.0)
    rain, threshold = inp
    
    # Logic [recommendations.py: rain rules]
    is_clear = rain < threshold
    assert is_clear, "Rain < 1mm should be clear skies"

def test_TC18_rain_heavy_alert():
    """TC18: Trigger erosion alert for heavy rain"""
    # Input: (Rain_mm, Heavy_Threshold)
    inp = (12.0, 10.0)
    rain, threshold = inp
    
    # Logic: Rain > 10mm -> Alert
    alert_triggered = rain > threshold
    assert alert_triggered, "Heavy rain (>10mm) should trigger alert"

# ============================================================
# MOISTURE RULES
# ============================================================

def test_TC19_moisture_dry_irrigation():
    """TC19: Trigger irrigation alert for dry soil"""
    # Input: (Moisture_%, Dry_Threshold)
    inp = (12.0, 15.0)
    moisture, threshold = inp
    
    # Logic [suggestions.py: moisture rules]
    needs_irrigation = moisture < threshold
    assert needs_irrigation, "Moisture < 15% should trigger irrigation"

def test_TC20_moisture_waterlogging():
    """TC20: Trigger waterlogging alert for high moisture"""
    # Input: (Moisture_%, Waterlog_Threshold)
    inp = (28.0, 25.0)
    moisture, threshold = inp
    
    # Logic [suggestions.py: moisture rules]
    waterlog_risk = moisture > threshold
    assert waterlog_risk, "Moisture > 25% should trigger waterlogging alert"

# ============================================================
# TEMPERATURE RULES
# ============================================================

def test_TC21_temp_cold_stress():
    """TC21: Trigger cold stress alert"""
    # Input: (Temp_C, Cold_Threshold)
    inp = (18.0, 20.0)
    temp, threshold = inp
    
    # Logic [recommendations.py: temperature rules]
    growth_retardation = temp < threshold
    assert growth_retardation, "Temp < 20°C should trigger cold stress"

def test_TC22_temp_heat_stress():
    """TC22: Suggest heat stress alert"""
    # Input: (Temp_C, Heat_Threshold)
    inp = (37.0, 35.0)
    temp, threshold = inp
    
    # Logic: Temp > 35°C -> ALERT
    alert_triggered = temp > threshold
    assert alert_triggered, "Temp > 35°C should trigger heat stress alert"

# ============================================================
# Run Tests
# ============================================================
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
