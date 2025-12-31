-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Health Systems table
CREATE TABLE health_systems (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_role TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  deal_stage TEXT DEFAULT 'prospecting',
  revenue_potential TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outreach Logs table
CREATE TABLE outreach_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  health_system_id UUID REFERENCES health_systems(id) ON DELETE CASCADE,
  contact_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contact_method TEXT NOT NULL CHECK (contact_method IN ('call', 'email', 'meeting')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries on last contact date
CREATE INDEX idx_outreach_logs_health_system_date
ON outreach_logs(health_system_id, contact_date DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE health_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since we're using password-based app auth, not Supabase auth)
CREATE POLICY "Allow all operations on health_systems" ON health_systems
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on outreach_logs" ON outreach_logs
  FOR ALL USING (true) WITH CHECK (true);
