ALTER TABLE public.organization_settings
  ADD COLUMN country_code text,
  ADD COLUMN locale text;

ALTER TABLE public.organization_settings
  ADD CONSTRAINT organization_settings_country_code_format_check
  CHECK (
    country_code IS NULL
    OR (
      char_length(country_code) = 2
      AND country_code COLLATE "C" ~ '^[A-Z]{2}$'
    )
  );
