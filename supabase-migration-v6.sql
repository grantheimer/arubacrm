-- MIGRATION V6: Many-to-Many Contact-Opportunity Relationships
-- Run this in your Supabase SQL Editor
--
-- This migration:
-- 1. Creates a junction table for contact-opportunity assignments
-- 2. Migrates existing contact-opportunity relationships to the junction table
-- 3. Adds opportunity_id to outreach_logs for per-opportunity tracking
-- 4. Removes opportunity_id and cadence_days from contacts table
--
-- IMPORTANT: Run this migration in a single transaction to ensure data integrity

BEGIN;

-- Step 1: Create the junction table
CREATE TABLE IF NOT EXISTS contact_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  cadence_days INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, opportunity_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_contact_opportunities_contact ON contact_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_opportunities_opportunity ON contact_opportunities(opportunity_id);

-- Enable RLS and allow all operations (matching existing pattern)
ALTER TABLE contact_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on contact_opportunities" ON contact_opportunities
  FOR ALL USING (true) WITH CHECK (true);

-- Step 2: Migrate existing contact-opportunity relationships
-- Copy current assignments from contacts table to junction table
INSERT INTO contact_opportunities (contact_id, opportunity_id, cadence_days)
SELECT id, opportunity_id, COALESCE(cadence_days, 10)
FROM contacts
WHERE opportunity_id IS NOT NULL
ON CONFLICT (contact_id, opportunity_id) DO NOTHING;

-- Step 3: Add opportunity_id to outreach_logs
ALTER TABLE outreach_logs ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;

-- Create index for filtering logs by opportunity
CREATE INDEX IF NOT EXISTS idx_outreach_logs_opportunity ON outreach_logs(opportunity_id);

-- Step 4: Backfill outreach_logs.opportunity_id from contacts' original opportunity_id
-- This preserves historical context of which opportunity each outreach was for
UPDATE outreach_logs ol
SET opportunity_id = c.opportunity_id
FROM contacts c
WHERE ol.contact_id = c.id
  AND ol.opportunity_id IS NULL
  AND c.opportunity_id IS NOT NULL;

-- Step 5: Drop old columns from contacts table
-- First drop the foreign key constraint if it exists
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_opportunity_id_fkey;

-- Now drop the columns
ALTER TABLE contacts DROP COLUMN IF EXISTS opportunity_id;
ALTER TABLE contacts DROP COLUMN IF EXISTS cadence_days;

COMMIT;

-- Verification queries (run these after migration to verify data integrity):
--
-- Check junction table has expected rows:
-- SELECT COUNT(*) FROM contact_opportunities;
--
-- Check all contacts still exist:
-- SELECT COUNT(*) FROM contacts;
--
-- Check outreach logs have opportunity_id backfilled:
-- SELECT COUNT(*) as total, COUNT(opportunity_id) as with_opp_id FROM outreach_logs;
--
-- Sample junction data:
-- SELECT co.*, c.name as contact_name, o.product
-- FROM contact_opportunities co
-- JOIN contacts c ON co.contact_id = c.id
-- JOIN opportunities o ON co.opportunity_id = o.id
-- LIMIT 10;
