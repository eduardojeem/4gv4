INSERT INTO public.website_settings (key, value)
VALUES
  ('company_info', '{
    "name": "",
    "phone": "",
    "email": "",
    "address": "",
    "hours": { "weekdays": "", "saturday": "", "sunday": "" },
    "logoUrl": "",
    "brandColor": "blue"
  }'::jsonb),
  ('hero_content', '{
    "badge": "",
    "title": "",
    "subtitle": ""
  }'::jsonb),
  ('hero_stats', '{
    "repairs": "",
    "satisfaction": "",
    "avgTime": ""
  }'::jsonb),
  ('services', '[]'::jsonb),
  ('testimonials', '[]'::jsonb),
  ('maintenance_mode', '{
    "enabled": false,
    "title": "Sitio en Mantenimiento",
    "message": "Estamos realizando mejoras en nuestro sitio. Volveremos pronto.",
    "estimatedEnd": ""
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
