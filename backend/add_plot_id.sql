-- ================================================================
-- Step 1: Add plot_id Support to PineTrack Database
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1.1: Add plot_id column to raw_data
ALTER TABLE public.raw_data 
ADD COLUMN IF NOT EXISTS plot_id TEXT DEFAULT 'A1';

-- 1.2: Add plot_id column to cleaned_data
ALTER TABLE public.cleaned_data 
ADD COLUMN IF NOT EXISTS plot_id TEXT DEFAULT 'A1';

-- 1.3: Add plot_id column to predictions
ALTER TABLE public.predictions 
ADD COLUMN IF NOT EXISTS plot_id TEXT DEFAULT 'A1';

-- 1.4: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_raw_data_plot ON raw_data(plot_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_plot_date ON raw_data(plot_id, data_added);
CREATE INDEX IF NOT EXISTS idx_cleaned_data_plot ON cleaned_data(plot_id);
CREATE INDEX IF NOT EXISTS idx_predictions_plot ON predictions(plot_id);

-- 1.5: Update existing data to have plot_id
-- This assigns all existing data to Plot A1
UPDATE raw_data SET plot_id = 'A1' WHERE plot_id IS NULL;
UPDATE cleaned_data SET plot_id = 'A1' WHERE plot_id IS NULL;
UPDATE predictions SET plot_id = 'A1' WHERE plot_id IS NULL;

-- 1.6: Make plot_id NOT NULL after assigning values
ALTER TABLE raw_data ALTER COLUMN plot_id SET NOT NULL;
ALTER TABLE cleaned_data ALTER COLUMN plot_id SET NOT NULL;
ALTER TABLE predictions ALTER COLUMN plot_id SET NOT NULL;

-- ================================================================
-- VERIFICATION QUERIES (Run these to check if it worked)
-- ================================================================

-- Check raw_data structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'raw_data' AND column_name = 'plot_id';

-- Check if data has plot_id
SELECT plot_id, COUNT(*) as record_count 
FROM raw_data 
GROUP BY plot_id;

-- Check cleaned_data
SELECT plot_id, COUNT(*) as record_count 
FROM cleaned_data 
GROUP BY plot_id;

-- Check predictions
SELECT plot_id, COUNT(*) as record_count 
FROM predictions 
GROUP BY plot_id;

-- ================================================================
-- SUCCESS! Now all tables support multiple plots
-- ================================================================
