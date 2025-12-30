-- Verificar y crear tabla customers si no existe
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla customers si no existe
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  phone VARCHAR,
  address TEXT,
  city VARCHAR,
  customer_type VARCHAR DEFAULT 'regular' CHECK (customer_type IN ('premium', 'empresa', 'regular')),
  status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  segment VARCHAR DEFAULT 'regular',
  total_purchases INTEGER DEFAULT 0,
  total_repairs INTEGER DEFAULT 0,
  credit_score INTEGER DEFAULT 0 CHECK (credit_score >= 0 AND credit_score <= 10),
  satisfaction_score INTEGER DEFAULT 0 CHECK (satisfaction_score >= 0 AND satisfaction_score <= 10),
  lifetime_value DECIMAL DEFAULT 0,
  avg_order_value DECIMAL DEFAULT 0,
  purchase_frequency VARCHAR DEFAULT 'low' CHECK (purchase_frequency IN ('low', 'medium', 'high')),
  preferred_contact VARCHAR DEFAULT 'email' CHECK (preferred_contact IN ('email', 'phone', 'whatsapp', 'sms')),
  loyalty_points INTEGER DEFAULT 0,
  credit_limit DECIMAL DEFAULT 0,
  current_balance DECIMAL DEFAULT 0,
  pending_amount DECIMAL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  discount_percentage DECIMAL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  payment_terms VARCHAR DEFAULT 'Contado',
  assigned_salesperson VARCHAR DEFAULT 'Sin asignar',
  last_purchase_amount DECIMAL DEFAULT 0,
  total_spent_this_year DECIMAL DEFAULT 0,
  notes TEXT,
  birthday DATE,
  ruc VARCHAR,
  whatsapp VARCHAR,
  social_media VARCHAR,
  company VARCHAR,
  position VARCHAR,
  referral_source VARCHAR,
  last_visit TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_customer_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(segment);
CREATE INDEX IF NOT EXISTS idx_customers_city ON customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas para acceso público (para desarrollo)
-- NOTA: En producción, estas políticas deberían ser más restrictivas
DROP POLICY IF EXISTS "Allow public read access" ON customers;
CREATE POLICY "Allow public read access" ON customers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert" ON customers;
CREATE POLICY "Allow public insert" ON customers
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update" ON customers;
CREATE POLICY "Allow public update" ON customers
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete" ON customers;
CREATE POLICY "Allow public delete" ON customers
  FOR DELETE USING (true);

-- 5. Insertar datos de ejemplo si la tabla está vacía
INSERT INTO customers (name, email, phone, city, customer_type, segment, lifetime_value, credit_score, satisfaction_score)
SELECT * FROM (VALUES
  ('Juan Pérez', 'juan.perez@email.com', '+595981123456', 'Asunción', 'premium', 'vip', 2500000, 8, 9),
  ('María González', 'maria.gonzalez@email.com', '+595981234567', 'Ciudad del Este', 'regular', 'regular', 850000, 6, 7),
  ('Carlos López', 'carlos.lopez@email.com', '+595981345678', 'Encarnación', 'empresa', 'premium', 1200000, 7, 8),
  ('Ana Rodríguez', 'ana.rodriguez@email.com', '+595981456789', 'Asunción', 'regular', 'regular', 650000, 5, 6),
  ('Luis Martínez', 'luis.martinez@email.com', '+595981567890', 'San Lorenzo', 'premium', 'vip', 3200000, 9, 10),
  ('Carmen Silva', 'carmen.silva@email.com', '+595981678901', 'Fernando de la Mora', 'regular', 'regular', 420000, 4, 5),
  ('Roberto Benítez', 'roberto.benitez@email.com', '+595981789012', 'Lambaré', 'empresa', 'premium', 1800000, 8, 9),
  ('Patricia Morales', 'patricia.morales@email.com', '+595981890123', 'Capiatá', 'premium', 'vip', 2100000, 7, 8),
  ('Diego Fernández', 'diego.fernandez@email.com', '+595981901234', 'Mariano Roque Alonso', 'regular', 'regular', 380000, 3, 4),
  ('Lucía Ramírez', 'lucia.ramirez@email.com', '+595981012345', 'Ñemby', 'regular', 'regular', 720000, 6, 7),
  ('Andrés Cabrera', 'andres.cabrera@email.com', '+595982123456', 'Villa Elisa', 'empresa', 'premium', 1500000, 8, 9),
  ('Sofía Duarte', 'sofia.duarte@email.com', '+595982234567', 'Luque', 'premium', 'vip', 2800000, 9, 10),
  ('Miguel Torres', 'miguel.torres@email.com', '+595982345678', 'Itauguá', 'regular', 'regular', 560000, 5, 6),
  ('Valentina Ruiz', 'valentina.ruiz@email.com', '+595982456789', 'Guarambaré', 'regular', 'regular', 340000, 4, 5),
  ('Sebastián Vega', 'sebastian.vega@email.com', '+595982567890', 'Villeta', 'empresa', 'premium', 1300000, 7, 8)
) AS new_customers(name, email, phone, city, customer_type, segment, lifetime_value, credit_score, satisfaction_score)
WHERE NOT EXISTS (SELECT 1 FROM customers LIMIT 1);

-- 6. Actualizar campos calculados
UPDATE customers SET
  customer_code = COALESCE(customer_code, 'CLI-' || SUBSTRING(id::text, 1, 6)),
  avg_order_value = CASE 
    WHEN total_purchases > 0 THEN lifetime_value / total_purchases 
    ELSE 0 
  END,
  updated_at = NOW()
WHERE customer_code IS NULL OR avg_order_value = 0;

-- 7. Verificar que todo esté correcto
SELECT 
  'customers' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT email) as unique_emails,
  COUNT(DISTINCT customer_type) as customer_types,
  COUNT(DISTINCT segment) as segments,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM customers;

-- 8. Mostrar algunos registros de ejemplo
SELECT 
  id,
  name,
  email,
  phone,
  city,
  customer_type,
  segment,
  lifetime_value,
  status,
  created_at
FROM customers 
ORDER BY created_at DESC 
LIMIT 5;

-- 9. Verificar políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'customers';