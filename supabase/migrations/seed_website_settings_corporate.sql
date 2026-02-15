BEGIN;

-- Ajuste de tono corporativo en hero_content
UPDATE website_settings SET value = '{
  "badge": "🔒 Compromiso y calidad certificada",
  "title": "Soluciones profesionales de reparación de celulares",
  "subtitle": "Diagnóstico claro • Repuestos originales • Garantía real de 6 meses"
}'::jsonb, updated_at = NOW()
WHERE key = 'hero_content';

-- Ampliar testimonios a 20 entradas (máximo permitido)
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
  {"id": "12", "name": "Rodrigo Torres", "rating": 4, "comment": "Buen servicio; podrían ampliar horarios, pero todo correcto."},
  {"id": "13", "name": "Paola Acosta", "rating": 5, "comment": "Atención cordial y resultados excelentes en mantenimiento de software."},
  {"id": "14", "name": "Fernanda Paredes", "rating": 5, "comment": "Me explicaron cada paso y cumplieron los tiempos acordados."},
  {"id": "15", "name": "Gustavo Silva", "rating": 4, "comment": "Servicio confiable. La batería quedó como nueva."},
  {"id": "16", "name": "Laura Medina", "rating": 5, "comment": "Muy recomendable; precios claros y garantía cumplida."},
  {"id": "17", "name": "Hernán Duarte", "rating": 5, "comment": "Excelente diagnóstico y solución definitiva a un problema complejo."},
  {"id": "18", "name": "Marcos Viera", "rating": 5, "comment": "Rápidos y diligentes. Comunicación clara en todo momento."},
  {"id": "19", "name": "Nadia Benítez", "rating": 5, "comment": "Reparación impecable y trato muy profesional."},
  {"id": "20", "name": "Sergio Cabrera", "rating": 5, "comment": "Calidad y seriedad. El teléfono quedó perfecto y con garantía."}
]'::jsonb, updated_at = NOW()
WHERE key = 'testimonials';

COMMIT;

