-- Add wholesale_price to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(10,2);

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL, -- e.g., "Size: L", "Color: Red"
    sku TEXT UNIQUE,
    price_adjustment DECIMAL(10,2) DEFAULT 0, -- Added to base price
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- 'percentage', 'fixed_amount', 'bogo', 'combo'
    value DECIMAL(10,2), -- Percentage or fixed amount
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    conditions JSONB, -- Flexible conditions (e.g., min_quantity, specific_products)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cash_register_sessions table (if not exists, distinct from cash_closures)
-- This table tracks the active period of a cash register being open
CREATE TABLE IF NOT EXISTS cash_register_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    register_id UUID REFERENCES cash_registers(id) ON DELETE CASCADE,
    opened_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    opening_balance DECIMAL(12,2) NOT NULL,
    closing_balance DECIMAL(12,2),
    expected_balance DECIMAL(12,2),
    discrepancy DECIMAL(12,2),
    status TEXT DEFAULT 'open', -- 'open', 'closed'
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sessions_register ON cash_register_sessions(register_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON cash_register_sessions(status);

-- Enable RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Product Variants
CREATE POLICY "Authenticated users can view variants" ON product_variants
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and vendedores can manage variants" ON product_variants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );

-- Promotions
CREATE POLICY "Authenticated users can view promotions" ON promotions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage promotions" ON promotions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Cash Register Sessions
CREATE POLICY "Authenticated users can view sessions" ON cash_register_sessions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and vendedores can manage sessions" ON cash_register_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
        )
    );

-- Triggers for updated_at
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cash_register_sessions_updated_at BEFORE UPDATE ON cash_register_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
