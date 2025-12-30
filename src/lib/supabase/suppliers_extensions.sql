-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create supplier_products table
CREATE TABLE IF NOT EXISTS supplier_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    suppliersku TEXT,
    internalsku TEXT,
    unitprice DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplierid UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    ordernumber TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, received, cancelled
    subtotal DECIMAL(10, 2) DEFAULT 0,
    taxamount DECIMAL(10, 2) DEFAULT 0,
    shippingamount DECIMAL(10, 2) DEFAULT 0,
    totalamount DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    productid UUID REFERENCES supplier_products(id), -- Linked to supplier product
    quantity DECIMAL(10, 2) NOT NULL,
    unitprice DECIMAL(10, 2) NOT NULL,
    totalprice DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add some dummy data for supplier_products if empty
DO $$
DECLARE
    supplier_id_val UUID;
BEGIN
    -- Get a supplier ID (limit 1)
    SELECT id INTO supplier_id_val FROM suppliers LIMIT 1;
    
    IF supplier_id_val IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM supplier_products) THEN
            INSERT INTO supplier_products (supplier_id, name, suppliersku, unitprice, currency)
            VALUES 
            (supplier_id_val, 'iPhone 13 Pro', 'APL-13P-128', 999.00, 'USD'),
            (supplier_id_val, 'Samsung Galaxy S22', 'SAM-S22-256', 850.00, 'USD'),
            (supplier_id_val, 'MacBook Air M1', 'APL-MBA-M1', 950.00, 'USD');
        END IF;
    END IF;
END $$;
