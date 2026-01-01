-- =====================================================
-- CUSTOMERS TABLE - COMPLETE SETUP
-- =====================================================
-- This migration creates the customers table with all fields,
-- indexes, RLS policies, and triggers for the Customer Dashboard
-- =====================================================

-- 1. Enable required extensions FIRST
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Move to extensions schema if it was already in public (for backward compatibility)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension e 
        JOIN pg_namespace n ON e.extnamespace = n.oid 
        WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
    ) THEN
        ALTER EXTENSION pg_trgm SET SCHEMA extensions;
    END IF;
END $$;

-- 2. Create customers table if not exists
CREATE TABLE IF NOT EXISTS public.customers (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Information
    customer_code TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    ruc TEXT,
    
    -- Classification
    customer_type TEXT DEFAULT 'regular' CHECK (customer_type IN ('regular', 'premium', 'vip', 'empresa')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
    segment TEXT DEFAULT 'regular' CHECK (segment IN ('vip', 'premium', 'regular', 'new', 'high_value', 'low_value', 'business', 'wholesale')),
    
    -- Location
    address TEXT,
    city TEXT,
    
    -- Metrics
    total_purchases INTEGER DEFAULT 0,
    total_repairs INTEGER DEFAULT 0,
    credit_score NUMERIC(3,1) DEFAULT 0 CHECK (credit_score >= 0 AND credit_score <= 10),
    satisfaction_score NUMERIC(3,1) DEFAULT 0 CHECK (satisfaction_score >= 0 AND satisfaction_score <= 10),
    lifetime_value NUMERIC(12,2) DEFAULT 0,
    avg_order_value NUMERIC(12,2) DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    
    -- Financial
    credit_limit NUMERIC(12,2) DEFAULT 0,
    current_balance NUMERIC(12,2) DEFAULT 0,
    pending_amount NUMERIC(12,2) DEFAULT 0,
    discount_percentage NUMERIC(5,2) DEFAULT 0,
    last_purchase_amount NUMERIC(12,2) DEFAULT 0,
    total_spent_this_year NUMERIC(12,2) DEFAULT 0,
    
    -- Text fields
    purchase_frequency TEXT DEFAULT 'low' CHECK (purchase_frequency IN ('very_high', 'high', 'medium', 'low')),
    preferred_contact TEXT DEFAULT 'email' CHECK (preferred_contact IN ('email', 'phone', 'whatsapp', 'sms')),
    payment_terms TEXT DEFAULT 'Contado',
    notes TEXT,
    
    -- Additional contact
    whatsapp TEXT,
    social_media TEXT,
    
    -- Business info
    company TEXT,
    position TEXT,
    referral_source TEXT,
    assigned_salesperson TEXT DEFAULT 'Sin asignar',
    
    -- Tags (array)
    tags TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_visit TIMESTAMPTZ,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    birthday DATE,
    registration_date TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_customer_code ON public.customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_customer_type ON public.customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_segment ON public.customers(segment);
CREATE INDEX IF NOT EXISTS idx_customers_city ON public.customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON public.customers USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_tags ON public.customers USING gin(tags);

-- 4. Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Create function to auto-generate customer_code
CREATE OR REPLACE FUNCTION public.generate_customer_code()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    IF NEW.customer_code IS NULL THEN
        NEW.customer_code := 'CLI-' || LPAD(NEXTVAL('public.customer_code_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create sequence for customer codes
CREATE SEQUENCE IF NOT EXISTS customer_code_seq START 1;

-- 8. Create trigger for auto-generating customer_code
DROP TRIGGER IF EXISTS generate_customer_code_trigger ON public.customers;
CREATE TRIGGER generate_customer_code_trigger
    BEFORE INSERT ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_customer_code();

-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 10. Drop existing policies if any
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.customers;

-- 11. Create RLS Policies
-- Allow authenticated users to read all customers
CREATE POLICY "Enable read access for authenticated users"
    ON public.customers
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert customers
CREATE POLICY "Enable insert for authenticated users"
    ON public.customers
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update customers
CREATE POLICY "Enable update for authenticated users"
    ON public.customers
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to delete customers
CREATE POLICY "Enable delete for authenticated users"
    ON public.customers
    FOR DELETE
    TO authenticated
    USING (true);

-- 12. Create view for customer statistics
CREATE OR REPLACE VIEW public.customer_stats AS
SELECT 
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE status = 'active') as active_customers,
    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_customers,
    COUNT(*) FILTER (WHERE customer_type = 'vip') as vip_customers,
    COUNT(*) FILTER (WHERE customer_type = 'premium') as premium_customers,
    COALESCE(AVG(lifetime_value), 0) as avg_lifetime_value,
    COALESCE(SUM(lifetime_value), 0) as total_revenue,
    COALESCE(AVG(satisfaction_score), 0) as avg_satisfaction_score
FROM public.customers;

-- 13. Grant permissions to authenticated users
GRANT SELECT ON public.customer_stats TO authenticated;

-- 14. Enable Realtime for customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'customers'
      AND pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
  END IF;
END $$;

-- 15. Create function to search customers (for autocomplete)
CREATE OR REPLACE FUNCTION public.search_customers(search_term TEXT)
RETURNS TABLE (
    id UUID,
    customer_code TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    similarity REAL
) 
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.customer_code,
        c.name,
        c.email,
        c.phone,
        GREATEST(
            similarity(c.name, search_term),
            similarity(c.email, search_term),
            similarity(COALESCE(c.phone, ''), search_term),
            similarity(COALESCE(c.customer_code, ''), search_term)
        ) as similarity
    FROM public.customers c
    WHERE 
        c.name ILIKE '%' || search_term || '%' OR
        c.email ILIKE '%' || search_term || '%' OR
        c.phone ILIKE '%' || search_term || '%' OR
        c.customer_code ILIKE '%' || search_term || '%'
    ORDER BY similarity DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- 16. Comments for documentation
COMMENT ON TABLE public.customers IS 'Stores customer information with complete business logic';
COMMENT ON COLUMN public.customers.customer_code IS 'Auto-generated unique customer code (CLI-XXXXXX)';
COMMENT ON COLUMN public.customers.segment IS 'Customer segmentation for marketing and analytics';
COMMENT ON COLUMN public.customers.lifetime_value IS 'Total revenue generated by this customer';
COMMENT ON COLUMN public.customers.tags IS 'Array of tags for flexible categorization';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Configuración de tabla de clientes completada exitosamente!';
    RAISE NOTICE '📊 Índices creados para rendimiento óptimo';
    RAISE NOTICE '🔒 Políticas RLS habilitadas';
    RAISE NOTICE '🔄 Tiempo real habilitado';
    RAISE NOTICE '🔍 Función de búsqueda creada';
END $$;
