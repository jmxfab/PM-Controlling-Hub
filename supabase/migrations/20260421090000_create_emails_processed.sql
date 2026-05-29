-- Create emails_processed table for email classification pipeline
CREATE TABLE IF NOT EXISTS public.emails_processed (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id     TEXT UNIQUE NOT NULL,
    subject        TEXT,
    sender_email   TEXT,
    sender_name    TEXT,
    received_at    TIMESTAMP WITH TIME ZONE,
    body_preview   TEXT,
    full_body      TEXT,
    category       TEXT CHECK (category IN ('info', 'aufgabe', 'dringend')),
    extracted_title   TEXT,
    extracted_summary TEXT,
    extracted_due_date DATE,
    status         TEXT DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'pushed_to_notion')),
    notion_page_id TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast status queries (review UI loads pending emails)
CREATE INDEX idx_emails_processed_status ON public.emails_processed (status, received_at DESC);

-- Enable Row Level Security
ALTER TABLE public.emails_processed ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (cron jobs, API routes)
CREATE POLICY "service_role_full_access"
    ON public.emails_processed
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
