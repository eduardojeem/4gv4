-- Hardening de creación y cancelación de pedidos desde panel / app móvil:
-- 1. Idempotencia persistente por organización en `customer_orders`.
-- 2. Soporte atómico de variantes por sucursal (`adjust_variant_stock_atomic` / `branch_variant_inventory`).
-- 3. Productos tipo servicio / sin stock rastreado no descuentan ni fallan por inventario al crear o cancelar.
-- 4. Consistencia en `cancel_customer_order_atomic` (incluyendo estado normalizado 'CANCELADO' y restauración por sucursal).

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS creation_idempotency_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_orders_creation_idempotency_key_len_check'
      AND conrelid = 'public.customer_orders'::regclass
  ) THEN
    ALTER TABLE public.customer_orders
      ADD CONSTRAINT customer_orders_creation_idempotency_key_len_check
      CHECK (
        creation_idempotency_key IS NULL
        OR (char_length(trim(creation_idempotency_key)) BETWEEN 8 AND 128)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS customer_orders_org_creation_idempotency_idx
  ON public.customer_orders (organization_id, creation_idempotency_key)
  WHERE creation_idempotency_key IS NOT NULL;

DROP FUNCTION IF EXISTS public.create_dashboard_order_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.create_dashboard_order_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_customer_id uuid,
  p_customer jsonb,
  p_order jsonb,
  p_items jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resolved_customer_id uuid := p_customer_id;
  created_order_id uuid := gen_random_uuid();
  existing_order_id uuid;
  existing_customer_id uuid;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_actor_is_member boolean := false;
  v_any_stock_reserved boolean := false;
  v_is_service boolean;
  v_variant_stock integer;
  product_row record;
  variant_row record;
  item record;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = p_branch_id
      AND b.organization_id = p_organization_id
      AND b.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid branch for order';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    IF char_length(v_idempotency_key) < 8 OR char_length(v_idempotency_key) > 128 THEN
      RAISE EXCEPTION 'Invalid idempotency key';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_organization_id::text || ':order-idem:' || v_idempotency_key, 0)
    );

    SELECT o.id, o.customer_id
    INTO existing_order_id, existing_customer_id
    FROM public.customer_orders o
    WHERE o.organization_id = p_organization_id
      AND o.creation_idempotency_key = v_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'order_id', existing_order_id,
        'customer_id', existing_customer_id,
        'replayed', true
      );
    END IF;
  END IF;

  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Order items required';
  END IF;

  IF resolved_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = resolved_customer_id
      AND c.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Customer does not belong to organization';
  END IF;

  IF p_actor_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.organization_id = p_organization_id
        AND m.user_id = p_actor_id
        AND m.status = 'active'
    ) INTO v_actor_is_member;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || p_branch_id::text || ':order-stock', 0)
  );

  FOR item IN
    SELECT
      (value->>'product_id')::uuid AS product_id,
      nullif(trim(coalesce(value->>'variant_id', '')), '')::uuid AS variant_id,
      sum((value->>'quantity')::integer)::integer AS quantity
    FROM jsonb_array_elements(p_items)
    GROUP BY
      (value->>'product_id')::uuid,
      nullif(trim(coalesce(value->>'variant_id', '')), '')::uuid
    ORDER BY
      (value->>'product_id')::uuid,
      nullif(trim(coalesce(value->>'variant_id', '')), '')::uuid NULLS FIRST
  LOOP
    IF item.quantity IS NULL OR item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid item quantity';
    END IF;

    SELECT
      p.id,
      p.name,
      p.sku,
      p.unit_measure,
      p.stock_quantity,
      p.has_variants,
      p.is_active,
      c.name AS category_name
    INTO product_row
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = item.product_id
      AND p.organization_id = p_organization_id
    FOR UPDATE OF p;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found %', item.product_id;
    END IF;

    v_is_service := (
      lower(coalesce(product_row.unit_measure, '')) = 'servicio'
      OR coalesce(product_row.sku, '') ~* '^(SRV|SERV|SER)[-_]'
      OR lower(coalesce(product_row.category_name, '')) LIKE '%servicio%'
      OR lower(coalesce(product_row.category_name, '')) LIKE '%mano de obra%'
      OR product_row.stock_quantity IS NULL
    );

    IF item.variant_id IS NOT NULL THEN
      SELECT v.id, v.variant_name
      INTO variant_row
      FROM public.product_variants v
      WHERE v.id = item.variant_id
        AND v.product_id = item.product_id
        AND v.organization_id = p_organization_id
        AND v.is_active = true
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'VARIANT_NOT_AVAILABLE';
      END IF;

      IF NOT (
        lower(coalesce(product_row.unit_measure, '')) = 'servicio'
        OR coalesce(product_row.sku, '') ~* '^(SRV|SERV|SER)[-_]'
        OR lower(coalesce(product_row.category_name, '')) LIKE '%servicio%'
        OR lower(coalesce(product_row.category_name, '')) LIKE '%mano de obra%'
      ) THEN
        v_any_stock_reserved := true;
        IF v_actor_is_member THEN
          BEGIN
            PERFORM public.adjust_variant_stock_atomic(
              p_organization_id,
              p_branch_id,
              item.variant_id,
              -item.quantity,
              'sale',
              'order:' || coalesce(v_idempotency_key, nullif(trim(coalesce(p_order->>'order_number', '')), ''), created_order_id::text) || ':' || item.variant_id::text,
              p_actor_id,
              'order',
              NULL,
              'Pedido desde panel',
              jsonb_build_object(
                'order_id', created_order_id,
                'order_number', p_order->>'order_number'
              )
            );
          EXCEPTION
            WHEN OTHERS THEN
              IF SQLERRM LIKE 'VARIANT_STOCK_INSUFFICIENT%' THEN
                RAISE EXCEPTION 'Insufficient stock for variant %', item.variant_id;
              ELSIF SQLERRM LIKE 'VARIANT_BRANCH_FORBIDDEN%' THEN
                RAISE EXCEPTION 'Branch variant inventory not configured for %', item.variant_id;
              ELSE
                RAISE;
              END IF;
          END;
        ELSE
          SELECT bvi.stock_quantity
          INTO v_variant_stock
          FROM public.branch_variant_inventory bvi
          WHERE bvi.organization_id = p_organization_id
            AND bvi.branch_id = p_branch_id
            AND bvi.variant_id = item.variant_id
          FOR UPDATE;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'Branch variant inventory not configured for %', item.variant_id;
          END IF;

          IF v_variant_stock < item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for variant %', item.variant_id;
          END IF;

          UPDATE public.branch_variant_inventory
          SET stock_quantity = stock_quantity - item.quantity,
              updated_at = now()
          WHERE organization_id = p_organization_id
            AND branch_id = p_branch_id
            AND variant_id = item.variant_id;
        END IF;
      END IF;
    ELSE
      IF coalesce(product_row.has_variants, false) = true AND EXISTS (
        SELECT 1
        FROM public.product_variants v
        WHERE v.product_id = item.product_id
          AND v.organization_id = p_organization_id
          AND v.is_active = true
      ) THEN
        RAISE EXCEPTION 'VARIANT_NOT_AVAILABLE';
      END IF;

      IF NOT v_is_service THEN
        v_any_stock_reserved := true;
        UPDATE public.branch_inventory bi
        SET stock_quantity = bi.stock_quantity - item.quantity,
            updated_at = now()
        WHERE bi.branch_id = p_branch_id
          AND bi.product_id = item.product_id
          AND bi.stock_quantity >= item.quantity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Insufficient stock for product %', item.product_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF resolved_customer_id IS NULL THEN
    IF nullif(trim(coalesce(p_customer->>'name', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Customer name is required';
    END IF;

    INSERT INTO public.customers (
      organization_id,
      name,
      email,
      phone,
      address,
      status,
      customer_type,
      created_at,
      updated_at
    )
    VALUES (
      p_organization_id,
      trim(p_customer->>'name'),
      nullif(p_customer->>'email', ''),
      coalesce(p_customer->>'phone', ''),
      nullif(p_customer->>'address', ''),
      'active',
      'regular',
      now(),
      now()
    )
    RETURNING id INTO resolved_customer_id;
  END IF;

  INSERT INTO public.customer_orders (
    id,
    organization_id,
    branch_id,
    customer_id,
    order_number,
    status,
    payment_status,
    payment_method,
    fulfillment_type,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    subtotal,
    tax_amount,
    shipping_cost,
    discount_amount,
    total,
    notes,
    stock_reserved,
    creation_idempotency_key,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    created_order_id,
    p_organization_id,
    p_branch_id,
    resolved_customer_id,
    p_order->>'order_number',
    'PENDING',
    'PENDING',
    p_order->>'payment_method',
    p_order->>'fulfillment_type',
    p_customer->>'name',
    nullif(p_customer->>'email', ''),
    nullif(p_customer->>'phone', ''),
    nullif(p_customer->>'address', ''),
    (p_order->>'subtotal')::numeric,
    0,
    (p_order->>'shipping_cost')::numeric,
    (p_order->>'discount_amount')::numeric,
    (p_order->>'total')::numeric,
    nullif(p_order->>'notes', ''),
    v_any_stock_reserved,
    v_idempotency_key,
    p_actor_id,
    now(),
    now()
  );

  INSERT INTO public.customer_order_items (
    organization_id,
    order_id,
    product_id,
    variant_id,
    variant_name,
    product_name,
    product_sku,
    quantity,
    unit_price,
    subtotal
  )
  SELECT
    p_organization_id,
    created_order_id,
    (value->>'product_id')::uuid,
    nullif(trim(coalesce(value->>'variant_id', '')), '')::uuid,
    nullif(trim(coalesce(value->>'variant_name', '')), ''),
    value->>'product_name',
    nullif(value->>'product_sku', ''),
    (value->>'quantity')::integer,
    (value->>'unit_price')::numeric,
    (value->>'subtotal')::numeric
  FROM jsonb_array_elements(p_items);

  INSERT INTO public.customer_order_status_history (
    organization_id,
    order_id,
    to_status,
    note,
    changed_by
  )
  VALUES (
    p_organization_id,
    created_order_id,
    'PENDING',
    'Pedido creado desde el dashboard.',
    p_actor_id
  );

  RETURN jsonb_build_object(
    'order_id', created_order_id,
    'customer_id', resolved_customer_id,
    'replayed', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_customer_order_atomic(
  p_organization_id uuid,
  p_order_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  order_row public.customer_orders%rowtype;
  released_amount numeric := 0;
  v_actor_is_member boolean := false;
  v_has_branch_variant boolean := false;
  variant_line record;
BEGIN
  SELECT * INTO order_row
  FROM public.customer_orders customer_order
  WHERE customer_order.id = p_order_id
    AND customer_order.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF order_row.status IN ('CANCELLED', 'CANCELADO') THEN
    RETURN jsonb_build_object(
      'order_id', order_row.id,
      'from_status', order_row.status,
      'stock_released', false,
      'store_credit_released', 0
    );
  END IF;

  UPDATE public.customer_store_credit_reservations
  SET status = 'released',
      released_at = now(),
      updated_at = now()
  WHERE organization_id = p_organization_id
    AND order_id = p_order_id
    AND status = 'reserved'
  RETURNING amount INTO released_amount;

  IF p_actor_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.organization_id = p_organization_id
        AND m.user_id = p_actor_id
        AND m.status = 'active'
    ) INTO v_actor_is_member;
  END IF;

  IF order_row.stock_reserved THEN
    FOR variant_line IN
      SELECT
        order_item.variant_id,
        sum(order_item.quantity)::integer AS quantity
      FROM public.customer_order_items order_item
      LEFT JOIN public.products product
        ON product.id = order_item.product_id
       AND product.organization_id = p_organization_id
      LEFT JOIN public.categories category
        ON category.id = product.category_id
      WHERE order_item.order_id = order_row.id
        AND order_item.variant_id IS NOT NULL
        AND lower(coalesce(product.unit_measure, '')) <> 'servicio'
        AND coalesce(product.sku, '') !~* '^(SRV|SERV|SER)[-_]'
        AND lower(coalesce(category.name, '')) NOT LIKE '%servicio%'
        AND lower(coalesce(category.name, '')) NOT LIKE '%mano de obra%'
      GROUP BY order_item.variant_id
      ORDER BY order_item.variant_id
    LOOP
      v_has_branch_variant := false;

      IF order_row.branch_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.branch_variant_inventory bvi
          WHERE bvi.organization_id = p_organization_id
            AND bvi.branch_id = order_row.branch_id
            AND bvi.variant_id = variant_line.variant_id
        ) INTO v_has_branch_variant;
      END IF;

      IF v_has_branch_variant THEN
        IF v_actor_is_member THEN
          PERFORM public.adjust_variant_stock_atomic(
            p_organization_id,
            order_row.branch_id,
            variant_line.variant_id,
            variant_line.quantity,
            'return',
            'order-cancel:' || order_row.id::text || ':' || variant_line.variant_id::text,
            p_actor_id,
            'order',
            order_row.id,
            coalesce(p_note, 'Cancelación de pedido')
          );
        ELSE
          UPDATE public.branch_variant_inventory bvi
          SET stock_quantity = bvi.stock_quantity + variant_line.quantity,
              updated_at = now()
          WHERE bvi.organization_id = p_organization_id
            AND bvi.branch_id = order_row.branch_id
            AND bvi.variant_id = variant_line.variant_id;
        END IF;
      ELSE
        UPDATE public.product_variants variant
        SET stock_quantity = variant.stock_quantity + variant_line.quantity,
            updated_at = now()
        WHERE variant.id = variant_line.variant_id
          AND variant.organization_id = p_organization_id;
      END IF;
    END LOOP;

    IF order_row.branch_id IS NULL THEN
      UPDATE public.products product
      SET stock_quantity = product.stock_quantity + quantities.quantity,
          updated_at = now()
      FROM (
        SELECT
          order_item.product_id,
          sum(order_item.quantity)::integer AS quantity
        FROM public.customer_order_items order_item
        JOIN public.products p
          ON p.id = order_item.product_id
         AND p.organization_id = p_organization_id
        LEFT JOIN public.categories c
          ON c.id = p.category_id
        WHERE order_item.order_id = order_row.id
          AND order_item.product_id IS NOT NULL
          AND order_item.variant_id IS NULL
          AND p.stock_quantity IS NOT NULL
          AND lower(coalesce(p.unit_measure, '')) <> 'servicio'
          AND coalesce(p.sku, '') !~* '^(SRV|SERV|SER)[-_]'
          AND lower(coalesce(c.name, '')) NOT LIKE '%servicio%'
          AND lower(coalesce(c.name, '')) NOT LIKE '%mano de obra%'
        GROUP BY order_item.product_id
      ) quantities
      WHERE product.id = quantities.product_id
        AND product.organization_id = p_organization_id;
    ELSE
      UPDATE public.branch_inventory inventory
      SET stock_quantity = inventory.stock_quantity + quantities.quantity,
          updated_at = now()
      FROM (
        SELECT
          order_item.product_id,
          sum(order_item.quantity)::integer AS quantity
        FROM public.customer_order_items order_item
        JOIN public.products p
          ON p.id = order_item.product_id
         AND p.organization_id = p_organization_id
        LEFT JOIN public.categories c
          ON c.id = p.category_id
        WHERE order_item.order_id = order_row.id
          AND order_item.product_id IS NOT NULL
          AND order_item.variant_id IS NULL
          AND p.stock_quantity IS NOT NULL
          AND lower(coalesce(p.unit_measure, '')) <> 'servicio'
          AND coalesce(p.sku, '') !~* '^(SRV|SERV|SER)[-_]'
          AND lower(coalesce(c.name, '')) NOT LIKE '%servicio%'
          AND lower(coalesce(c.name, '')) NOT LIKE '%mano de obra%'
        GROUP BY order_item.product_id
      ) quantities
      WHERE inventory.branch_id = order_row.branch_id
        AND inventory.product_id = quantities.product_id;
    END IF;
  END IF;

  UPDATE public.customer_orders
  SET status = 'CANCELLED',
      stock_reserved = false,
      store_credit_reserved = 0,
      cancelled_at = now(),
      updated_at = now()
  WHERE id = order_row.id
    AND organization_id = p_organization_id;

  INSERT INTO public.customer_order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    note,
    changed_by
  )
  VALUES (
    p_organization_id,
    order_row.id,
    order_row.status,
    'CANCELLED',
    p_note,
    p_actor_id
  );

  RETURN jsonb_build_object(
    'order_id', order_row.id,
    'from_status', order_row.status,
    'stock_released', order_row.stock_reserved,
    'store_credit_released', coalesce(released_amount, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_dashboard_order_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.create_dashboard_order_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_customer_order_atomic(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.cancel_customer_order_atomic(uuid, uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
