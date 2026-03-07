-- Diagnostico de textos con posible mojibake.
-- Solo lectura. No modifica datos.

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS tmp_mojibake_counts (
  table_ref text,
  suspicious_rows bigint
) ON COMMIT DROP;

TRUNCATE TABLE tmp_mojibake_counts;

DO $$
DECLARE
  rec record;
  cond text;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('public', 'products', 'name'),
      ('public', 'products', 'description'),
      ('public', 'categories', 'name'),
      ('public', 'categories', 'description'),
      ('public', 'brands', 'name'),
      ('public', 'brands', 'description'),
      ('public', 'suppliers', 'name'),
      ('public', 'suppliers', 'contact_name'),
      ('public', 'suppliers', 'notes'),
      ('public', 'profiles', 'full_name'),
      ('public', 'repairs', 'problem_description'),
      ('public', 'system_settings', 'company_name'),
      ('public', 'system_settings', 'company_email'),
      ('public', 'system_settings', 'company_phone'),
      ('public', 'system_settings', 'company_address'),
      ('public', 'system_settings', 'city')
    ) AS t(schema_name, table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = rec.schema_name
        AND c.table_name = rec.table_name
        AND c.column_name = rec.column_name
    ) THEN
      cond := format(
        '(position(''Ã'' in %1$I)>0 OR position(''Â'' in %1$I)>0 OR position(''�'' in %1$I)>0 OR position(''Ãƒ'' in %1$I)>0 OR position(''Ã‚'' in %1$I)>0 OR position(''ï¿½'' in %1$I)>0)',
        rec.column_name
      );
      EXECUTE format($fmt$
        INSERT INTO tmp_mojibake_counts(table_ref, suspicious_rows)
        SELECT %L, COUNT(*)
        FROM %I.%I
        WHERE %s;
      $fmt$, rec.schema_name || '.' || rec.table_name || '.' || rec.column_name, rec.schema_name, rec.table_name, cond);
    END IF;
  END LOOP;
END $$;

SELECT *
FROM tmp_mojibake_counts
WHERE suspicious_rows > 0
ORDER BY suspicious_rows DESC, table_ref;

CREATE TEMP TABLE IF NOT EXISTS tmp_settings_suspicious (
  source text,
  row_ref text,
  raw_text text
) ON COMMIT DROP;

TRUNCATE TABLE tmp_settings_suspicious;

DO $$
DECLARE
  tbl text;
  key_col text;
  val_col text;
  cond text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['website_settings', 'system_settings']
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT c.column_name
    INTO key_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = tbl
      AND c.column_name IN ('key', 'setting_key', 'name', 'id')
    ORDER BY CASE c.column_name
      WHEN 'key' THEN 1
      WHEN 'setting_key' THEN 2
      WHEN 'name' THEN 3
      WHEN 'id' THEN 4
      ELSE 99
    END
    LIMIT 1;

    SELECT c.column_name
    INTO val_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = tbl
      AND c.column_name IN ('value', 'settings', 'config')
    ORDER BY CASE c.column_name
      WHEN 'value' THEN 1
      WHEN 'settings' THEN 2
      WHEN 'config' THEN 3
      ELSE 99
    END
    LIMIT 1;

    IF key_col IS NOT NULL AND val_col IS NOT NULL THEN
      cond := format(
        '(position(''Ã'' in %1$I::text)>0 OR position(''Â'' in %1$I::text)>0 OR position(''�'' in %1$I::text)>0 OR position(''Ãƒ'' in %1$I::text)>0 OR position(''Ã‚'' in %1$I::text)>0 OR position(''ï¿½'' in %1$I::text)>0)',
        val_col
      );
      EXECUTE format($fmt$
        INSERT INTO tmp_settings_suspicious(source, row_ref, raw_text)
        SELECT %L, CAST(%I AS text), %I::text
        FROM public.%I
        WHERE %s;
      $fmt$, tbl, key_col, val_col, tbl, cond);
    END IF;
  END LOOP;
END $$;

SELECT *
FROM tmp_settings_suspicious
ORDER BY source, row_ref;

COMMIT;
