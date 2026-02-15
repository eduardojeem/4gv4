BEGIN;

-- Seed de datos de ejemplo para la sección /admin/website
-- Actualiza valores si ya existen

INSERT INTO website_settings (key, value)
VALUES ('company_info', '{
  "phone": "+595 981 234 567",
  "email": "admin@4gcelulares.com",
  "address": "Av. España 780, Asunción",
  "hours": {
    "weekdays": "Lun - Vie: 08:00 - 18:00",
    "saturday": "Sáb: 09:00 - 13:00",
    "sunday": "Dom: Cerrado"
  }
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

INSERT INTO website_settings (key, value)
VALUES ('hero_stats', '{
  "repairs": "12K+",
  "satisfaction": "99%",
  "avgTime": "24-48h"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

INSERT INTO website_settings (key, value)
VALUES ('hero_content', '{
  "badge": "⚡ Atención rápida y garantizada",
  "title": "Expertos en reparación de celulares",
  "subtitle": "Diagnóstico sin costo • Garantía de 6 meses • Repuestos originales"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

INSERT INTO website_settings (key, value)
VALUES ('services', '[
  {
    "id": "screens",
    "title": "Reparación de pantallas",
    "description": "Cambio de pantallas rotas con repuestos originales y garantía",
    "icon": "wrench",
    "color": "blue",
    "benefits": ["Repuestos originales", "Instalación en 1 hora", "Garantía de 6 meses"]
  },
  {
    "id": "battery",
    "title": "Cambio de batería",
    "description": "Baterías certificadas para mayor duración y seguridad",
    "icon": "package",
    "color": "green",
    "benefits": ["Baterías certificadas", "Test de rendimiento", "Garantía de 6 meses"]
  },
  {
    "id": "software",
    "title": "Soluciones de software",
    "description": "Actualización, optimización y recuperación de datos",
    "icon": "shield",
    "color": "purple",
    "benefits": ["Diagnóstico gratuito", "Optimización de sistema", "Recuperación de datos"]
  }
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

INSERT INTO website_settings (key, value)
VALUES ('testimonials', '[
  {"id": "1", "name": "María González", "rating": 5, "comment": "Excelente servicio, cambiaron la pantalla en menos de 1 hora y quedó perfecta."},
  {"id": "2", "name": "Carlos Ramírez", "rating": 5, "comment": "Muy profesionales y honestos. Precio justo y atención excelente."},
  {"id": "3", "name": "Ana Martínez", "rating": 5, "comment": "Cambio de batería rápido y con garantía. Mi iPhone quedó como nuevo."},
  {"id": "4", "name": "Jorge López", "rating": 4, "comment": "Recuperaron mis fotos, muy agradecido. Tardó un poco pero valió la pena."},
  {"id": "5", "name": "Lucía Fernández", "rating": 5, "comment": "Atención rápida y muy buena explicación del problema. Recomiendo."},
  {"id": "6", "name": "Pedro Benítez", "rating": 5, "comment": "Solucionaron un problema de software que nadie podía. 10/10."}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

COMMIT;

