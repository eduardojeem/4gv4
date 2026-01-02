
-- Corregir esquema de tabla customers
-- Descripción: Agrega las columnas first_name y last_name si faltan y migra datos

-- 1. Agregar columnas faltantes
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Migrar datos existentes (dividir name en first_name y last_name)
UPDATE public.customers 
SET 
  first_name = split_part(name, ' ', 1),
  last_name = NULLIF(TRIM(substring(name from length(split_part(name, ' ', 1)) + 1)), '')
WHERE (first_name IS NULL OR first_name = '') AND name IS NOT NULL;

-- 3. Asegurar que el trigger de sincronización exista y esté actualizado
CREATE OR REPLACE FUNCTION sync_customer_name()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se inserta name pero no first/last, actualizarlos
    IF (NEW.first_name IS NULL OR NEW.first_name = '') AND (NEW.name IS NOT NULL AND NEW.name != '') THEN
        NEW.first_name := split_part(NEW.name, ' ', 1);
        NEW.last_name := NULLIF(TRIM(substring(NEW.name from length(split_part(NEW.name, ' ', 1)) + 1)), '');
    -- Si se insertan first/last pero no name, actualizar name
    ELSIF (NEW.name IS NULL OR NEW.name = '') THEN
        NEW.name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_customer_name_trigger ON public.customers;

CREATE TRIGGER sync_customer_name_trigger
    BEFORE INSERT OR UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION sync_customer_name();
