-- Crear tabla de clientes
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code TEXT,
    name TEXT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    ruc TEXT,
    customer_type TEXT DEFAULT 'regular',
    status TEXT DEFAULT 'active',
    
    -- Métricas y estadísticas
    total_purchases INTEGER DEFAULT 0,
    total_repairs INTEGER DEFAULT 0,
    lifetime_value DECIMAL(10, 2) DEFAULT 0,
    avg_order_value DECIMAL(10, 2) DEFAULT 0,
    purchase_frequency TEXT DEFAULT 'low',
    last_purchase_amount DECIMAL(10, 2) DEFAULT 0,
    total_spent_this_year DECIMAL(10, 2) DEFAULT 0,
    
    -- Información de contacto y perfil
    address TEXT,
    city TEXT,
    birthday DATE,
    preferred_contact TEXT DEFAULT 'email',
    whatsapp TEXT,
    social_media JSONB,
    avatar TEXT,
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Información comercial
    company TEXT,
    position TEXT,
    referral_source TEXT,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    payment_terms TEXT DEFAULT 'Contado',
    assigned_salesperson TEXT,
    
    -- Crédito y fidelización
    credit_score INTEGER DEFAULT 0,
    credit_limit DECIMAL(10, 2) DEFAULT 0,
    current_balance DECIMAL(10, 2) DEFAULT 0,
    pending_amount DECIMAL(10, 2) DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    satisfaction_score INTEGER DEFAULT 0,
    segment TEXT DEFAULT 'regular',
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_visit TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_ruc ON public.customers(ruc);
CREATE INDEX IF NOT EXISTS idx_customers_customer_code ON public.customers(customer_code);

-- Habilitar RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Allow all operations on customers" ON public.customers FOR ALL USING (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para actualizar updated_at
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON public.customers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Función para sincronizar name con first_name/last_name
CREATE OR REPLACE FUNCTION sync_customer_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name IS NULL OR NEW.name = '' THEN
        NEW.name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_customer_name_trigger
    BEFORE INSERT OR UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION sync_customer_name();
