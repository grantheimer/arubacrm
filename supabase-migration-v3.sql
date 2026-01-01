-- MIGRATION V3: Restructure for Opportunities (Account + Solution pairings)
-- Run this in your Supabase SQL Editor

-- Step 1: Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  health_system_id UUID NOT NULL REFERENCES health_systems(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(health_system_id, product)
);

-- Step 2: Add opportunity_id to contacts (nullable for now)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE;

-- Step 3: Enable RLS on opportunities
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policy for opportunities (allow all for now, same as other tables)
CREATE POLICY "Allow all operations on opportunities" ON opportunities
  FOR ALL USING (true) WITH CHECK (true);

-- Step 5: Clean up old columns (run after migrating data if needed)
-- These can be run after you've verified the new structure works:
-- ALTER TABLE health_systems DROP COLUMN IF EXISTS major_opportunities;
-- ALTER TABLE contacts DROP COLUMN IF EXISTS products;

-- OPTIONAL: If you have existing contacts with products, you can migrate them
-- by creating opportunities and linking contacts. This is a manual process
-- since each contact may need to be assigned to the correct opportunity.

