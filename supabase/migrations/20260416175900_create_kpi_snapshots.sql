-- Create enum for departments
CREATE TYPE project_department AS ENUM ('GESAMT', 'PV', 'WP', 'HAUSTECHNIK');

-- Create KPI snapshots table
CREATE TABLE IF NOT EXISTS public.kpi_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    department project_department NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    active_projects INTEGER DEFAULT 0,
    completed_projects_week INTEGER DEFAULT 0,
    accounting_transferred_count INTEGER DEFAULT 0,
    accounting_transferred_amount DECIMAL(12,2) DEFAULT 0.00,
    open_reworks INTEGER DEFAULT 0,
    scheduled_reworks INTEGER DEFAULT 0,
    open_customer_commitments INTEGER DEFAULT 0,
    scheduled_closings INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure only one snapshot per department per day
    UNIQUE(department, snapshot_date)
);

-- Turn on Row Level Security
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access for authenticated users"
    ON public.kpi_snapshots
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow insert/update for service role (cron jobs / backend)
CREATE POLICY "Allow service role full access"
    ON public.kpi_snapshots
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
