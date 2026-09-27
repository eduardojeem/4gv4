-- Create supplier related tables for integrations and metrics
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

