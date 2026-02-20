-- Enable RLS
ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;

-- Allow public read access to system_settings
DROP POLICY IF EXISTS "Allow public read system settings" ON "public"."system_settings";
CREATE POLICY "Allow public read system settings" ON "public"."system_settings" 
FOR SELECT USING (true);

-- Allow authenticated users to update settings
DROP POLICY IF EXISTS "Allow authenticated update system settings" ON "public"."system_settings";
CREATE POLICY "Allow authenticated update system settings" ON "public"."system_settings" 
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated users to insert (only if they are admin, but for now allow authenticated to simplify)
DROP POLICY IF EXISTS "Allow authenticated insert system settings" ON "public"."system_settings";
CREATE POLICY "Allow authenticated insert system settings" ON "public"."system_settings" 
FOR INSERT TO authenticated WITH CHECK (true);

-- Ensure the 'system' row exists with default values if not present
INSERT INTO "public"."system_settings" (id, company_name, company_email, company_phone, company_address, currency, tax_rate)
VALUES (
  'system', 
  'Mi Empresa (Supabase)', 
  'admin@miempresa.com', 
  '+595 999 000 000', 
  'Dirección Default',
  'PYG',
  10
)
ON CONFLICT (id) DO NOTHING;
