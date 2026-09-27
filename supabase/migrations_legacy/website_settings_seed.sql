-- Seed base para website_settings
-- Compatible con PK (organization_id, key).
-- Se ejecuta dentro de un DO block que detecta la organización automáticamente.

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No se encontró ninguna organización. Seed omitido.';
    RETURN;
  END IF;

  INSERT INTO public.website_settings (organization_id, key, value)
  VALUES
    (v_org_id, 'company_info', '{
      "name": "",
      "phone": "",
      "email": "",
      "address": "",
      "hours": { "weekdays": "", "saturday": "", "sunday": "" },
      "logoUrl": "",
      "brandColor": "blue"
    }'::jsonb),
    (v_org_id, 'hero_content', '{
      "badge": "",
      "title": "",
      "subtitle": ""
    }'::jsonb),
    (v_org_id, 'hero_stats', '{
      "repairs": "",
      "satisfaction": "",
      "avgTime": ""
    }'::jsonb),
    (v_org_id, 'services',      '[]'::jsonb),
    (v_org_id, 'testimonials',  '[]'::jsonb),
    (v_org_id, 'maintenance_mode', '{
      "enabled": false,
      "title": "Sitio en Mantenimiento",
      "message": "Estamos realizando mejoras en nuestro sitio. Volveremos pronto.",
      "estimatedEnd": ""
    }'::jsonb)
  ON CONFLICT (organization_id, key) DO NOTHING;

  RAISE NOTICE 'website_settings seed aplicado a organización: %', v_org_id;
END $$;
