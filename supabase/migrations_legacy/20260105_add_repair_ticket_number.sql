-- Create sequence for repair tickets
CREATE SEQUENCE IF NOT EXISTS repair_ticket_seq START 1;

-- Add ticket_number column to repairs table
ALTER TABLE public.repairs 
ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE;

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION public.generate_repair_ticket()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        -- Format: REP-000001
        NEW.ticket_number := 'REP-' || LPAD(NEXTVAL('public.repair_ticket_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket number on insert
DROP TRIGGER IF EXISTS generate_repair_ticket_trigger ON public.repairs;
CREATE TRIGGER generate_repair_ticket_trigger
    BEFORE INSERT ON public.repairs
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_repair_ticket();

-- Backfill existing repairs
DO $$
DECLARE 
    r RECORD;
BEGIN
    -- Only update records that don't have a ticket_number yet
    FOR r IN SELECT id FROM public.repairs WHERE ticket_number IS NULL ORDER BY created_at ASC
    LOOP
        UPDATE public.repairs 
        SET ticket_number = 'REP-' || LPAD(NEXTVAL('public.repair_ticket_seq')::TEXT, 6, '0')
        WHERE id = r.id;
    END LOOP;
END $$;
