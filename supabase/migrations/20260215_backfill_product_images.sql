-- Backfill image_url for existing products
-- Strategy:
-- 1) If products.images has at least one entry, use the first as image_url
-- 2) Else set a stable local placeholder from /public
-- 3) If images is NULL and image_url is set, initialize images with image_url

DO $$
BEGIN
  -- Ensure column exists (idempotent guard; will no-op if already there)
  -- NOTE: products.image_url already exists in schema per 20241206_create_products_tables.sql

  -- 1) Prefer first image from images[]
  UPDATE public.products p
  SET image_url = CASE
    WHEN p.image_url IS NULL AND p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1]
    ELSE p.image_url
  END;

  -- 2) Fill remaining NULL image_url with a local placeholder
  UPDATE public.products p
  SET image_url = '/file.svg'
  WHERE p.image_url IS NULL;

  -- 3) Initialize images[] when empty, using image_url
  UPDATE public.products p
  SET images = ARRAY[p.image_url]
  WHERE (p.images IS NULL OR array_length(p.images, 1) = 0)
    AND p.image_url IS NOT NULL;
END $$;

