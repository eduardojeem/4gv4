-- Migración para Sistema de Segmentación de Clientes
-- Fecha: 2024-12-13
-- Descripción: Tablas para segmentación avanzada con IA

-- Tabla para almacenar segmentos de clientes
CREATE TABLE IF NOT EXISTS customer_segments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '{}',
    color VARCHAR(7) NOT NULL DEFAULT '#45B7D1', -- Hex color
    icon VARCHAR(50) NOT NULL DEFAULT 'target',
    is_active BOOLEAN NOT NULL DEFAULT true,
    auto_update BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 1,
    tags TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_priority CHECK (priority >= 1 AND priority <= 10),
    CONSTRAINT valid_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Tabla para analytics de segmentos
CREATE TABLE IF NOT EXISTS segment_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    segment_id UUID NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
    customer_count INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
    avg_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    conversion_rate DECIMAL(5,4) NOT NULL DEFAULT 0, -- 0.0000 to 1.0000
    growth_rate DECIMAL(6,2) NOT NULL DEFAULT 0, -- -999.99 to 999.99
    retention_rate DECIMAL(5,2) NOT NULL DEFAULT 0, -- 0.00 to 100.00
    engagement_score DECIMAL(5,2) NOT NULL DEFAULT 0, -- 0.00 to 100.00
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_conversion_rate CHECK (conversion_rate >= 0 AND conversion_rate <= 1),
    CONSTRAINT valid_retention_rate CHECK (retention_rate >= 0 AND retention_rate <= 100),
    CONSTRAINT valid_engagement_score CHECK (engagement_score >= 0 AND engagement_score <= 100),
    
    -- Unique constraint para evitar duplicados
    UNIQUE(segment_id)
);

-- Tabla para historial de cambios en segmentos
CREATE TABLE IF NOT EXISTS segment_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    segment_id UUID NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL, -- 'created', 'updated', 'deleted', 'recalculated'
    changes JSONB,
    previous_values JSONB,
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_action CHECK (action IN ('created', 'updated', 'deleted', 'recalculated'))
);

-- Tabla para insights de IA
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'opportunity', 'risk', 'trend', 'recommendation'
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    impact VARCHAR(10) NOT NULL, -- 'high', 'medium', 'low'
    confidence INTEGER NOT NULL, -- 0-100
    suggested_action TEXT NOT NULL,
    affected_customers INTEGER NOT NULL DEFAULT 0,
    potential_revenue DECIMAL(15,2),
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_type CHECK (type IN ('opportunity', 'risk', 'trend', 'recommendation')),
    CONSTRAINT valid_impact CHECK (impact IN ('high', 'medium', 'low')),
    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 100)
);

-- Tabla para reglas de automatización
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL, -- 'schedule', 'event', 'threshold'
    trigger_config JSONB NOT NULL DEFAULT '{}',
    action_type VARCHAR(50) NOT NULL, -- 'update_segment', 'send_campaign', 'create_task'
    action_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_executed TIMESTAMP WITH TIME ZONE,
    execution_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_customer_segments_active ON customer_segments(is_active);
CREATE INDEX IF NOT EXISTS idx_customer_segments_priority ON customer_segments(priority);
CREATE INDEX IF NOT EXISTS idx_customer_segments_created_by ON customer_segments(created_by);
CREATE INDEX IF NOT EXISTS idx_segment_analytics_segment_id ON segment_analytics(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_history_segment_id ON segment_history(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_history_action ON segment_history(action);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_active ON ai_insights(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_customer_segments_updated_at ON customer_segments;
CREATE TRIGGER update_customer_segments_updated_at 
    BEFORE UPDATE ON customer_segments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER update_automation_rules_updated_at 
    BEFORE UPDATE ON automation_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para registrar cambios en historial
CREATE OR REPLACE FUNCTION log_segment_changes()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO segment_history (segment_id, action, changes, performed_by)
        VALUES (NEW.id, 'created', to_jsonb(NEW), NEW.created_by);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO segment_history (segment_id, action, changes, previous_values, performed_by)
        VALUES (NEW.id, 'updated', to_jsonb(NEW), to_jsonb(OLD), NEW.created_by);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO segment_history (segment_id, action, previous_values)
        VALUES (OLD.id, 'deleted', to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger para historial de cambios
DROP TRIGGER IF EXISTS log_customer_segments_changes ON customer_segments;
CREATE TRIGGER log_customer_segments_changes
    AFTER INSERT OR UPDATE OR DELETE ON customer_segments
    FOR EACH ROW EXECUTE FUNCTION log_segment_changes();

-- RLS (Row Level Security) - Configuración básica
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas (ajustar según necesidades de seguridad)
DROP POLICY IF EXISTS "Users can view all segments" ON customer_segments;
CREATE POLICY "Users can view all segments" ON customer_segments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create segments" ON customer_segments;
CREATE POLICY "Users can create segments" ON customer_segments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update segments" ON customer_segments;
CREATE POLICY "Users can update segments" ON customer_segments FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete segments" ON customer_segments;
CREATE POLICY "Users can delete segments" ON customer_segments FOR DELETE USING (true);

DROP POLICY IF EXISTS "Users can view all analytics" ON segment_analytics;
CREATE POLICY "Users can view all analytics" ON segment_analytics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create analytics" ON segment_analytics;
CREATE POLICY "Users can create analytics" ON segment_analytics FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update analytics" ON segment_analytics;
CREATE POLICY "Users can update analytics" ON segment_analytics FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can view all history" ON segment_history;
CREATE POLICY "Users can view all history" ON segment_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view all insights" ON ai_insights;
CREATE POLICY "Users can view all insights" ON ai_insights FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create insights" ON ai_insights;
CREATE POLICY "Users can create insights" ON ai_insights FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update insights" ON ai_insights;
CREATE POLICY "Users can update insights" ON ai_insights FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can view all automation rules" ON automation_rules;
CREATE POLICY "Users can view all automation rules" ON automation_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create automation rules" ON automation_rules;
CREATE POLICY "Users can create automation rules" ON automation_rules FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update automation rules" ON automation_rules;
CREATE POLICY "Users can update automation rules" ON automation_rules FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete automation rules" ON automation_rules;
CREATE POLICY "Users can delete automation rules" ON automation_rules FOR DELETE USING (true);

-- Insertar algunos segmentos de ejemplo
INSERT INTO customer_segments (name, description, criteria, color, icon, priority, tags) VALUES
(
    'Clientes VIP Elite',
    'Clientes de máximo valor con historial de compras premium',
    '{"lifetimeValue": {"min": 10000}, "orderCount": {"min": 15}, "satisfactionScore": {"min": 4.5}}',
    '#FFD700',
    'star',
    1,
    ARRAY['alto-valor', 'premium', 'vip']
),
(
    'Clientes en Riesgo',
    'Clientes valiosos que no han comprado recientemente',
    '{"lifetimeValue": {"min": 3000}, "lastOrderDays": {"min": 60}, "satisfactionScore": {"max": 3.5}}',
    '#FF6B6B',
    'alert-triangle',
    1,
    ARRAY['riesgo', 'retención', 'urgente']
),
(
    'Nuevos Prometedores',
    'Clientes recién registrados con alto potencial',
    '{"registrationDays": {"max": 30}, "orderCount": {"min": 1, "max": 3}, "avgOrderValue": {"min": 200}}',
    '#4ECDC4',
    'users',
    2,
    ARRAY['nuevo', 'potencial', 'onboarding']
),
(
    'Compradores Frecuentes',
    'Clientes con patrones de compra muy regulares',
    '{"orderCount": {"min": 10}, "lastOrderDays": {"max": 30}, "purchaseFrequency": ["high"]}',
    '#45B7D1',
    'shopping-bag',
    2,
    ARRAY['frecuente', 'regular', 'fidelidad']
),
(
    'Clientes Empresariales',
    'Clientes que compran para uso empresarial',
    '{"customerType": ["empresa"], "avgOrderValue": {"min": 1000}, "orderCount": {"min": 3}}',
    '#2C3E50',
    'briefcase',
    3,
    ARRAY['empresarial', 'b2b', 'volumen']
)
ON CONFLICT DO NOTHING;

-- Insertar algunos insights de ejemplo
INSERT INTO ai_insights (type, title, description, impact, confidence, suggested_action, affected_customers, potential_revenue) VALUES
(
    'opportunity',
    'Oportunidad de Upselling Detectada',
    'Se han identificado 156 clientes frecuentes con patrones que sugieren interés en productos premium',
    'high',
    87,
    'Crear campaña de upselling personalizada para productos premium',
    156,
    45000.00
),
(
    'risk',
    'Clientes VIP en Riesgo de Abandono',
    '89 clientes VIP no han realizado compras en los últimos 60 días',
    'high',
    92,
    'Implementar campaña de retención personalizada con ofertas exclusivas',
    89,
    -120000.00
),
(
    'trend',
    'Crecimiento en Preferencia por WhatsApp',
    'Aumento del 34% en clientes que prefieren contacto por WhatsApp en los últimos 3 meses',
    'medium',
    78,
    'Expandir capacidades de atención al cliente por WhatsApp Business',
    234,
    NULL
)
ON CONFLICT DO NOTHING;

-- Comentarios para documentación
COMMENT ON TABLE customer_segments IS 'Almacena definiciones de segmentos de clientes con criterios y configuración';
COMMENT ON TABLE segment_analytics IS 'Métricas calculadas para cada segmento de clientes';
COMMENT ON TABLE segment_history IS 'Historial de cambios en segmentos para auditoría';
COMMENT ON TABLE ai_insights IS 'Insights generados por IA sobre oportunidades y riesgos';
COMMENT ON TABLE automation_rules IS 'Reglas de automatización para segmentos y campañas';

COMMENT ON COLUMN customer_segments.criteria IS 'Criterios de segmentación en formato JSON';
COMMENT ON COLUMN customer_segments.color IS 'Color hexadecimal para visualización del segmento';
COMMENT ON COLUMN customer_segments.icon IS 'Nombre del icono para representar el segmento';
COMMENT ON COLUMN segment_analytics.conversion_rate IS 'Tasa de conversión del segmento (0.0 a 1.0)';
COMMENT ON COLUMN segment_analytics.growth_rate IS 'Tasa de crecimiento mensual del segmento (%)';
COMMENT ON COLUMN ai_insights.confidence IS 'Nivel de confianza del insight (0-100)';
COMMENT ON COLUMN ai_insights.potential_revenue IS 'Impacto potencial en ingresos (positivo o negativo)';

-- Verificación final
SELECT 'Migración de segmentación completada exitosamente' as status;