-- ============================================================================
-- MIGRACIONES COMPLETAS PARA MÓDULO DE PROVEEDORES
-- Ejecutar en Supabase Studio SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. CREATE SUPPLIERS TABLE
-- ============================================================================
BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Information
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country TEXT,
  postal_code TEXT,
  website TEXT,
  
  -- Business Information
  business_type TEXT CHECK (business_type IN ('manufacturer','distributor','wholesaler','retailer','service_provider')),
  
  -- Status and Performance
  status TEXT DEFAULT 'pending' CHECK (status IN ('active','inactive','pending','suspended')),
  rating INTEGER DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  
  -- Product and Order Information
  products_count INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON public.suppliers(email);
CREATE INDEX IF NOT EXISTS idx_suppliers_contact ON public.suppliers(contact_person);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_type ON public.suppliers(business_type);
CREATE INDEX IF NOT EXISTS idx_suppliers_created ON public.suppliers(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================================
-- 2. CREATE SUPPLIER RELATED TABLES
-- ============================================================================
BEGIN;

-- Supplier products
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplierSKU TEXT,
  internalSKU TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unitPrice NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  minimumOrderQuantity INTEGER NOT NULL DEFAULT 1,
  leadTimeDays INTEGER NOT NULL DEFAULT 0,
  availability TEXT CHECK (availability IN ('in_stock','low_stock','out_of_stock','discontinued')),
  lastUpdated TIMESTAMPTZ DEFAULT NOW(),
  syncStatus TEXT CHECK (syncStatus IN ('pending','synced','error')) DEFAULT 'synced'
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON public.supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_sku ON public.supplier_products(supplierSKU);
CREATE INDEX IF NOT EXISTS idx_supplier_products_availability ON public.supplier_products(availability);

-- Purchase orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orderNumber TEXT NOT NULL UNIQUE,
  supplierId UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplierName TEXT,
  status TEXT CHECK (status IN ('draft','sent','confirmed','shipped','delivered','cancelled')) DEFAULT 'draft',
  orderDate TIMESTAMPTZ DEFAULT NOW(),
  expectedDeliveryDate TIMESTAMPTZ,
  actualDeliveryDate TIMESTAMPTZ,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  shippingCost NUMERIC(12,2) NOT NULL DEFAULT 0,
  totalAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  syncStatus TEXT CHECK (syncStatus IN ('pending','synced','error')) DEFAULT 'synced',
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplierId);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON public.purchase_orders(orderDate);

-- Purchase order items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID,
  supplierSKU TEXT,
  internalSKU TEXT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unitPrice NUMERIC(12,2) NOT NULL,
  lineTotal NUMERIC(12,2) NOT NULL,
  status TEXT CHECK (status IN ('pending','confirmed','shipped','received','cancelled')) DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON public.purchase_order_items(order_id);

-- Inventory reorders
CREATE TABLE IF NOT EXISTS public.inventory_reorders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  productId UUID,
  currentStock INTEGER NOT NULL,
  reorderPoint INTEGER NOT NULL,
  reorderQuantity INTEGER NOT NULL,
  preferredSupplierId UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  urgency TEXT CHECK (urgency IN ('low','medium','high','critical')) DEFAULT 'medium',
  estimatedCost NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT CHECK (status IN ('pending','ordered','completed','cancelled')) DEFAULT 'pending',
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  processedAt TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventory_reorders_supplier ON public.inventory_reorders(preferredSupplierId);
CREATE INDEX IF NOT EXISTS idx_inventory_reorders_status ON public.inventory_reorders(status);

COMMIT;

-- ============================================================================
-- 3. ENABLE RLS AND CREATE POLICIES
-- ============================================================================
BEGIN;

-- Enable RLS
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_reorders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated can view supplier_products" ON public.supplier_products;
DROP POLICY IF EXISTS "Admins can manage supplier_products" ON public.supplier_products;
DROP POLICY IF EXISTS "Authenticated can view purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Admins can manage purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Authenticated can view purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Admins can manage purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Authenticated can view inventory_reorders" ON public.inventory_reorders;
DROP POLICY IF EXISTS "Admins can manage inventory_reorders" ON public.inventory_reorders;

-- Suppliers policies
CREATE POLICY "Authenticated can view suppliers" ON public.suppliers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage suppliers" ON public.suppliers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Supplier products policies
CREATE POLICY "Authenticated can view supplier_products" ON public.supplier_products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage supplier_products" ON public.supplier_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Purchase orders policies
CREATE POLICY "Authenticated can view purchase_orders" ON public.purchase_orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage purchase_orders" ON public.purchase_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Purchase order items policies
CREATE POLICY "Authenticated can view purchase_order_items" ON public.purchase_order_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage purchase_order_items" ON public.purchase_order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Inventory reorders policies
CREATE POLICY "Authenticated can view inventory_reorders" ON public.inventory_reorders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage inventory_reorders" ON public.inventory_reorders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMIT;

-- ============================================================================
-- 4. SEED SAMPLE DATA
-- ============================================================================
BEGIN;

-- Insert sample suppliers
INSERT INTO public.suppliers (name, contact_person, email, phone, city, country, website, business_type, status, rating, notes)
VALUES
  ('Distribuidora ABC', 'Juan Pérez', 'contacto@abc.com', '+595 21 111111', 'Asunción', 'Paraguay', 'https://abc.com', 'distributor', 'active', 4, 'Proveedor confiable'),
  ('Mayorista XYZ', 'María López', 'ventas@xyz.com', '+595 21 222222', 'Lambaré', 'Paraguay', 'https://xyz.com', 'wholesaler', 'active', 5, 'Buen precio por volumen'),
  ('Servicios MNO', 'Carlos Díaz', 'info@mno.com', '+595 21 333333', 'Luque', 'Paraguay', 'https://mno.com', 'service_provider', 'pending', 3, 'En evaluación'),
  ('Retailer QRS', 'Ana Gómez', 'contact@qrs.com', '+595 21 444444', 'San Lorenzo', 'Paraguay', 'https://qrs.com', 'retailer', 'inactive', 2, 'Actividad baja'),
  ('Fabricante TUV', 'Pedro Silva', 'atencion@tuv.com', '+595 21 555555', 'Fernando de la Mora', 'Paraguay', 'https://tuv.com', 'manufacturer', 'active', 5, 'Tiempo de entrega óptimo')
ON CONFLICT DO NOTHING;

-- Link products to first two suppliers
WITH s AS (
  SELECT id, name FROM public.suppliers WHERE name IN ('Distribuidora ABC','Mayorista XYZ')
)
INSERT INTO public.supplier_products (supplier_id, supplierSKU, internalSKU, name, category, unitPrice, currency, minimumOrderQuantity, leadTimeDays, availability)
SELECT s.id, CONCAT('SKU-', RIGHT(md5(s.name), 6)), CONCAT('INT-', RIGHT(md5(s.name), 6)), 
  CASE WHEN s.name = 'Distribuidora ABC' THEN 'Cargador USB-C' ELSE 'Funda de silicona' END,
  CASE WHEN s.name = 'Distribuidora ABC' THEN 'Accesorios' ELSE 'Accesorios' END,
  CASE WHEN s.name = 'Distribuidora ABC' THEN 45.00 ELSE 25.00 END,
  'USD', 10,
  CASE WHEN s.name = 'Distribuidora ABC' THEN 7 ELSE 5 END,
  'in_stock'
FROM s
ON CONFLICT DO NOTHING;

-- Create a sample purchase order for Distribuidora ABC
WITH sup AS (
  SELECT id, name FROM public.suppliers WHERE name = 'Distribuidora ABC'
)
INSERT INTO public.purchase_orders (orderNumber, supplierId, supplierName, status, subtotal, taxAmount, shippingCost, totalAmount, currency)
SELECT CONCAT('PO-', to_char(NOW(),'YYYYMMDDHH24MISS')), sup.id, sup.name, 'confirmed', 450.00, 45.00, 0.00, 495.00, 'USD' FROM sup
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- 5. CREATE SUPPLIER STATS FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION get_supplier_stats()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_suppliers', COUNT(*),
    'active_suppliers', COUNT(*) FILTER (WHERE status = 'active'),
    'inactive_suppliers', COUNT(*) FILTER (WHERE status = 'inactive'),
    'pending_suppliers', COUNT(*) FILTER (WHERE status = 'pending'),
    'avg_rating', COALESCE(AVG(rating), 0),
    'total_orders', COALESCE(SUM(total_orders), 0),
    'total_amount', COALESCE(SUM(total_amount), 0)
  ) INTO result
  FROM suppliers;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_supplier_stats() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_supplier_stats() IS 'Returns aggregated statistics for all suppliers in a single query for better performance';

-- ============================================================================
-- 6. SEED PURCHASE ORDER ITEMS
-- ============================================================================
BEGIN;

WITH po AS (
  SELECT id FROM public.purchase_orders WHERE supplierName = 'Distribuidora ABC' ORDER BY createdAt DESC LIMIT 1
)
INSERT INTO public.purchase_order_items (order_id, product_id, supplierSKU, internalSKU, name, quantity, unitPrice, lineTotal, status)
SELECT po.id, NULL, 'SKU-USB-C-001', 'INT-USB-C-001', 'Cargador USB-C', 10, 45.00, 450.00, 'confirmed'
FROM po
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- 7. UPDATE SUPPLIER TOTALS
-- ============================================================================
BEGIN;

-- Update total_orders and total_amount using purchase_orders
UPDATE public.suppliers s
SET total_orders = COALESCE(po.cnt, 0),
    total_amount = COALESCE(po.sum, 0)
FROM (
  SELECT supplierId AS sid, COUNT(*) AS cnt, COALESCE(SUM(totalAmount), 0) AS sum
  FROM public.purchase_orders
  GROUP BY supplierId
) po
WHERE po.sid = s.id;

-- Update products_count using supplier_products
UPDATE public.suppliers s
SET products_count = COALESCE(sp.cnt, 0)
FROM (
  SELECT supplier_id AS sid, COUNT(*) AS cnt
  FROM public.supplier_products
  GROUP BY supplier_id
) sp
WHERE sp.sid = s.id;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- Verify with: SELECT * FROM suppliers;
-- Test stats function: SELECT get_supplier_stats();
-- ============================================================================
