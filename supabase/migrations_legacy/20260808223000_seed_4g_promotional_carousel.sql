-- Publish the built-in promotional carousel examples for 4g-celulares.
-- Idempotent and non-destructive: existing tenant customization is preserved.

DO $$
DECLARE
  target_organization_id uuid;
BEGIN
  SELECT id
  INTO target_organization_id
  FROM public.organizations
  WHERE slug = '4g-celulares'
  LIMIT 1;

  IF target_organization_id IS NULL THEN
    RAISE NOTICE 'Skipping promotional carousel seed: organization 4g-celulares was not found';
    RETURN;
  END IF;

  INSERT INTO public.website_settings (organization_id, key, value)
  VALUES (
  target_organization_id,
  'promotional_carousel',
  jsonb_build_object(
    'enabled', true,
    'autoplay', true,
    'intervalSeconds', 6,
    'slides', jsonb_build_array(
      jsonb_build_object(
        'id', 'carousel-example-accessories',
        'title', 'Todo para acompañar tu celular',
        'message', 'Descubrí cargadores, cables, auriculares y fundas seleccionadas.',
        'imageUrl', '/images/promotional-carousel/accesorios.webp',
        'imageAlt', 'Cargadores, cables, auriculares y fundas para celulares',
        'ctaText', 'Ver accesorios',
        'ctaHref', '/productos',
        'active', true,
        'textTone', 'dark',
        'contentAlign', 'left'
      ),
      jsonb_build_object(
        'id', 'carousel-example-renewal',
        'title', 'Encontrá tu próximo celular',
        'message', 'Conocé los equipos disponibles y elegí el que mejor se adapta a vos.',
        'imageUrl', '/images/promotional-carousel/renovacion.webp',
        'imageAlt', 'Tres celulares modernos exhibidos en una tienda',
        'ctaText', 'Ver celulares',
        'ctaHref', '/productos',
        'active', true,
        'textTone', 'dark',
        'contentAlign', 'right'
      ),
      jsonb_build_object(
        'id', 'carousel-example-repair',
        'title', 'Tu equipo en manos expertas',
        'message', 'Diagnóstico claro y reparación profesional para tu celular.',
        'imageUrl', '/images/promotional-carousel/reparacion.webp',
        'imageAlt', 'Técnico revisando un celular en una mesa de reparación',
        'ctaText', 'Ver servicios',
        'ctaHref', '/servicios',
        'active', true,
        'textTone', 'dark',
        'contentAlign', 'left'
      )
    )
  )
  )
  ON CONFLICT (organization_id, key) DO NOTHING;
END
$$;
