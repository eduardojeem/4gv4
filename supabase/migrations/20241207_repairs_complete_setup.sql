-- =====================================================
-- SCRIPT COMPLETO: Sistema de Reparaciones
-- Fecha: 2024-12-07
-- Descripción: Crea estructura completa para gestión de reparaciones
-- =====================================================

-- =====================================================
-- PARTE 1: LIMPIEZA (Opcional - comentar si no necesitas)
-- =====================================================

-- Desactivar RLS temporalmente
ALTER TABLE IF EXISTS repair_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS repair_parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS repair_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS repair_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS repairs DISABLE ROW LEVEL SECURITY;

-- Eliminar políticas
DROP POLICY IF EXISTS "Allow all for authenticated users" ON repair_images;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON repair_parts;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON repair_notes;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON repair_status_history;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON repairs;

-- Eliminar vistas
DROP VIEW IF EXISTS repairs_full CASCADE;
DROP VIEW IF EXISTS repair_stats CASCADE;
DROP VIEW IF EXISTS technician_workload CASCADE;

-- Eliminar triggers
DROP TRIGGER IF EXISTS update_repairs_updated_at ON repairs;
DROP TRIGGER IF EXISTS track_repair_status_changes ON repairs;
DROP TRIGGER IF EXISTS update_repair_progress ON repairs;

-- Eliminar funciones
DROP FUNCTION IF EXISTS track_status_change() CASCADE;
DROP FUNCTION IF EXISTS calculate_repair_progress() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Eliminar tablas
DROP TABLE IF EXISTS repair_images CASCADE;
DROP TABLE IF EXISTS repair_parts CASCADE;
DROP TABLE IF EXISTS repair_notes CASCADE;
DROP TABLE IF EXISTS repair_status_history CASCADE;
DROP TABLE IF EXISTS repairs CASCADE;

-- =====================================================
-- PARTE 2: CREAR ESTRUCTURA
-- =====================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tipos ENUM para repairs
DO $$ BEGIN
  CREATE TYPE repair_status AS ENUM (
    'recibido',      -- Repair received
    'diagnostico',   -- In diagnosis
    'reparacion',    -- In repair
    'listo',         -- Ready for pickup
    'entregado'      -- Delivered
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE repair_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE repair_urgency AS ENUM ('normal', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE device_type AS ENUM (
    'smartphone',
    'tablet',
    'laptop',
    'desktop',
    'accessory',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabla principal: repairs
CREATE TABLE repairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Customer information (FK to customers table)
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  
  -- Device information
  device_type device_type DEFAULT 'smartphone',
  device_brand VARCHAR(100) NOT NULL,
  device_model VARCHAR(100) NOT NULL,
  serial_number VARCHAR(100),
  imei VARCHAR(50),
  
  -- Problem description
  problem_description TEXT NOT NULL,
  diagnosis TEXT,
  solution TEXT,
  
  -- Status and priority
  status repair_status DEFAULT 'recibido',
  priority repair_priority DEFAULT 'medium',
  urgency repair_urgency DEFAULT 'normal',
  
  -- Technician assignment
  technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Costs
  estimated_cost DECIMAL(10, 2) DEFAULT 0,
  final_cost DECIMAL(10, 2),
  labor_cost DECIMAL(10, 2) DEFAULT 0,
  parts_cost DECIMAL(10, 2) DEFAULT 0,
  
  -- Location and warranty
  location VARCHAR(100) DEFAULT 'Taller Principal',
  warranty_months INTEGER DEFAULT 0,
  warranty_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Dates
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  estimated_completion TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Progress tracking
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Customer satisfaction
  customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
  customer_feedback TEXT,
  
  -- Notifications
  notify_customer BOOLEAN DEFAULT true,
  notify_technician BOOLEAN DEFAULT true,
  notify_manager BOOLEAN DEFAULT false,
  
  -- Additional metadata
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Soft delete
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabla: repair_status_history
CREATE TABLE repair_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_id UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  old_status repair_status,
  new_status repair_status NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: repair_notes
CREATE TABLE repair_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_id UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name VARCHAR(200) NOT NULL,
  note_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: repair_parts
CREATE TABLE repair_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_id UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  part_name VARCHAR(200) NOT NULL,
  part_number VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  supplier VARCHAR(200),
  status VARCHAR(50) DEFAULT 'pending', -- pending, ordered, received, installed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: repair_images
CREATE TABLE repair_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_id UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type VARCHAR(50) DEFAULT 'general', -- general, before, after, diagnostic
  description TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PARTE 3: CREAR ÍNDICES
-- =====================================================

-- Índices repairs
CREATE INDEX idx_repairs_customer_id ON repairs(customer_id);
CREATE INDEX idx_repairs_technician_id ON repairs(technician_id);
CREATE INDEX idx_repairs_status ON repairs(status);
CREATE INDEX idx_repairs_priority ON repairs(priority);
CREATE INDEX idx_repairs_urgency ON repairs(urgency);
CREATE INDEX idx_repairs_device_type ON repairs(device_type);
CREATE INDEX idx_repairs_created_at ON repairs(created_at DESC);
CREATE INDEX idx_repairs_completed_at ON repairs(completed_at DESC);
CREATE INDEX idx_repairs_is_deleted ON repairs(is_deleted) WHERE is_deleted = false;
CREATE INDEX idx_repairs_search ON repairs USING gin(
  to_tsvector('spanish', 
    device_brand || ' ' || 
    device_model || ' ' || 
    COALESCE(problem_description, '') || ' ' || 
    COALESCE(diagnosis, '')
  )
);

-- Índices repair_status_history
CREATE INDEX idx_repair_status_history_repair_id ON repair_status_history(repair_id);
CREATE INDEX idx_repair_status_history_created_at ON repair_status_history(created_at DESC);

-- Índices repair_notes
CREATE INDEX idx_repair_notes_repair_id ON repair_notes(repair_id);
CREATE INDEX idx_repair_notes_author_id ON repair_notes(author_id);
CREATE INDEX idx_repair_notes_created_at ON repair_notes(created_at DESC);

-- Índices repair_parts
CREATE INDEX idx_repair_parts_repair_id ON repair_parts(repair_id);
CREATE INDEX idx_repair_parts_product_id ON repair_parts(product_id);
CREATE INDEX idx_repair_parts_status ON repair_parts(status);

-- Índices repair_images
CREATE INDEX idx_repair_images_repair_id ON repair_images(repair_id);
CREATE INDEX idx_repair_images_image_type ON repair_images(image_type);

-- =====================================================
-- PARTE 4: CREAR FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para rastrear cambios de estado
CREATE OR REPLACE FUNCTION track_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO repair_status_history (
      repair_id, old_status, new_status, changed_by, notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.technician_id,
      'Estado cambiado automáticamente'
    );
    
    -- Actualizar fechas según el estado
    IF NEW.status = 'listo' AND OLD.status != 'listo' THEN
      NEW.completed_at = NOW();
      NEW.progress = 100;
    END IF;
    
    IF NEW.status = 'entregado' AND OLD.status != 'entregado' THEN
      NEW.delivered_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular progreso automático
CREATE OR REPLACE FUNCTION calculate_repair_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular progreso basado en el estado
  NEW.progress = CASE NEW.status
    WHEN 'recibido' THEN 10
    WHEN 'diagnostico' THEN 30
    WHEN 'reparacion' THEN 60
    WHEN 'listo' THEN 100
    WHEN 'entregado' THEN 100
    ELSE NEW.progress
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers
CREATE TRIGGER update_repairs_updated_at 
  BEFORE UPDATE ON repairs
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER track_repair_status_changes 
  BEFORE UPDATE ON repairs
  FOR EACH ROW 
  EXECUTE FUNCTION track_status_change();

CREATE TRIGGER update_repair_progress 
  BEFORE INSERT OR UPDATE ON repairs
  FOR EACH ROW 
  EXECUTE FUNCTION calculate_repair_progress();

CREATE TRIGGER update_repair_notes_updated_at 
  BEFORE UPDATE ON repair_notes
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PARTE 5: CREAR VISTAS
-- =====================================================

-- Vista completa de reparaciones con información relacionada
CREATE OR REPLACE VIEW repairs_full AS
SELECT 
  r.*,
  -- Customer info
  c.first_name || ' ' || c.last_name as customer_name,
  c.phone as customer_phone,
  c.email as customer_email,
  -- Technician info
  p.full_name as technician_name,
  p.email as technician_email,
  -- Calculated fields
  (r.final_cost - r.estimated_cost) as cost_variance,
  CASE 
    WHEN r.completed_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (r.completed_at - r.created_at))/3600
    ELSE 
      EXTRACT(EPOCH FROM (NOW() - r.created_at))/3600
  END as hours_in_repair,
  -- Counts
  (SELECT COUNT(*) FROM repair_notes WHERE repair_id = r.id) as notes_count,
  (SELECT COUNT(*) FROM repair_parts WHERE repair_id = r.id) as parts_count,
  (SELECT COUNT(*) FROM repair_images WHERE repair_id = r.id) as images_count
FROM repairs r
LEFT JOIN customers c ON r.customer_id = c.id
LEFT JOIN profiles p ON r.technician_id = p.id
WHERE r.is_deleted = false;

-- Vista de estadísticas de reparaciones
CREATE OR REPLACE VIEW repair_stats AS
SELECT 
  COUNT(*) as total_repairs,
  COUNT(*) FILTER (WHERE status = 'recibido') as pending_repairs,
  COUNT(*) FILTER (WHERE status = 'diagnostico') as in_diagnosis,
  COUNT(*) FILTER (WHERE status = 'reparacion') as in_repair,
  COUNT(*) FILTER (WHERE status = 'listo') as ready_for_pickup,
  COUNT(*) FILTER (WHERE status = 'entregado') as delivered,
  COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
  COUNT(*) FILTER (WHERE urgency = 'urgent') as urgent_repairs,
  AVG(final_cost) as avg_repair_cost,
  SUM(final_cost) as total_revenue,
  AVG(customer_rating) as avg_customer_rating,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) as avg_completion_hours
FROM repairs
WHERE is_deleted = false;

-- Vista de carga de trabajo por técnico
CREATE OR REPLACE VIEW technician_workload AS
SELECT 
  p.id as technician_id,
  p.full_name as technician_name,
  COUNT(*) as total_repairs,
  COUNT(*) FILTER (WHERE r.status IN ('diagnostico', 'reparacion')) as active_repairs,
  COUNT(*) FILTER (WHERE r.status = 'listo') as completed_repairs,
  AVG(r.customer_rating) as avg_rating,
  SUM(r.final_cost) as total_revenue,
  AVG(EXTRACT(EPOCH FROM (r.completed_at - r.created_at))/3600) as avg_completion_hours
FROM profiles p
LEFT JOIN repairs r ON p.id = r.technician_id AND r.is_deleted = false
WHERE p.role = 'technician'
GROUP BY p.id, p.full_name;

-- =====================================================
-- PARTE 6: CONFIGURAR RLS
-- =====================================================

ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_images ENABLE ROW LEVEL SECURITY;

-- Políticas para repairs
CREATE POLICY "Allow all for authenticated users" ON repairs
  FOR ALL 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON repair_status_history
  FOR ALL 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON repair_notes
  FOR ALL 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON repair_parts
  FOR ALL 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON repair_images
  FOR ALL 
  USING (auth.role() = 'authenticated');

-- =====================================================
-- PARTE 7: VERIFICACIÓN
-- =====================================================

DO $$
DECLARE
  tables_count INTEGER;
  repairs_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tables_count
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('repairs', 'repair_status_history', 'repair_notes', 'repair_parts', 'repair_images');
  
  SELECT COUNT(*) INTO repairs_count FROM repairs;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INSTALACIÓN DE REPAIRS COMPLETADA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tablas creadas: %', tables_count;
  RAISE NOTICE 'Reparaciones insertadas: %', repairs_count;
  RAISE NOTICE '';
  
  IF tables_count = 5 THEN
    RAISE NOTICE '✓✓✓ ÉXITO ✓✓✓';
    RAISE NOTICE 'El sistema de reparaciones está listo';
  ELSE
    RAISE NOTICE '⚠ Advertencia: Verifica la instalación';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- FIN DEL SCRIPT DE ESTRUCTURA
-- =====================================================
