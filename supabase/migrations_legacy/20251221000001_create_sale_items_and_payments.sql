
-- Create sale_items table if not exists
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID, -- Removed strict FK to products to avoid failure if products table missing or RLS issues
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payments table if not exists
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference_number TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

-- Enable RLS
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Sale Items
CREATE POLICY "Authenticated users can view sale items" ON sale_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create sale items" ON sale_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for Payments
CREATE POLICY "Authenticated users can view payments" ON payments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create payments" ON payments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
