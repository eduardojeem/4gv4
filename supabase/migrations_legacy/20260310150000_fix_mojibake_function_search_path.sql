-- Fix function public.fix_mojibake_latin1_utf8 has a role mutable search_path
-- Adding SET search_path = public to the function definition

CREATE OR REPLACE FUNCTION public.fix_mojibake_latin1_utf8(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
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
