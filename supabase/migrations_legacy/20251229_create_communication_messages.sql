CREATE TABLE IF NOT EXISTS public.communication_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    repair_id UUID REFERENCES public.repairs(id) ON DELETE CASCADE,
    channel TEXT NOT NULL, -- 'email', 'sms', 'whatsapp', 'in_app'
    content TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
    direction TEXT NOT NULL DEFAULT 'outbound', -- 'outbound', 'inbound'
    template_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.communication_messages
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.communication_messages
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
