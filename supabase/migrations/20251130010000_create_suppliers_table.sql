-- Create suppliers table from scratch
-- This is the base table for the suppliers module
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
