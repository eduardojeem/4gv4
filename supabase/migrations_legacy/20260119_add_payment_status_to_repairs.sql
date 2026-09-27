-- Agregar columnas de pago a la tabla repairs
ALTER TABLE repairs 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pendiente', -- pendiente, parcial, pagado
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2) DEFAULT 0;

-- Crear un índice para búsquedas rápidas por estado de pago
CREATE INDEX IF NOT EXISTS idx_repairs_payment_status ON repairs(payment_status);

-- Actualizar registros existentes basados en el estado de la reparación
-- Si está entregado, asumimos que está pagado (lógica heredada)
UPDATE repairs 
SET payment_status = 'pagado', 
    paid_amount = final_cost 
WHERE status = 'entregado' AND payment_status = 'pendiente';

-- Si está listo, asumimos pendiente
UPDATE repairs 
SET payment_status = 'pendiente', 
    paid_amount = 0 
WHERE status = 'listo' AND payment_status = 'pendiente';
