-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'vendedor', 'tecnico', 'cliente');
CREATE TYPE customer_type AS ENUM ('nuevo', 'regular', 'frecuente', 'vip');
CREATE TYPE payment_method AS ENUM ('efectivo', 'tarjeta', 'transferencia');
CREATE TYPE sale_status AS ENUM ('pendiente', 'completada', 'cancelada');
CREATE TYPE repair_status AS ENUM ('recibido', 'diagnostico', 'reparacion', 'listo', 'entregado');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'cliente',
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    document TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    customer_type customer_type DEFAULT 'nuevo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE suppliers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    payment_terms TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    brand TEXT,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    purchase_price DECIMAL(10,2) NOT NULL,
    sale_price DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales table
CREATE TABLE sales (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    total DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    payment_method payment_method NOT NULL,
    status sale_status DEFAULT 'pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sale items table
CREATE TABLE sale_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Repairs table
CREATE TABLE repairs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    device_brand TEXT NOT NULL,
    device_model TEXT NOT NULL,
    device_serial TEXT,
    problem_description TEXT NOT NULL,
    diagnosis TEXT,
    estimated_cost DECIMAL(10,2),
    final_cost DECIMAL(10,2),
    status repair_status DEFAULT 'recibido',
    received_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estimated_completion TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE,
    delivered_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Repair photos table
CREATE TABLE repair_photos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    repair_id UUID REFERENCES repairs(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_stock ON products(stock);
CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_repairs_status ON repairs(status);
CREATE INDEX idx_repairs_customer ON repairs(customer_id);
CREATE INDEX idx_repairs_technician ON repairs(technician_id);
CREATE INDEX idx_repairs_date ON repairs(created_at);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repairs_updated_at BEFORE UPDATE ON repairs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_photos ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Customers policies
CREATE POLICY "Authenticated users can view customers" ON customers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and vendedores can manage customers" ON customers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );

-- Products policies
CREATE POLICY "Authenticated users can view products" ON products
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage products" ON products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Sales policies
CREATE POLICY "Users can view own sales" ON sales
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );

CREATE POLICY "Vendedores and admins can create sales" ON sales
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );

-- Repairs policies
CREATE POLICY "Technicians can view assigned repairs" ON repairs
    FOR SELECT USING (
        technician_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );

CREATE POLICY "Admins and vendedores can manage repairs" ON repairs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );

-- Kanban orders table to persist user-specific board order
CREATE TABLE IF NOT EXISTS kanban_orders (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    board TEXT NOT NULL,
    order_json JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, board)
);

-- Enable RLS for kanban_orders
ALTER TABLE kanban_orders ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own kanban orders
CREATE POLICY "Users can view own kanban orders" ON kanban_orders
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own kanban orders" ON kanban_orders
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own kanban orders" ON kanban_orders
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Insert default categories
INSERT INTO categories (name, description) VALUES
    ('Celulares', 'Dispositivos móviles'),
    ('Repuestos', 'Partes y componentes para reparación'),
    ('Accesorios', 'Fundas, cargadores, auriculares, etc.'),
    ('Insumos', 'Herramientas y materiales de reparación');

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Cash register management
-- Types for cash movements
CREATE TYPE IF NOT EXISTS cash_movement_type AS ENUM ('opening', 'sale', 'in', 'out', 'closing');

-- Cash registers table
CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    is_open BOOLEAN DEFAULT FALSE,
    balance DECIMAL(12,2) DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cash movements table
CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    register_id UUID REFERENCES cash_registers(id) ON DELETE CASCADE,
    type cash_movement_type NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    note TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_registers_open ON cash_registers(is_open);
CREATE INDEX IF NOT EXISTS idx_cash_registers_updated ON cash_registers(updated_at);
CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cash_movements(register_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_timestamp ON cash_movements(timestamp);

-- updated_at trigger for cash_registers
CREATE TRIGGER update_cash_registers_updated_at BEFORE UPDATE ON cash_registers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

-- Policies for cash_registers
CREATE POLICY IF NOT EXISTS "Authenticated users can view cash registers" ON cash_registers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Admins and vendedores can manage cash registers" ON cash_registers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );

-- Policies for cash_movements
CREATE POLICY IF NOT EXISTS "Authenticated users can view cash movements" ON cash_movements
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Admins and vendedores can insert cash movements" ON cash_movements
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );

-- Cash closures (reportes y cierres)
CREATE TYPE IF NOT EXISTS cash_closure_type AS ENUM ('Z', 'X');

CREATE TABLE IF NOT EXISTS cash_closures (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    register_id UUID REFERENCES cash_registers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    closure_type cash_closure_type DEFAULT 'Z',
    opening_amount DECIMAL(12,2) NOT NULL,
    cash_sales_total DECIMAL(12,2) DEFAULT 0,
    cash_in_total DECIMAL(12,2) DEFAULT 0,
    cash_out_total DECIMAL(12,2) DEFAULT 0,
    closing_amount DECIMAL(12,2) NOT NULL,
    expected_amount DECIMAL(12,2) NOT NULL,
    discrepancy DECIMAL(12,2) DEFAULT 0,
    card_sales_total DECIMAL(12,2) DEFAULT 0,
    transfer_sales_total DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_closures_register ON cash_closures(register_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_closed_at ON cash_closures(closed_at);

-- updated_at trigger for cash_closures
CREATE TRIGGER update_cash_closures_updated_at BEFORE UPDATE ON cash_closures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can view cash closures" ON cash_closures
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Admins and vendedores can insert cash closures" ON cash_closures
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );
-- Optional extended product columns for brand/model/location and flags
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_on_sale boolean DEFAULT false;

-- Generated column to support server-side low-stock filtering
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_low_stock boolean GENERATED ALWAYS AS ((stock > 0) AND (stock <= min_stock)) STORED;

-- Helpful indexes for search and ordering
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products (stock);
CREATE INDEX IF NOT EXISTS idx_products_sale_price ON products (sale_price);
CREATE INDEX IF NOT EXISTS idx_products_is_low_stock ON products (is_low_stock);

-- Generated column for margin percent and helpful index
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS margin_percent numeric GENERATED ALWAYS AS (
    CASE 
      WHEN purchase_price > 0 THEN ROUND(((sale_price - purchase_price) / purchase_price) * 100, 2)
      ELSE 0
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_margin_percent ON products (margin_percent);