-- Ensure communication_messages has the correct foreign key with CASCADE delete
-- Date: 2026-02-22

DO $$
BEGIN
    -- Drop the constraint if it exists (to ensure we recreate it with correct properties)
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'communication_messages_repair_id_fkey'
        AND table_name = 'communication_messages'
    ) THEN
        ALTER TABLE public.communication_messages
        DROP CONSTRAINT communication_messages_repair_id_fkey;
    END IF;

    -- Also check for auto-generated names or other potential FKs on this column
    -- (Optional, but good practice if we want to be clean. For now, let's focus on the named constraint)

    -- Add the constraint with ON DELETE CASCADE
    ALTER TABLE public.communication_messages
    ADD CONSTRAINT communication_messages_repair_id_fkey
    FOREIGN KEY (repair_id)
    REFERENCES public.repairs(id)
    ON DELETE CASCADE;

END $$;
