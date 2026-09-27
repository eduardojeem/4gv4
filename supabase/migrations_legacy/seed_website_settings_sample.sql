-- Seed de datos de ejemplo para la sección /admin/website
-- Compatible con PK (organization_id, key) — requiere pasar el org_id.
-- Uso: reemplaza :ORG_ID con el UUID de la organización antes de ejecutar.
--   psql -v ORG_ID="'uuid-aqui'" -f seed_website_settings_sample.sql
-- O bien ejecuta desde /admin/website → botón "Inicializar ajustes".

BEGIN;

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Obtener la primera organización disponible (ajustar si hay varias)
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No se encontró ninguna organización. Abortando seed.';
    RETURN;
  END IF;

  -- company_info
  INSERT INTO website_settings (organization_id, key, value)
  VALUES (v_org_id, 'company_info', '{
    "phone": "+595 981 234 567",
    "email": "admin@4gcelulares.com",
    "address": "Av. España 780, Asunción",
    "hours": {
      "weekdays": "Lun - Vie: 08:00 - 18:00",
      "saturday": "Sáb: 09:00 - 13:00",
      "sunday": "Dom: Cerrado"
    }
  }'::jsonb)
  ON CONFLICT (organization_id, key) DO UPDATE SET
    value      = EXCLUDED.value,
    updated_at = NOW();

  -- hero_stats
  INSERT INTO website_settings (organization_id, key, value)
  VALUES (v_org_id, 'hero_stats', '{
    "repairs": "12K+",
    "satisfaction": "99%",
    "avgTime": "24-48h"
  }'::jsonb)
  ON CONFLICT (organization_id, key) DO UPDATE SET
    value      = EXCLUDED.value,
    updated_at = NOW();

  -- hero_content
  INSERT INTO website_settings (organization_id, key, value)
  VALUES (v_org_id, 'hero_content', '{
    "badge": "⚡ Atención rápida y garantizada",
    "title": "Expertos en reparación de celulares",
    "subtitle": "Diagnóstico sin costo • Garantía de 6 meses • Repuestos originales"
  }'::jsonb)
  ON CONFLICT (organization_id, key) DO UPDATE SET
    value      = EXCLUDED.value,
    updated_at = NOW();

  -- services: catálogo vacío — el admin lo construye desde /admin/website
  INSERT INTO website_settings (organization_id, key, value)
  VALUES (v_org_id, 'services', '[]'::jsonb)
  ON CONFLICT (organization_id, key) DO NOTHING;

  -- testimonials
  INSERT INTO website_settings (organization_id, key, value)
  VALUES (v_org_id, 'testimonials', '[
    {"id": "1", "name": "María González",  "rating": 5, "comment": "Excelente servicio, cambiaron la pantalla en menos de 1 hora y quedó perfecta."},
    {"id": "2", "name": "Carlos Ramírez",  "rating": 5, "comment": "Muy profesionales y honestos. Precio justo y atención excelente."},
    {"id": "3", "name": "Ana Martínez",    "rating": 5, "comment": "Cambio de batería rápido y con garantía. Mi iPhone quedó como nuevo."},
    {"id": "4", "name": "Jorge López",     "rating": 4, "comment": "Recuperaron mis fotos, muy agradecido. Tardó un poco pero valió la pena."},
    {"id": "5", "name": "Lucía Fernández", "rating": 5, "comment": "Atención rápida y muy buena explicación del problema. Recomiendo."},
    {"id": "6", "name": "Pedro Benítez",   "rating": 5, "comment": "Solucionaron un problema de software que nadie podía. 10/10."}
  ]'::jsonb)
  ON CONFLICT (organization_id, key) DO UPDATE SET
    value      = EXCLUDED.value,
    updated_at = NOW();

  RAISE NOTICE 'Seed aplicado a organización: %', v_org_id;
END $$;

COMMIT;
