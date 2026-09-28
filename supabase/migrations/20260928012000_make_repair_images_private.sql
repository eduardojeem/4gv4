-- Convert historical repair image URLs to internal object paths before making
-- the bucket private. The preflight deliberately aborts the transaction if a
-- value cannot be recognized, so no row or bucket is partially cut over.

CREATE OR REPLACE FUNCTION pg_temp.url_decode(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  position integer := 1;
  bytes bytea := ''::bytea;
  character text;
BEGIN
  WHILE position <= length(value) LOOP
    character := substr(value, position, 1);
    IF character = '%' THEN
      IF substr(value, position + 1, 2) !~ '^[0-9A-Fa-f]{2}$' THEN
        RETURN NULL;
      END IF;
      bytes := bytes || decode(substr(value, position + 1, 2), 'hex');
      position := position + 3;
    ELSE
      bytes := bytes || convert_to(character, 'UTF8');
      position := position + 1;
    END IF;
  END LOOP;

  RETURN convert_from(bytes, 'UTF8');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.repair_image_path(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  candidate text := btrim(value);
  encoded_path text;
  decoded_path text;
  segments text[];
BEGIN
  IF candidate = '' THEN RETURN NULL; END IF;

  IF candidate ~ '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/repair-images/'
     OR candidate ~ '^http://(127[.]0[.]0[.]1|localhost):[0-9]+/storage/v1/object/public/repair-images/' THEN
    encoded_path := substring(
      candidate
      FROM '/storage/v1/object/public/repair-images/([^?#]+)'
    );
  ELSIF position('://' IN candidate) = 0 THEN
    encoded_path := candidate;
  ELSE
    RETURN NULL;
  END IF;

  decoded_path := pg_temp.url_decode(encoded_path);
  IF decoded_path IS NULL
     OR length(decoded_path) > 1024
     OR decoded_path LIKE '/%'
     OR decoded_path LIKE '%/'
     OR position(E'\\' IN decoded_path) > 0
     OR position('?' IN decoded_path) > 0
     OR position('#' IN decoded_path) > 0 THEN
    RETURN NULL;
  END IF;

  segments := string_to_array(decoded_path, '/');
  IF segments && ARRAY['', '.', '..']::text[] THEN RETURN NULL; END IF;

  RETURN decoded_path;
END;
$$;

DO $$
DECLARE
  invalid_count bigint;
BEGIN
  SELECT count(*)
  INTO invalid_count
  FROM public.repair_images
  WHERE pg_temp.repair_image_path(image_url) IS NULL;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'repair-images privacy preflight rejected % unrecognized repair_images.image_url value(s)', invalid_count;
  END IF;
END;
$$;

UPDATE public.repair_images
SET image_url = pg_temp.repair_image_path(image_url)
WHERE image_url IS DISTINCT FROM pg_temp.repair_image_path(image_url);

INSERT INTO storage.buckets (id, name, public)
VALUES ('repair-images', 'repair-images', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- No browser role needs direct access to this private bucket. Drop only the
-- repair-only policies created by the historical setup scripts. Do not parse
-- policy predicates dynamically: a shared OR/IN policy could also serve other
-- buckets and deleting it would break unrelated public assets.
DROP POLICY IF EXISTS "Public Access Repair Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Upload Repair Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Update Repair Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Delete Repair Images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for repair images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload repair images" ON storage.objects;

DROP POLICY IF EXISTS "repair_images_delete_unified" ON public.repair_images;
DROP POLICY IF EXISTS "repair_images_insert_unified" ON public.repair_images;
DROP POLICY IF EXISTS "repair_images_select_unified" ON public.repair_images;
DROP POLICY IF EXISTS "repair_images_update_unified" ON public.repair_images;
DROP POLICY IF EXISTS "repair_images_tenant_delete" ON public.repair_images;
DROP POLICY IF EXISTS "repair_images_tenant_insert" ON public.repair_images;
DROP POLICY IF EXISTS "repair_images_tenant_select" ON public.repair_images;
DROP POLICY IF EXISTS "repair_images_tenant_update" ON public.repair_images;

CREATE POLICY "repair_images_tenant_select"
ON public.repair_images FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.repairs r
  JOIN public.organization_members membership
    ON membership.organization_id = r.organization_id
  WHERE r.id = repair_images.repair_id
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
));

CREATE POLICY "repair_images_tenant_insert"
ON public.repair_images FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.repairs r
  JOIN public.organization_members membership
    ON membership.organization_id = r.organization_id
  WHERE r.id = repair_images.repair_id
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
    AND membership.role::text IN ('owner', 'admin', 'manager', 'technician')
    AND repair_images.image_url LIKE 'organizations/' || r.organization_id::text || '/repair-images/' || auth.uid()::text || '/%'
));

CREATE POLICY "repair_images_tenant_update"
ON public.repair_images FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.repairs r
  JOIN public.organization_members membership
    ON membership.organization_id = r.organization_id
  WHERE r.id = repair_images.repair_id
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
    AND membership.role::text IN ('owner', 'admin', 'manager', 'technician')
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.repairs r
  JOIN public.organization_members membership
    ON membership.organization_id = r.organization_id
  WHERE r.id = repair_images.repair_id
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
    AND membership.role::text IN ('owner', 'admin', 'manager', 'technician')
    AND repair_images.image_url LIKE 'organizations/' || r.organization_id::text || '/repair-images/' || auth.uid()::text || '/%'
));

CREATE POLICY "repair_images_tenant_delete"
ON public.repair_images FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.repairs r
  JOIN public.organization_members membership
    ON membership.organization_id = r.organization_id
  WHERE r.id = repair_images.repair_id
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
    AND membership.role::text IN ('owner', 'admin', 'manager', 'technician')
));
