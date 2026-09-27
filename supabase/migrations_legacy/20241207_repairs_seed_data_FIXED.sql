-- =====================================================
-- SCRIPT DE DATOS DE EJEMPLO: Sistema de Reparaciones
-- Fecha: 2024-12-07 (CORREGIDO)
-- Descripción: Inserta datos de ejemplo para testing
-- =====================================================

-- =====================================================
-- NOTA IMPORTANTE
-- =====================================================
-- Este script asume que ya existen:
-- 1. Tabla customers con algunos clientes
-- 2. Tabla profiles con algunos técnicos (role = 'technician')
-- =====================================================

-- =====================================================
-- PARTE 1: VERIFICAR DATOS EXISTENTES
-- =====================================================

DO $$
DECLARE
  customers_count INTEGER;
  technicians_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO customers_count FROM customers;
  SELECT COUNT(*) INTO technicians_count FROM profiles WHERE role = 'technician';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN DE DATOS EXISTENTES';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Clientes disponibles: %', customers_count;
  RAISE NOTICE 'Técnicos disponibles: %', technicians_count;
  RAISE NOTICE '';
  
  IF customers_count = 0 THEN
    RAISE EXCEPTION 'No hay clientes en la base de datos. Crea al menos un cliente primero.';
  END IF;
  
  IF technicians_count = 0 THEN
    RAISE EXCEPTION 'No hay técnicos en la base de datos. Promover al menos un usuario a técnico primero.';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- PARTE 2: INSERTAR REPARACIONES DE EJEMPLO
-- =====================================================

DO $$
DECLARE
  customer1_id UUID;
  customer2_id UUID;
  customer3_id UUID;
  customer4_id UUID;
  customer5_id UUID;
  tech1_id UUID;
  tech2_id UUID;
  tech3_id UUID;
  repair1_id UUID := '10000000-0000-0000-0000-000000000001';
  repair2_id UUID := '10000000-0000-0000-0000-000000000002';
  repair3_id UUID := '10000000-0000-0000-0000-000000000003';
  repair4_id UUID := '10000000-0000-0000-0000-000000000004';
  repair5_id UUID := '10000000-0000-0000-0000-000000000005';
  repair6_id UUID := '10000000-0000-0000-0000-000000000006';
  repair7_id UUID := '10000000-0000-0000-0000-000000000007';
  repair8_id UUID := '10000000-0000-0000-0000-000000000008';
  repair9_id UUID := '10000000-0000-0000-0000-000000000009';
  repair10_id UUID := '10000000-0000-0000-0000-000000000010';
BEGIN
  -- Obtener clientes (primeros 5)
  SELECT id INTO customer1_id FROM customers ORDER BY created_at LIMIT 1 OFFSET 0;
  SELECT id INTO customer2_id FROM customers ORDER BY created_at LIMIT 1 OFFSET 1;
  SELECT id INTO customer3_id FROM customers ORDER BY created_at LIMIT 1 OFFSET 2;
  SELECT id INTO customer4_id FROM customers ORDER BY created_at LIMIT 1 OFFSET 3;
  SELECT id INTO customer5_id FROM customers ORDER BY created_at LIMIT 1 OFFSET 4;
  
  -- Si no hay suficientes clientes, reutilizar los que hay
  IF customer2_id IS NULL THEN customer2_id := customer1_id; END IF;
  IF customer3_id IS NULL THEN customer3_id := customer1_id; END IF;
  IF customer4_id IS NULL THEN customer4_id := customer1_id; END IF;
  IF customer5_id IS NULL THEN customer5_id := customer1_id; END IF;
  
  -- Obtener técnicos (primeros 3)
  SELECT id INTO tech1_id FROM profiles WHERE role = 'technician' ORDER BY created_at LIMIT 1 OFFSET 0;
  SELECT id INTO tech2_id FROM profiles WHERE role = 'technician' ORDER BY created_at LIMIT 1 OFFSET 1;
  SELECT id INTO tech3_id FROM profiles WHERE role = 'technician' ORDER BY created_at LIMIT 1 OFFSET 2;
  
  -- Si no hay suficientes técnicos, reutilizar los que hay
  IF tech2_id IS NULL THEN tech2_id := tech1_id; END IF;
  IF tech3_id IS NULL THEN tech3_id := tech1_id; END IF;
  
  -- Insertar reparaciones
  
  -- Reparación 1: iPhone con pantalla rota (Recibido)
  INSERT INTO repairs (
    id, customer_id, device_type, device_brand, device_model, serial_number,
    problem_description, diagnosis, status, priority, urgency,
    technician_id, estimated_cost, labor_cost,
    created_at, estimated_completion
  ) VALUES (
    repair1_id, customer1_id, 'smartphone', 'Apple', 'iPhone 13 Pro',
    'F2LXK3MNPP7H',
    'Pantalla completamente rota después de caída. Touch no responde.',
    'Pantalla LCD dañada, requiere reemplazo completo. Resto del dispositivo funcional.',
    'recibido', 'high', 'urgent',
    tech1_id, 3500.00, 500.00,
    NOW() - INTERVAL '2 hours', NOW() + INTERVAL '2 days'
  );
  
  -- Reparación 2: Samsung en diagnóstico
  INSERT INTO repairs (
    id, customer_id, device_type, device_brand, device_model,
    problem_description, diagnosis, status, priority, urgency,
    technician_id, estimated_cost, labor_cost,
    created_at, estimated_completion
  ) VALUES (
    repair2_id, customer2_id, 'smartphone', 'Samsung', 'Galaxy S22 Ultra',
    'No enciende, batería se descarga muy rápido.',
    'Batería hinchada, requiere reemplazo urgente. Puerto de carga con corrosión.',
    'diagnostico', 'high', 'normal',
    tech1_id, 2800.00, 400.00,
    NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days'
  );
  
  -- Reparación 3: Laptop en reparación
  INSERT INTO repairs (
    id, customer_id, device_type, device_brand, device_model,
    problem_description, diagnosis, solution, status, priority, urgency,
    technician_id, estimated_cost, final_cost, labor_cost,
    created_at, estimated_completion
  ) VALUES (
    repair3_id, customer3_id, 'laptop', 'Dell', 'XPS 15 9520',
    'Sobrecalentamiento y apagados aleatorios.',
    'Pasta térmica seca, ventiladores con polvo. Requiere limpieza profunda.',
    'Limpieza completa, reemplazo de pasta térmica, actualización de BIOS.',
    'reparacion', 'medium', 'normal',
    tech2_id, 1200.00, 1200.00, 800.00,
    NOW() - INTERVAL '3 days', NOW() + INTERVAL '1 day'
  );
  
  -- Reparación 4: Tablet lista para entrega
  INSERT INTO repairs (
    id, customer_id, device_type, device_brand, device_model,
    problem_description, diagnosis, solution, status, priority, urgency,
    technician_id, estimated_cost, final_cost, labor_cost,
    created_at, completed_at, estimated_completion,
    customer_rating, customer_feedback
  ) VALUES (
    repair4_id, customer4_id, 'tablet', 'Apple', 'iPad Air 5',
    'Botón de encendido no funciona.',
    'Botón de encendido dañado por líquido. Requiere reemplazo de flex.',
    'Reemplazo de flex de botón de encendido. Limpieza de líquido residual.',
    'listo', 'low', 'normal',
    tech2_id, 1500.00, 1500.00, 600.00,
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days',
    5, 'Excelente servicio, muy rápido y profesional.'
  );
  
  -- Reparación 5: Smartphone entregado
  INSERT INTO repairs (
    id, customer_id, device_type, device_brand, device_model,
    problem_description, diagnosis, solution, status, priority, urgency,
    technician_id, estimated_cost, final_cost, labor_cost,
    created_at, completed_at, delivered_at, estimated_completion,
    customer_rating, customer_feedback, warranty_months
  ) VALUES (
    repair5_id, customer5_id, 'smartphone', 'Xiaomi', 'Redmi Note 11',
    'Cámara trasera no enfoca correctamente.',
    'Lente de cámara rayado. Módulo de cámara desalineado.',
    'Reemplazo de módulo de cámara completo. Calibración de software.',
    'entregado', 'medium', 'normal',
    tech3_id, 1800.00, 1800.00, 500.00,
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '4 days',
    4, 'Buen trabajo, aunque tardó un poco más de lo esperado.',
    3
  );
  
  -- Reparación 6: Desktop en diagnóstico
  INSERT INTO repairs (
    id, customer_id, device_type, device_brand, device_model,
    problem_description, status, priority, urgency,
    technician_id, estimated_cost,
    created_at, estimated_completion
  ) VALUES (
    repair6_id, customer1_id, 'desktop', 'HP', 'Pavilion Gaming',
    'No da video, ventiladores giran pero no hay señal en monitor.',
    'diagnostico', 'high', 'normal',
    tech1_id, 2500.00,
    NOW() - INTERVAL '6 hours', NOW() + INTERVAL '2 days'
  );
  
  -- Reparación 7: Accesorio recibido
  INSERT INTO repairs (
    id, customer_id, device_type, device_brand, device_model,
    problem_description, status, priority, urgency,
    estimated_cost,
    created_at, estimated_completion
  ) VALUES (
    repair7_id, customer2_id, 'accessory', 'Apple', 'AirPods Pro 2',
    'Estuche de carga no carga, LED no enciende.',
    'recibido', 'low', 'normal',
    800.00,
    NOW() - INTERVAL '1 hour', NOW() + INTERVAL '5 days'
  );
  
  -- Reparación 8: Laptop en reparación urgente
  INSERT INTO repairs (
    id, customer_id, device_type, device_brand, device_model,
    problem_description, diagnosis, status, priority, urgency,
    technician_id, estimated_cost, labor_cost,
    created_at, estimated_completion
  ) VALUES (
    repair8_id, customer3_id, 'laptop', 'Lenovo', 'ThinkPad X1 Carbon',
    'Derrame de líquido, teclado no funciona.',
    'Líquido en placa madre. Requiere limpieza ultrasónica urgente.',
    'reparacion', 'high', 'urgent',
    tech3_id, 4500.00, 1500.00,
    NOW() - INTERVAL '4 hours', NOW() + INTERVAL '1 day'
  );
  
  -- Reparación 9: Smartphone completado
  INSERT INTO repairs (
    id, customer_id, device_type, device_brand, device_model,
    problem_description, diagnosis, solution, status, priority, urgency,
    technician_id, estimated_cost, final_cost, labor_cost,
    created_at, completed_at, estimated_completion,
    warranty_months
  ) VALUES (
    repair9_id, customer4_id, 'smartphone', 'Motorola', 'Edge 30',
    'Puerto de carga flojo, no carga correctamente.',
    'Puerto USB-C dañado por uso. Requiere reemplazo.',
    'Reemplazo de puerto USB-C. Limpieza de contactos.',
    'listo', 'medium', 'normal',
    tech2_id, 900.00, 900.00, 400.00,
    NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days',
    2
  );
  
  -- Reparación 10: Tablet en diagnóstico
  INSERT INTO repairs (
    id, customer_id, device_type, device_brand, device_model,
    problem_description, status, priority, urgency,
    technician_id, estimated_cost,
    created_at, estimated_completion
  ) VALUES (
    repair10_id, customer5_id, 'tablet', 'Samsung', 'Galaxy Tab S8',
    'Touch funciona intermitentemente, pantalla con líneas.',
    'diagnostico', 'medium', 'normal',
    tech1_id, 3200.00,
    NOW() - INTERVAL '12 hours', NOW() + INTERVAL '3 days'
  );
  
  RAISE NOTICE 'Reparaciones insertadas exitosamente';
  
  -- =====================================================
  -- PARTE 3: INSERTAR NOTAS DE REPARACIÓN
  -- =====================================================
  
  -- Notas para reparación 1
  INSERT INTO repair_notes (repair_id, author_id, author_name, note_text, is_internal) VALUES
  (repair1_id, tech1_id, 'Técnico', 'Cliente reporta que el dispositivo cayó desde 1.5m de altura.', false),
  (repair1_id, tech1_id, 'Técnico', 'Pantalla original de Apple, cotización enviada al cliente.', true);
  
  -- Notas para reparación 2
  INSERT INTO repair_notes (repair_id, author_id, author_name, note_text, is_internal) VALUES
  (repair2_id, tech1_id, 'Técnico', 'Batería hinchada detectada, riesgo de explosión. Prioridad alta.', true),
  (repair2_id, tech1_id, 'Técnico', 'Cliente notificado sobre el estado de la batería.', false);
  
  -- Notas para reparación 3
  INSERT INTO repair_notes (repair_id, author_id, author_name, note_text, is_internal) VALUES
  (repair3_id, tech2_id, 'Técnico', 'Limpieza profunda completada. Temperaturas ahora normales.', false),
  (repair3_id, tech2_id, 'Técnico', 'BIOS actualizado a última versión. Pruebas de estrés OK.', true);
  
  -- Notas para reparación 4
  INSERT INTO repair_notes (repair_id, author_id, author_name, note_text, is_internal) VALUES
  (repair4_id, tech2_id, 'Técnico', 'Reparación completada. Dispositivo probado 24 horas sin problemas.', false);
  
  -- Notas para reparación 8
  INSERT INTO repair_notes (repair_id, author_id, author_name, note_text, is_internal) VALUES
  (repair8_id, tech3_id, 'Técnico', 'Limpieza ultrasónica en proceso. Placa madre en revisión.', true);
  
  RAISE NOTICE 'Notas de reparación insertadas';
  
  -- =====================================================
  -- PARTE 4: INSERTAR PARTES UTILIZADAS
  -- =====================================================
  
  -- Partes para reparación 1 (iPhone pantalla)
  INSERT INTO repair_parts (repair_id, part_name, part_number, quantity, unit_cost, supplier, status) VALUES
  (repair1_id, 'Pantalla LCD iPhone 13 Pro Original', 'A2483-LCD-OEM', 1, 3000.00, 'Tech Distributors SA', 'ordered');
  
  -- Partes para reparación 2 (Samsung batería)
  INSERT INTO repair_parts (repair_id, part_name, part_number, quantity, unit_cost, supplier, status) VALUES
  (repair2_id, 'Batería Samsung Galaxy S22 Ultra', 'EB-BS908ABY', 1, 1800.00, 'Tech Distributors SA', 'ordered'),
  (repair2_id, 'Puerto USB-C Samsung', 'USB-C-S22U', 1, 600.00, 'Tech Distributors SA', 'pending');
  
  -- Partes para reparación 3 (Laptop pasta térmica)
  INSERT INTO repair_parts (repair_id, part_name, part_number, quantity, unit_cost, supplier, status) VALUES
  (repair3_id, 'Pasta Térmica Arctic MX-4', 'MX-4-4G', 1, 150.00, 'Interno', 'installed'),
  (repair3_id, 'Kit de limpieza para laptop', 'CLEAN-KIT-01', 1, 250.00, 'Interno', 'installed');
  
  -- Partes para reparación 4 (iPad botón)
  INSERT INTO repair_parts (repair_id, part_name, part_number, quantity, unit_cost, supplier, status) VALUES
  (repair4_id, 'Flex de botón de encendido iPad Air 5', 'IPAD-AIR5-PWR', 1, 900.00, 'Tech Distributors SA', 'installed');
  
  -- Partes para reparación 5 (Xiaomi cámara)
  INSERT INTO repair_parts (repair_id, part_name, part_number, quantity, unit_cost, supplier, status) VALUES
  (repair5_id, 'Módulo de cámara Redmi Note 11', 'RN11-CAM-MAIN', 1, 1300.00, 'Tech Distributors SA', 'installed');
  
  -- Partes para reparación 8 (Laptop líquido)
  INSERT INTO repair_parts (repair_id, part_name, part_number, quantity, unit_cost, supplier, status) VALUES
  (repair8_id, 'Teclado Lenovo ThinkPad X1 Carbon', 'TP-X1C-KB-US', 1, 2500.00, 'Tech Distributors SA', 'ordered'),
  (repair8_id, 'Servicio de limpieza ultrasónica', 'CLEAN-ULTRA', 1, 500.00, 'Interno', 'installed');
  
  -- Partes para reparación 9 (Motorola puerto)
  INSERT INTO repair_parts (repair_id, part_name, part_number, quantity, unit_cost, supplier, status) VALUES
  (repair9_id, 'Puerto USB-C Motorola Edge 30', 'MOTO-E30-USBC', 1, 500.00, 'Tech Distributors SA', 'installed');
  
  RAISE NOTICE 'Partes de reparación insertadas';
  
  -- =====================================================
  -- PARTE 5: INSERTAR HISTORIAL DE ESTADOS
  -- =====================================================
  
  -- Historial para reparación 3 (en reparación)
  INSERT INTO repair_status_history (repair_id, old_status, new_status, changed_by, notes) VALUES
  (repair3_id, NULL, 'recibido', tech2_id, 'Reparación recibida'),
  (repair3_id, 'recibido', 'diagnostico', tech2_id, 'Iniciando diagnóstico'),
  (repair3_id, 'diagnostico', 'reparacion', tech2_id, 'Diagnóstico completado, iniciando reparación');
  
  -- Historial para reparación 4 (lista)
  INSERT INTO repair_status_history (repair_id, old_status, new_status, changed_by, notes) VALUES
  (repair4_id, NULL, 'recibido', tech2_id, 'Reparación recibida'),
  (repair4_id, 'recibido', 'diagnostico', tech2_id, 'Iniciando diagnóstico'),
  (repair4_id, 'diagnostico', 'reparacion', tech2_id, 'Reparación en proceso'),
  (repair4_id, 'reparacion', 'listo', tech2_id, 'Reparación completada y probada');
  
  -- Historial para reparación 5 (entregada)
  INSERT INTO repair_status_history (repair_id, old_status, new_status, changed_by, notes) VALUES
  (repair5_id, NULL, 'recibido', tech3_id, 'Reparación recibida'),
  (repair5_id, 'recibido', 'diagnostico', tech3_id, 'Diagnóstico iniciado'),
  (repair5_id, 'diagnostico', 'reparacion', tech3_id, 'Reparación en proceso'),
  (repair5_id, 'reparacion', 'listo', tech3_id, 'Reparación completada'),
  (repair5_id, 'listo', 'entregado', tech3_id, 'Dispositivo entregado al cliente');
  
  RAISE NOTICE 'Historial de estados insertado';
  
END $$;

-- =====================================================
-- PARTE 6: ACTUALIZAR COSTOS DE PARTES
-- =====================================================

UPDATE repairs r
SET parts_cost = (
  SELECT COALESCE(SUM(total_cost), 0)
  FROM repair_parts
  WHERE repair_id = r.id
);

UPDATE repairs
SET final_cost = estimated_cost
WHERE final_cost IS NULL AND status IN ('listo', 'entregado');

-- =====================================================
-- PARTE 7: VERIFICACIÓN FINAL
-- =====================================================

DO $$
DECLARE
  repairs_count INTEGER;
  notes_count INTEGER;
  parts_count INTEGER;
  history_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO repairs_count FROM repairs WHERE is_deleted = false;
  SELECT COUNT(*) INTO notes_count FROM repair_notes;
  SELECT COUNT(*) INTO parts_count FROM repair_parts;
  SELECT COUNT(*) INTO history_count FROM repair_status_history;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATOS DE EJEMPLO INSERTADOS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Reparaciones: %', repairs_count;
  RAISE NOTICE 'Notas: %', notes_count;
  RAISE NOTICE 'Partes: %', parts_count;
  RAISE NOTICE 'Historial de estados: %', history_count;
  RAISE NOTICE '';
  
  IF repairs_count >= 10 THEN
    RAISE NOTICE '✓✓✓ ÉXITO ✓✓✓';
    RAISE NOTICE 'Datos de ejemplo listos para usar';
  ELSE
    RAISE NOTICE '⚠ Advertencia: Menos reparaciones de las esperadas';
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Distribución por estado:';
  RAISE NOTICE '- Recibido: % reparaciones', (SELECT COUNT(*) FROM repairs WHERE status = 'recibido');
  RAISE NOTICE '- Diagnóstico: % reparaciones', (SELECT COUNT(*) FROM repairs WHERE status = 'diagnostico');
  RAISE NOTICE '- Reparación: % reparaciones', (SELECT COUNT(*) FROM repairs WHERE status = 'reparacion');
  RAISE NOTICE '- Listo: % reparaciones', (SELECT COUNT(*) FROM repairs WHERE status = 'listo');
  RAISE NOTICE '- Entregado: % reparaciones', (SELECT COUNT(*) FROM repairs WHERE status = 'entregado');
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- FIN DEL SCRIPT DE DATOS DE EJEMPLO
-- =====================================================
