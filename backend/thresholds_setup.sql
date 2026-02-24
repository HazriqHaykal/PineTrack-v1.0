-- ============================================
-- THRESHOLDS TABLE SETUP
-- Stores configurable thresholds for data quality assessment
-- ============================================

CREATE TABLE IF NOT EXISTS thresholds (
    id SERIAL PRIMARY KEY,
    
    -- Temperature thresholds
    temperature_min NUMERIC DEFAULT 0,
    temperature_max NUMERIC DEFAULT 60,
    
    -- Soil Moisture thresholds  
    soil_moisture_min NUMERIC DEFAULT 1,
    soil_moisture_max NUMERIC DEFAULT 100,
    
    -- Metadata
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by TEXT DEFAULT 'system'
);

-- Insert default values
INSERT INTO thresholds (temperature_min, temperature_max, soil_moisture_min, soil_moisture_max)
VALUES (0, 60, 1, 100)
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE thresholds IS 'Stores configurable thresholds for sensor data quality assessment';
