BEGIN;

UPDATE website_settings SET value = '{
  "phone": "+595 971 000 123",
  "email": "contacto@4gcelulares.com",
  "address": "Av. Mcal. López 1500, Asunción",
  "hours": {
    "weekdays": "Lun - Vie: 09:00 - 18:30",
    "saturday": "Sáb: 09:00 - 13:30",
    "sunday": "Dom: Cerrado"
  }
}'::jsonb, updated_at = NOW() WHERE key = 'company_info';

UPDATE website_settings SET value = '{
  "badge": "✨ Servicio premium garantizado",
  "title": "Reparación rápida y confiable para tu celular",
  "subtitle": "Atención profesional • Repuestos originales • Garantía de 6 meses"
}'::jsonb, updated_at = NOW() WHERE key = 'hero_content';

UPDATE website_settings SET value = '{
  "repairs": "15K+",
  "satisfaction": "99%",
  "avgTime": "24-48h"
}'::jsonb, updated_at = NOW() WHERE key = 'hero_stats';

UPDATE website_settings SET value = '[
  {"id": "1", "name": "María González", "rating": 5, "comment": "Excelente servicio, cambiaron la pantalla en menos de 1 hora y quedó perfecta."},
  {"id": "2", "name": "Carlos Ramírez", "rating": 5, "comment": "Muy profesionales y honestos. Precio justo y atención excelente."},
  {"id": "3", "name": "Ana Martínez", "rating": 5, "comment": "Cambio de batería rápido y con garantía. Mi iPhone quedó como nuevo."},
  {"id": "4", "name": "Jorge López", "rating": 4, "comment": "Recuperaron mis fotos. Tardó un poco pero valió la pena."},
  {"id": "5", "name": "Lucía Fernández", "rating": 5, "comment": "Atención rápida y muy buena explicación del problema. Recomiendo."},
  {"id": "6", "name": "Pedro Benítez", "rating": 5, "comment": "Solucionaron un problema de software que nadie podía. 10/10."},
  {"id": "7", "name": "Sofía Rivas", "rating": 5, "comment": "Excelente atención al cliente y resultados impecables."},
  {"id": "8", "name": "Martin Díaz", "rating": 4, "comment": "Buena calidad y precio. La reparación tomó unas horas."},
  {"id": "9", "name": "Valentina Ortiz", "rating": 5, "comment": "Repuestos originales y buen asesoramiento. Muy satisfecha."},
  {"id": "10", "name": "Diego Castro", "rating": 5, "comment": "Rápido y profesional. Mi celular quedó perfecto."},
  {"id": "11", "name": "Camila Núñez", "rating": 5, "comment": "La mejor experiencia en reparación de pantallas que he tenido."},
  {"id": "12", "name": "Rodrigo Torres", "rating": 4, "comment": "Buen servicio, podrían ampliar horarios, pero todo correcto."}
]'::jsonb, updated_at = NOW() WHERE key = 'testimonials';

COMMIT;

