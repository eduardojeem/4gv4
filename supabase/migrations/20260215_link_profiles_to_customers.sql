-- Agregar columna profile_id a customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_profile_id ON customers(profile_id);

-- Función para sincronizar profile -> customer
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    -- Solo sincronizar si el rol es cliente o mayorista
    IF NEW.role IN ('cliente', 'mayorista') THEN
        -- Verificar si ya existe un customer con este profile_id
        IF NOT EXISTS (SELECT 1 FROM customers WHERE profile_id = NEW.id) THEN
            -- Insertar nuevo cliente adaptado al esquema actual (customer_type y segment son TEXT)
            INSERT INTO customers (
                profile_id,
                name,
                first_name,
                last_name,
                email,
                phone,
                customer_type,
                segment,
                created_at,
                updated_at
            ) VALUES (
                NEW.id,
                COALESCE(NEW.full_name, 'Usuario'),
                COALESCE(split_part(NEW.full_name, ' ', 1), 'Usuario'),
                COALESCE(NULLIF(substring(NEW.full_name from position(' ' in NEW.full_name) + 1), ''), ''),
                NEW.email,
                COALESCE(NEW.phone, ''),
                CASE WHEN NEW.role = 'mayorista' THEN 'empresa' ELSE 'regular' END,
                CASE WHEN NEW.role = 'mayorista' THEN 'wholesale' ELSE 'regular' END,
                NOW(),
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar la sincronización al crear o actualizar perfil
DROP TRIGGER IF EXISTS on_profile_sync_customer ON profiles;
CREATE TRIGGER on_profile_sync_customer
    AFTER INSERT OR UPDATE OF role, full_name, email, phone ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_to_customer();

-- Sincronización retroactiva para usuarios existentes
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT * FROM profiles 
        WHERE role IN ('cliente', 'mayorista') 
        AND id NOT IN (SELECT profile_id FROM customers WHERE profile_id IS NOT NULL)
    LOOP
        INSERT INTO customers (
            profile_id,
            name,
            first_name,
            last_name,
            email,
            phone,
            customer_type,
            segment,
            created_at,
            updated_at
        ) VALUES (
            rec.id,
            COALESCE(rec.full_name, 'Usuario'),
            COALESCE(split_part(rec.full_name, ' ', 1), 'Usuario'),
            COALESCE(NULLIF(substring(rec.full_name from position(' ' in rec.full_name) + 1), ''), ''),
            rec.email,
            COALESCE(rec.phone, ''),
            CASE WHEN rec.role = 'mayorista' THEN 'empresa' ELSE 'regular' END,
            CASE WHEN rec.role = 'mayorista' THEN 'wholesale' ELSE 'regular' END,
            NOW(),
            NOW()
        );
    END LOOP;
END $$;

-- Actualizar política de lectura de ventas para permitir que los clientes vean sus compras
DO $$ BEGIN
  -- Intentar eliminar políticas existentes si existen
  DROP POLICY IF EXISTS "Usuarios pueden ver sus propias ventas" ON sales;
  DROP POLICY IF EXISTS "Clientes pueden ver sus compras" ON sales;
END $$;

CREATE POLICY "Clientes pueden ver sus compras" ON sales
    FOR SELECT USING (
        created_by = auth.uid() OR
        customer_id IN (
            SELECT id FROM customers WHERE profile_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );
