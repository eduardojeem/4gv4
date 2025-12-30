-- Sample data for testing the Customer Dashboard
-- Run this AFTER the main migration (20241130_customers_complete_setup.sql)

INSERT INTO public.customers (
    name, email, phone, customer_type, status, segment, 
    city, address, total_purchases, lifetime_value, 
    avg_order_value, loyalty_points, notes, tags
) VALUES 
    -- VIP Customers
    (
        'María González', 
        'maria.gonzalez@example.com', 
        '+598 99 123 456', 
        'premium', 
        'active', 
        'high_value', 
        'Montevideo',
        'Av. 18 de Julio 1234',
        15, 
        2850.50, 
        190.03,
        1250,
        'Cliente VIP, siempre puntual en pagos',
        ARRAY['VIP', 'Fidelizado', 'Recomendador']
    ),
    (
        'Carmen Vega', 
        'carmen.vega@example.com', 
        '+598 99 789 012', 
        'vip', 
        'active', 
        'vip', 
        'Montevideo',
        'Carrasco 7890',
        32, 
        5680.90, 
        177.53,
        2840,
        'Cliente VIP estrella, máxima prioridad',
        ARRAY['VIP', 'Estrella', 'Embajadora']
    ),
    
    -- Premium Customers
    (
        'Patricia López', 
        'patricia.lopez@example.com', 
        '+598 99 567 890', 
        'premium', 
        'active', 
        'high_value', 
        'Montevideo',
        'Punta Carretas 5678',
        18, 
        3150.80, 
        175.04,
        1580,
        'Cliente premium muy activa',
        ARRAY['Premium', 'Activa', 'Recomendadora']
    ),
    (
        'Sofía Herrera', 
        'sofia.herrera@example.com', 
        '+598 99 901 234', 
        'premium', 
        'active', 
        'high_value', 
        'Montevideo',
        'Buceo 9012',
        21, 
        3780.45, 
        180.02,
        1890,
        'Cliente premium muy satisfecha',
        ARRAY['Premium', 'Satisfecha', 'Leal']
    ),
    
    -- Regular Active Customers
    (
        'Carlos Rodríguez', 
        'carlos.rodriguez@example.com', 
        '+598 99 234 567', 
        'regular', 
        'active', 
        'regular', 
        'Montevideo',
        'Av. Brasil 2345',
        8, 
        1420.30, 
        177.54,
        680,
        'Cliente regular, buen pagador',
        ARRAY['Regular', 'Puntual']
    ),
    (
        'Diego Morales', 
        'diego.morales@example.com', 
        '+598 99 890 123', 
        'regular', 
        'active', 
        'regular', 
        'Montevideo',
        'Centro 8901',
        12, 
        1890.60, 
        157.55,
        945,
        'Cliente confiable, pagos puntuales',
        ARRAY['Confiable', 'Puntual']
    ),
    
    -- Inactive Customers  
    (
        'Luis Fernández', 
        'luis.fernandez@example.com', 
        '+598 99 456 789', 
        'regular', 
        'inactive', 
        'low_value', 
        'Montevideo',
        'Cordón 4567',
        3, 
        450.20, 
        150.07,
        120,
        'Cliente inactivo, necesita seguimiento',
        ARRAY['Inactivo', 'Seguimiento']
    ),
    (
        'Alejandro Castro', 
        'alejandro.castro@example.com', 
        '+598 99 012 345', 
        'regular', 
        'inactive', 
        'low_value', 
        'Montevideo',
        'La Teja 0123',
        6, 
        720.30, 
        120.05,
        240,
        'Cliente inactivo desde noviembre',
        ARRAY['Inactivo', 'Reactivar']
    ),
    
    -- New/Pending Customers
    (
        'Roberto Silva', 
        'roberto.silva@example.com', 
        '+598 99 678 901', 
        'regular', 
        'pending', 
        'new', 
        'Montevideo',
        'Malvín 6789',
        5, 
        890.40, 
        178.08,
        350,
        'Cliente nuevo, en proceso de verificación',
        ARRAY['Nuevo', 'Verificación']
    ),
    (
        'Fernando Jiménez', 
        'fernando.jimenez@example.com', 
        '+598 99 234 567', 
        'regular', 
        'pending', 
        'new', 
        'Montevideo',
        'Tres Cruces 2345',
        4, 
        650.80, 
        162.70,
        325,
        'Cliente nuevo con buen potencial',
        ARRAY['Nuevo', 'Potencial']
    );

-- Update last_visit for some customers
UPDATE public.customers 
SET last_visit = NOW() - INTERVAL '2 days'
WHERE email IN ('maria.gonzalez@example.com', 'carmen.vega@example.com');

UPDATE public.customers 
SET last_visit = NOW() - INTERVAL '1 week'
WHERE email IN ('carlos.rodriguez@example.com', 'patricia.lopez@example.com');

UPDATE public.customers 
SET last_visit = NOW() - INTERVAL '1 month'
WHERE status = 'inactive';

-- Verify the data
SELECT 
    customer_code,
    name,
    email,
    customer_type,
    status,
    segment,
    total_purchases,
    lifetime_value
FROM public.customers
ORDER BY created_at DESC;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Sample data inserted successfully!';
    RAISE NOTICE '📊 Total customers: %', (SELECT COUNT(*) FROM public.customers);
END $$;
