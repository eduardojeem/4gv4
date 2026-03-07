-- Correccion segura de mojibake en texto/json.
-- Soporta esquemas distintos para system_settings.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mojibake_fix_backup (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  row_id text NOT NULL,
  column_name text NOT NULL,
  old_value text NOT NULL,
  new_value text NOT NULL,
  fixed_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.fix_mojibake_latin1_utf8(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  converted text;
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  IF position('Ã' in input_text) = 0
     AND position('Â' in input_text) = 0
     AND position('�' in input_text) = 0
     AND position('Ãƒ' in input_text) = 0
     AND position('Ã‚' in input_text) = 0
     AND position('ï¿½' in input_text) = 0 THEN
    RETURN input_text;
  END IF;

  BEGIN
    converted := convert_from(convert_to(input_text, 'LATIN1'), 'UTF8');
    RETURN COALESCE(converted, input_text);
  EXCEPTION WHEN OTHERS THEN
    RETURN input_text;
  END;
END;
$$;

DO $$
DECLARE
  rec record;
  backup_sql text;
  update_sql text;
  cond text;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('public', 'products', 'id', 'name'),
      ('public', 'products', 'id', 'description'),
      ('public', 'categories', 'id', 'name'),
      ('public', 'categories', 'id', 'description'),
      ('public', 'brands', 'id', 'name'),
      ('public', 'brands', 'id', 'description'),
      ('public', 'suppliers', 'id', 'name'),
      ('public', 'suppliers', 'id', 'contact_name'),
      ('public', 'suppliers', 'id', 'notes'),
      ('public', 'profiles', 'id', 'full_name'),
      ('public', 'repairs', 'id', 'problem_description'),
      ('public', 'system_settings', 'id', 'company_name'),
      ('public', 'system_settings', 'id', 'company_email'),
      ('public', 'system_settings', 'id', 'company_phone'),
      ('public', 'system_settings', 'id', 'company_address'),
      ('public', 'system_settings', 'id', 'city')
    ) AS t(schema_name, table_name, pk_column, column_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = rec.schema_name
        AND c.table_name = rec.table_name
        AND c.column_name = rec.column_name
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = rec.schema_name
        AND c.table_name = rec.table_name
        AND c.column_name = rec.pk_column
    ) THEN
      cond := format(
        '(position(''Ã'' in %1$I)>0 OR position(''Â'' in %1$I)>0 OR position(''�'' in %1$I)>0 OR position(''Ãƒ'' in %1$I)>0 OR position(''Ã‚'' in %1$I)>0 OR position(''ï¿½'' in %1$I)>0)',
        rec.column_name
      );

      backup_sql := format($fmt$
        INSERT INTO public.mojibake_fix_backup(table_name, row_id, column_name, old_value, new_value)
        SELECT %L, CAST(%I AS text), %L, %I, public.fix_mojibake_latin1_utf8(%I)
        FROM %I.%I
        WHERE %s
          AND public.fix_mojibake_latin1_utf8(%I) <> %I;
      $fmt$,
        rec.schema_name || '.' || rec.table_name,
        rec.pk_column,
        rec.column_name,
        rec.column_name,
        rec.column_name,
        rec.schema_name,
        rec.table_name,
        cond,
        rec.column_name,
        rec.column_name
      );
      EXECUTE backup_sql;

      update_sql := format($fmt$
        UPDATE %I.%I
        SET %I = public.fix_mojibake_latin1_utf8(%I)
        WHERE %s
          AND public.fix_mojibake_latin1_utf8(%I) <> %I;
      $fmt$,
        rec.schema_name,
        rec.table_name,
        rec.column_name,
        rec.column_name,
        cond,
        rec.column_name,
        rec.column_name
      );
      EXECUTE update_sql;
    END IF;
  END LOOP;
END $$;

-- Correccion en tablas key/value (si existen columnas compatibles)
DO $$
DECLARE
  tbl text;
  key_col text;
  val_col text;
  val_udt text;
  backup_sql text;
  update_sql text;
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

    SELECT c.column_name, c.udt_name
    INTO val_col, val_udt
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

    IF key_col IS NULL OR val_col IS NULL THEN
      CONTINUE;
    END IF;

    cond := format(
      '(position(''Ã'' in %1$I::text)>0 OR position(''Â'' in %1$I::text)>0 OR position(''�'' in %1$I::text)>0 OR position(''Ãƒ'' in %1$I::text)>0 OR position(''Ã‚'' in %1$I::text)>0 OR position(''ï¿½'' in %1$I::text)>0)',
      val_col
    );

    backup_sql := format($fmt$
      INSERT INTO public.mojibake_fix_backup(table_name, row_id, column_name, old_value, new_value)
      SELECT
        %L,
        CAST(%I AS text),
        %L,
        %I::text,
        public.fix_mojibake_latin1_utf8(%I::text)
      FROM public.%I
      WHERE %s
        AND public.fix_mojibake_latin1_utf8(%I::text) <> %I::text;
    $fmt$, 'public.' || tbl, key_col, val_col, val_col, val_col, tbl, cond, val_col, val_col);
    EXECUTE backup_sql;

    BEGIN
      IF val_udt = 'jsonb' THEN
        update_sql := format($fmt$
          UPDATE public.%I t
          SET %I = public.fix_mojibake_latin1_utf8(%I::text)::jsonb
          WHERE %s
            AND public.fix_mojibake_latin1_utf8(%I::text) <> %I::text;
        $fmt$, tbl, val_col, val_col, cond, val_col, val_col);
      ELSIF val_udt = 'json' THEN
        update_sql := format($fmt$
          UPDATE public.%I t
          SET %I = public.fix_mojibake_latin1_utf8(%I::text)::json
          WHERE %s
            AND public.fix_mojibake_latin1_utf8(%I::text) <> %I::text;
        $fmt$, tbl, val_col, val_col, cond, val_col, val_col);
      ELSE
        update_sql := format($fmt$
          UPDATE public.%I t
          SET %I = public.fix_mojibake_latin1_utf8(%I::text)
          WHERE %s
            AND public.fix_mojibake_latin1_utf8(%I::text) <> %I::text;
        $fmt$, tbl, val_col, val_col, cond, val_col, val_col);
      END IF;

      EXECUTE update_sql;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

COMMIT;
