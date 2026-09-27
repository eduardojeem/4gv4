-- ============================================================
-- GLOBAL CATEGORIES TAXONOMY
-- Solución para normalización de categorías en marketplace
-- multi-tenant: cada empresa tiene sus propias categorías,
-- el marketplace las agrupa por taxonomía global.
--
-- VALIDAR EN SUPABASE DEV ANTES DE COMMIT
-- ============================================================

-- 1. Extensión para búsqueda difusa (fuzzy matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tabla de categorías globales (administrada por el superadmin)
CREATE TABLE IF NOT EXISTS public.global_categories (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  slug         text        UNIQUE NOT NULL,
  description  text,
  parent_id    uuid        REFERENCES public.global_categories(id) ON DELETE SET NULL,
  level        int         NOT NULL DEFAULT 0,   -- 0=raíz, 1=sub, 2=hoja
  aliases      text[]      NOT NULL DEFAULT '{}', -- nombres alternativos para fuzzy matching
  icon         text,                              -- nombre de ícono lucide
  sort_order   int         NOT NULL DEFAULT 0,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 3. Índices para búsqueda difusa (pg_trgm)
CREATE INDEX IF NOT EXISTS idx_global_categories_name_trgm
  ON public.global_categories USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_global_categories_slug_trgm
  ON public.global_categories USING gin (slug gin_trgm_ops);

-- Índice en aliases (unnested) para búsqueda en sinónimos
CREATE INDEX IF NOT EXISTS idx_global_categories_name_lower
  ON public.global_categories (lower(name));

-- 4. Agregar FK a tabla de categorías de tenants
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS global_category_id uuid
    REFERENCES public.global_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_global_category_id
  ON public.categories (global_category_id);

-- 5. RLS: global_categories es pública para lectura, solo superadmin escribe
ALTER TABLE public.global_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_categories_public_read"
  ON public.global_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "global_categories_superadmin_write"
  ON public.global_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- 6. Función SQL para buscar similitudes (usada por la API /suggest)
--    Retorna candidatas ordenadas por similitud con pg_trgm
CREATE OR REPLACE FUNCTION public.suggest_global_category(
  p_name text,
  p_limit int DEFAULT 5,
  p_threshold float DEFAULT 0.2
)
RETURNS TABLE (
  id           uuid,
  name         text,
  slug         text,
  level        int,
  parent_name  text,
  similarity   float
)
LANGUAGE sql STABLE AS $$
  SELECT
    gc.id,
    gc.name,
    gc.slug,
    gc.level,
    parent.name AS parent_name,
    GREATEST(
      similarity(lower(p_name), lower(gc.name)),
      -- También compara con aliases
      COALESCE(
        (SELECT MAX(similarity(lower(p_name), lower(a)))
         FROM unnest(gc.aliases) a),
        0
      )
    ) AS sim
  FROM public.global_categories gc
  LEFT JOIN public.global_categories parent ON parent.id = gc.parent_id
  WHERE gc.is_active = true
    AND GREATEST(
          similarity(lower(p_name), lower(gc.name)),
          COALESCE(
            (SELECT MAX(similarity(lower(p_name), lower(a)))
             FROM unnest(gc.aliases) a),
            0
          )
        ) >= p_threshold
  ORDER BY sim DESC
  LIMIT p_limit;
$$;

-- 7. Función para auto-mapear categorías existentes de un tenant
--    Útil para migrar datos históricos
CREATE OR REPLACE FUNCTION public.auto_map_tenant_categories(
  p_organization_id uuid,
  p_threshold float DEFAULT 0.4
)
RETURNS int   -- cantidad de categorías mapeadas
LANGUAGE plpgsql AS $$
DECLARE
  v_count int := 0;
  v_cat   record;
  v_match uuid;
BEGIN
  FOR v_cat IN
    SELECT id, name
    FROM public.categories
    WHERE organization_id = p_organization_id
      AND global_category_id IS NULL
      AND is_active = true
  LOOP
    SELECT id INTO v_match
    FROM public.suggest_global_category(v_cat.name, 1, p_threshold)
    LIMIT 1;

    IF v_match IS NOT NULL THEN
      UPDATE public.categories
      SET global_category_id = v_match,
          updated_at = now()
      WHERE id = v_cat.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 8. Seed: taxonomía base para vertical de reparaciones + retail
--    (ajustá según tu negocio)
INSERT INTO public.global_categories (name, slug, level, sort_order, icon, aliases) VALUES
  -- Raíces (level 0)
  ('Electrónica',          'electronica',           0, 10, 'Cpu',          ARRAY['electronics', 'electronico', 'electronic']),
  ('Celulares',            'celulares',              0, 20, 'Smartphone',   ARRAY['telefonos', 'moviles', 'phones', 'mobile']),
  ('Computadoras',         'computadoras',           0, 30, 'Laptop',       ARRAY['computadores', 'pc', 'ordenadores', 'computers']),
  ('Accesorios',           'accesorios',             0, 40, 'Plug',         ARRAY['accessories', 'accesorio']),
  ('Repuestos',            'repuestos',              0, 50, 'Wrench',       ARRAY['partes', 'piezas', 'parts', 'spare parts']),
  ('Almacenamiento',       'almacenamiento',         0, 60, 'HardDrive',    ARRAY['storage', 'almecenamit', 'discos', 'pendrives', 'memorias']),
  ('Audio y Video',        'audio-video',            0, 70, 'Volume2',      ARRAY['audio', 'video', 'sonido', 'parlantes', 'auriculares']),
  ('Redes',                'redes',                  0, 80, 'Wifi',         ARRAY['networking', 'network', 'routers', 'switches']),
  ('Impresoras',           'impresoras',             0, 90, 'Printer',      ARRAY['printers', 'impresora', 'toners', 'cartuchos']),
  ('Gaming',               'gaming',                 0, 100, 'Gamepad2',   ARRAY['juegos', 'consolas', 'games', 'videojuegos']),
  ('Insumos',              'insumos',                0, 110, 'Package',     ARRAY['consumibles', 'supplies', 'materiales']),
  ('Herramientas',         'herramientas',           0, 120, 'Hammer',      ARRAY['tools', 'herramienta', 'equipos'])
ON CONFLICT (slug) DO NOTHING;

-- Subcategorías de Celulares
INSERT INTO public.global_categories (name, slug, level, sort_order, icon, aliases, parent_id)
SELECT
  name, slug, 1, sort_order, icon, aliases,
  (SELECT id FROM public.global_categories WHERE slug = 'celulares')
FROM (VALUES
  ('Pantallas Celular',  'pantallas-celular',  10, 'Monitor',    ARRAY['display', 'pantalla', 'lcd', 'oled', 'touch']),
  ('Baterías Celular',   'baterias-celular',   20, 'Battery',    ARRAY['bateria', 'battery', 'pila']),
  ('Carcasas y Fundas',  'carcasas-fundas',    30, 'Shield',     ARRAY['case', 'cover', 'carcasa', 'funda']),
  ('Cargadores',         'cargadores',         40, 'Zap',        ARRAY['charger', 'cargador', 'cable', 'cables'])
) AS t(name, slug, sort_order, icon, aliases)
ON CONFLICT (slug) DO NOTHING;

-- Subcategorías de Almacenamiento
INSERT INTO public.global_categories (name, slug, level, sort_order, icon, aliases, parent_id)
SELECT
  name, slug, 1, sort_order, icon, aliases,
  (SELECT id FROM public.global_categories WHERE slug = 'almacenamiento')
FROM (VALUES
  ('Discos SSD',    'discos-ssd',    10, 'Zap',       ARRAY['ssd', 'solid state', 'disco solido']),
  ('Discos HDD',    'discos-hdd',    20, 'HardDrive', ARRAY['hdd', 'disco duro', 'hard disk']),
  ('Pendrives',     'pendrives',     30, 'Usb',       ARRAY['usb', 'flash drive', 'memoria usb']),
  ('Tarjetas SD',   'tarjetas-sd',   40, 'CreditCard',ARRAY['sd card', 'microsd', 'memory card'])
) AS t(name, slug, sort_order, icon, aliases)
ON CONFLICT (slug) DO NOTHING;

-- Subcategorías de Repuestos
INSERT INTO public.global_categories (name, slug, level, sort_order, icon, aliases, parent_id)
SELECT
  name, slug, 1, sort_order, icon, aliases,
  (SELECT id FROM public.global_categories WHERE slug = 'repuestos')
FROM (VALUES
  ('Placas Base',        'placas-base',         10, 'CircuitBoard', ARRAY['motherboard', 'placa madre', 'mainboard']),
  ('Fuentes de poder',   'fuentes-poder',        20, 'Zap',          ARRAY['power supply', 'fuente', 'psu']),
  ('Chips y Procesadores','chips-procesadores',  30, 'Cpu',          ARRAY['cpu', 'processor', 'chip', 'ic'])
) AS t(name, slug, sort_order, icon, aliases)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Para migrar categorías existentes de un tenant en particular:
--   SELECT public.auto_map_tenant_categories('UUID-del-tenant', 0.4);
--
-- Para ver qué tan bien matchea un nombre:
--   SELECT * FROM public.suggest_global_category('almecenamit');
-- ============================================================
