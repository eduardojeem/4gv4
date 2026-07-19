-- ============================================================================
-- Seed: Datos de ejemplo para hca.celulares@gmail.com
-- Crea clientes, reparaciones en distintos estados y datos relacionados
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_branch_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_customer3_id UUID;
  v_customer4_id UUID;
  v_customer5_id UUID;
  v_repair1_id UUID;
  v_repair2_id UUID;
  v_repair3_id UUID;
  v_repair4_id UUID;
  v_repair5_id UUID;
  v_repair6_id UUID;
  v_repair7_id UUID;
BEGIN
  -- Resolver usuario y organización
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hca.celulares@gmail.com' LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario hca.celulares@gmail.com no encontrado';
  END IF;

  SELECT om.organization_id INTO v_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user_id AND om.status = 'active'
  ORDER BY om.created_at ASC LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró organización activa para este usuario';
  END IF;

  -- Obtener sucursal principal
  SELECT id INTO v_branch_id
  FROM public.branches
  WHERE organization_id = v_org_id AND is_default = true
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    SELECT id INTO v_branch_id
    FROM public.branches
    WHERE organization_id = v_org_id
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró sucursal para esta organización';
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CLIENTES
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.customers (id, organization_id, name, phone, email, status, customer_type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_org_id, 'María González', '+595981234567', 'maria.gonzalez@gmail.com', 'active', 'regular', now() - interval '30 days', now()),
    (gen_random_uuid(), v_org_id, 'Carlos Ramírez', '+595971555888', 'carlos.ramirez@hotmail.com', 'active', 'regular', now() - interval '25 days', now()),
    (gen_random_uuid(), v_org_id, 'Ana Martínez', '+595982333444', 'ana.martinez@gmail.com', 'active', 'regular', now() - interval '20 days', now()),
    (gen_random_uuid(), v_org_id, 'Pedro Benítez', '+595961777999', NULL, 'active', 'regular', now() - interval '15 days', now()),
    (gen_random_uuid(), v_org_id, 'Laura Fernández', '+595991222333', 'laura.fernandez@yahoo.com', 'active', 'vip', now() - interval '10 days', now())
  ON CONFLICT DO NOTHING;

  -- Recuperar IDs de los clientes
  SELECT id INTO v_customer1_id FROM public.customers WHERE organization_id = v_org_id AND name = 'María González' LIMIT 1;
  SELECT id INTO v_customer2_id FROM public.customers WHERE organization_id = v_org_id AND name = 'Carlos Ramírez' LIMIT 1;
  SELECT id INTO v_customer3_id FROM public.customers WHERE organization_id = v_org_id AND name = 'Ana Martínez' LIMIT 1;
  SELECT id INTO v_customer4_id FROM public.customers WHERE organization_id = v_org_id AND name = 'Pedro Benítez' LIMIT 1;
  SELECT id INTO v_customer5_id FROM public.customers WHERE organization_id = v_org_id AND name = 'Laura Fernández' LIMIT 1;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- REPARACIONES (distintos estados)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 1. Recibido (recién ingresado hoy)
  INSERT INTO public.repairs (id, organization_id, branch_id, customer_id, technician_id, ticket_number,
    device_brand, device_model, device_type, problem_description, diagnosis,
    access_type, access_password, status, priority, urgency,
    estimated_cost, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_org_id, v_branch_id, v_customer1_id, NULL, 'HCA-' || lpad((floor(random() * 9999))::text, 4, '0'),
    'Samsung', 'Galaxy A54', 'smartphone', 'Pantalla rota por caída', NULL,
    'pin', '1234', 'recibido', 'medium', 'normal',
    150000, now() - interval '2 hours', now()
  ) RETURNING id INTO v_repair1_id;

  -- 2. Diagnóstico (ingresado ayer, en evaluación)
  INSERT INTO public.repairs (id, organization_id, branch_id, customer_id, technician_id, ticket_number,
    device_brand, device_model, device_type, problem_description, diagnosis,
    access_type, status, priority, urgency,
    estimated_cost, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_org_id, v_branch_id, v_customer2_id, v_user_id, 'HCA-' || lpad((floor(random() * 9999))::text, 4, '0'),
    'iPhone', '13 Pro', 'smartphone', 'No enciende después de mojarse', 'Posible daño en placa por líquido. Se requiere limpieza ultrasónica.',
    'none', 'diagnostico', 'high', 'urgent',
    250000, now() - interval '1 day', now()
  ) RETURNING id INTO v_repair2_id;

  -- 3. Reparación (en proceso)
  INSERT INTO public.repairs (id, organization_id, branch_id, customer_id, technician_id, ticket_number,
    device_brand, device_model, device_type, problem_description, diagnosis,
    access_type, access_password, status, priority, urgency,
    estimated_cost, labor_cost, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_org_id, v_branch_id, v_customer3_id, v_user_id, 'HCA-' || lpad((floor(random() * 9999))::text, 4, '0'),
    'Xiaomi', 'Redmi Note 12', 'smartphone', 'Batería se agota en 2 horas', 'Batería degradada al 45% de capacidad. Reemplazo necesario.',
    'pattern', '1-5-9-6', 'reparacion', 'medium', 'normal',
    80000, 30000, now() - interval '3 days', now()
  ) RETURNING id INTO v_repair3_id;

  -- 4. Pausado (esperando repuesto)
  INSERT INTO public.repairs (id, organization_id, branch_id, customer_id, technician_id, ticket_number,
    device_brand, device_model, device_type, problem_description, diagnosis,
    access_type, status, priority, urgency,
    estimated_cost, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_org_id, v_branch_id, v_customer4_id, v_user_id, 'HCA-' || lpad((floor(random() * 9999))::text, 4, '0'),
    'Motorola', 'Moto G53', 'smartphone', 'Puerto de carga no funciona', 'Puerto USB-C dañado. Se necesita repuesto original del fabricante.',
    'none', 'pausado', 'low', 'normal',
    60000, now() - interval '5 days', now()
  ) RETURNING id INTO v_repair4_id;

  -- 5. Listo (terminado, esperando que el cliente lo busque)
  INSERT INTO public.repairs (id, organization_id, branch_id, customer_id, technician_id, ticket_number,
    device_brand, device_model, device_type, problem_description, diagnosis,
    access_type, access_password, status, priority, urgency,
    estimated_cost, labor_cost, final_cost, completed_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_org_id, v_branch_id, v_customer5_id, v_user_id, 'HCA-' || lpad((floor(random() * 9999))::text, 4, '0'),
    'Samsung', 'Galaxy S23 Ultra', 'smartphone', 'Cámara trasera borrosa', 'Módulo de cámara principal dañado. Reemplazado con original.',
    'password', 'Samsung2024!', 'listo', 'high', 'normal',
    350000, 50000, 400000, now() - interval '1 hour', now() - interval '4 days', now()
  ) RETURNING id INTO v_repair5_id;

  -- 6. Entregado (completado la semana pasada)
  INSERT INTO public.repairs (id, organization_id, branch_id, customer_id, technician_id, ticket_number,
    device_brand, device_model, device_type, problem_description, diagnosis,
    access_type, status, priority, urgency,
    estimated_cost, labor_cost, final_cost, completed_at, delivered_at, picked_up_at,
    created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_org_id, v_branch_id, v_customer1_id, v_user_id, 'HCA-' || lpad((floor(random() * 9999))::text, 4, '0'),
    'iPhone', '12', 'smartphone', 'Pantalla con líneas verdes', 'Panel OLED defectuoso. Se reemplazó con display original.',
    'none', 'entregado', 'medium', 'normal',
    200000, 40000, 240000, now() - interval '8 days', now() - interval '7 days', now() - interval '7 days',
    now() - interval '10 days', now() - interval '7 days'
  ) RETURNING id INTO v_repair6_id;

  -- 7. Laptop en reparación
  INSERT INTO public.repairs (id, organization_id, branch_id, customer_id, technician_id, ticket_number,
    device_brand, device_model, device_type, problem_description, diagnosis,
    access_type, access_password, status, priority, urgency,
    estimated_cost, labor_cost, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_org_id, v_branch_id, v_customer2_id, v_user_id, 'HCA-' || lpad((floor(random() * 9999))::text, 4, '0'),
    'HP', 'Pavilion 15', 'laptop', 'No enciende, solo parpadea LED', 'Fuente de poder interna dañada. Reemplazo de adaptador interno.',
    'password', 'Carlos123', 'reparacion', 'high', 'urgent',
    180000, 50000, now() - interval '2 days', now()
  ) RETURNING id INTO v_repair7_id;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- REPUESTOS (para reparaciones en proceso)
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.repair_parts (repair_id, part_name, unit_cost, quantity, supplier)
  VALUES
    (v_repair3_id, 'Batería Xiaomi Redmi Note 12 BN5G', 45000, 1, 'RepuestosCell PY'),
    (v_repair5_id, 'Módulo cámara Samsung S23 Ultra', 280000, 1, 'Samsung Parts'),
    (v_repair5_id, 'Adhesivo B-7000', 5000, 1, NULL),
    (v_repair6_id, 'Display OLED iPhone 12 Original', 160000, 1, 'iFixit Paraguay'),
    (v_repair7_id, 'Fuente interna HP Pavilion 15 19.5V', 95000, 1, 'HP Parts Store');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- NOTAS
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.repair_notes (repair_id, author_id, author_name, note_text, is_internal, created_at)
  VALUES
    (v_repair2_id, v_user_id, 'Técnico', 'Se detectó corrosión en conectores. Requiere limpieza antes de probar encendido.', true, now() - interval '20 hours'),
    (v_repair3_id, v_user_id, 'Técnico', 'Batería pedida al proveedor. Llega mañana.', true, now() - interval '2 days'),
    (v_repair3_id, v_user_id, 'Técnico', 'Batería reemplazada. En prueba de carga.', true, now() - interval '4 hours'),
    (v_repair4_id, v_user_id, 'Técnico', 'Puerto USB-C original agotado en proveedor local. Se pidió a CDE.', true, now() - interval '3 days'),
    (v_repair5_id, v_user_id, 'Técnico', 'Cámara reemplazada y probada. Equipo listo para entrega.', false, now() - interval '2 hours'),
    (v_repair7_id, v_user_id, 'Técnico', 'Cliente informado del presupuesto. Autorizó la reparación.', false, now() - interval '1 day');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- HISTORIAL DE ESTADOS — se omite porque la tabla tiene columnas distintas.
  -- El historial se generará automáticamente al cambiar estados desde el dashboard.
  -- ═══════════════════════════════════════════════════════════════════════════

  RAISE NOTICE 'Seed completado: 5 clientes, 7 reparaciones, repuestos y notas creados para hca.celulares@gmail.com';
END;
$$;
