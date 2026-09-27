-- =====================================================
-- SCRIPT DE REINICIO DE DATOS: NEGOCIO INFORMÁTICA / CELULARES
-- Fecha: 2025-01-05
-- Descripción: Agrega datos de ejemplo sin borrar datos existentes (Idempotente)
-- Moneda: Guaraníes (PYG)
-- =====================================================

DO $$
DECLARE
    -- Variables para IDs de Categorías
    cat_smartphones UUID;
    cat_repuestos UUID;
    cat_accesorios UUID;
    cat_computacion UUID;
    cat_audio UUID;

    -- Variables para IDs de Proveedores
    sup_tech_parts UUID;
    sup_global_cel UUID;
    sup_compu_mayor UUID;

    -- Variables para IDs de Clientes
    cust_juan UUID;
    cust_maria UUID;
    cust_local UUID;

    -- Variables para IDs de Productos (para ventas)
    prod_iphone UUID;
    prod_funda UUID;
    prod_cargador UUID;
    
    -- Variables para Caja y Ventas
    cash_register_id UUID;
    sale_id_1 UUID;
    sale_id_2 UUID;
    current_user_id UUID; -- Intentaremos obtener el usuario actual o usar NULL si no hay sesión

BEGIN
    -- Intentar obtener el ID del usuario actual (si se ejecuta desde SQL Editor con sesión)
    current_user_id := auth.uid();
    
    RAISE NOTICE 'Iniciando carga de datos (Modo Aditivo)...';

    -- 2. GESTIÓN DE PROVEEDORES (Buscar o Crear)
    RAISE NOTICE 'Verificando proveedores...';
    
    -- TechParts Import
    SELECT id INTO sup_tech_parts FROM suppliers WHERE name = 'TechParts Import' LIMIT 1;
    IF sup_tech_parts IS NULL THEN
        INSERT INTO suppliers (name, contact_name, email, phone, address)
        VALUES ('TechParts Import', 'Carlos Ruiz', 'ventas@techparts.com', '+595 981 111 222', 'Av. España 123')
        RETURNING id INTO sup_tech_parts;
        RAISE NOTICE 'Proveedor creado: TechParts Import';
    END IF;

    -- Global Celulares
    SELECT id INTO sup_global_cel FROM suppliers WHERE name = 'Global Celulares' LIMIT 1;
    IF sup_global_cel IS NULL THEN
        INSERT INTO suppliers (name, contact_name, email, phone, address)
        VALUES ('Global Celulares', 'Ana Mendoza', 'contacto@globalcel.com', '+595 971 333 444', 'Ruta Transchaco Km 10')
        RETURNING id INTO sup_global_cel;
        RAISE NOTICE 'Proveedor creado: Global Celulares';
    END IF;

    -- Compumundo Mayorista
    SELECT id INTO sup_compu_mayor FROM suppliers WHERE name = 'Compumundo Mayorista' LIMIT 1;
    IF sup_compu_mayor IS NULL THEN
        INSERT INTO suppliers (name, contact_name, email, phone, address)
        VALUES ('Compumundo Mayorista', 'Roberto Díaz', 'info@compumundo.com', '+595 991 555 666', 'Galería Central Local 45')
        RETURNING id INTO sup_compu_mayor;
        RAISE NOTICE 'Proveedor creado: Compumundo Mayorista';
    END IF;

    -- Actualizar campos adicionales si existen (solo si se acaban de crear o para asegurar consistencia)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'status') THEN
        UPDATE suppliers SET status = 'active' WHERE id IN (sup_tech_parts, sup_global_cel, sup_compu_mayor);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'business_type') THEN
        UPDATE suppliers SET business_type = 'distributor' WHERE id = sup_global_cel;
        UPDATE suppliers SET business_type = 'wholesaler' WHERE id = sup_tech_parts;
        UPDATE suppliers SET business_type = 'distributor' WHERE id = sup_compu_mayor;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'city') THEN
        UPDATE suppliers SET city = 'Asunción', country = 'Paraguay' WHERE id IN (sup_tech_parts, sup_global_cel, sup_compu_mayor);
    END IF;


    -- 3. GESTIÓN DE CATEGORÍAS
    RAISE NOTICE 'Verificando categorías...';

    SELECT id INTO cat_smartphones FROM categories WHERE name = 'Smartphones' LIMIT 1;
    IF cat_smartphones IS NULL THEN
        INSERT INTO categories (name, description, is_active)
        VALUES ('Smartphones', 'Teléfonos móviles nuevos y reacondicionados', true)
        RETURNING id INTO cat_smartphones;
        RAISE NOTICE 'Categoría creada: Smartphones';
    END IF;

    SELECT id INTO cat_repuestos FROM categories WHERE name = 'Repuestos Celulares' LIMIT 1;
    IF cat_repuestos IS NULL THEN
        INSERT INTO categories (name, description, is_active)
        VALUES ('Repuestos Celulares', 'Pantallas, baterías, flex y componentes internos', true)
        RETURNING id INTO cat_repuestos;
        RAISE NOTICE 'Categoría creada: Repuestos Celulares';
    END IF;

    SELECT id INTO cat_accesorios FROM categories WHERE name = 'Accesorios' LIMIT 1;
    IF cat_accesorios IS NULL THEN
        INSERT INTO categories (name, description, is_active)
        VALUES ('Accesorios', 'Fundas, protectores, cargadores y cables', true)
        RETURNING id INTO cat_accesorios;
        RAISE NOTICE 'Categoría creada: Accesorios';
    END IF;

    SELECT id INTO cat_computacion FROM categories WHERE name = 'Computación' LIMIT 1;
    IF cat_computacion IS NULL THEN
        INSERT INTO categories (name, description, is_active)
        VALUES ('Computación', 'Laptops, componentes de PC y periféricos', true)
        RETURNING id INTO cat_computacion;
        RAISE NOTICE 'Categoría creada: Computación';
    END IF;

    SELECT id INTO cat_audio FROM categories WHERE name = 'Audio' LIMIT 1;
    IF cat_audio IS NULL THEN
        INSERT INTO categories (name, description, is_active)
        VALUES ('Audio', 'Auriculares, parlantes y micrófonos', true)
        RETURNING id INTO cat_audio;
        RAISE NOTICE 'Categoría creada: Audio';
    END IF;

    -- 4. GESTIÓN DE PRODUCTOS
    RAISE NOTICE 'Verificando productos...';

    -- --- SMARTPHONES ---
    SELECT id INTO prod_iphone FROM products WHERE sku = 'CEL-IP13-128' LIMIT 1;
    IF prod_iphone IS NULL THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'CEL-IP13-128', 'iPhone 13 128GB Midnight', 'Apple iPhone 13 con 128GB de almacenamiento, color Midnight. Pantalla Super Retina XDR.',
            cat_smartphones, sup_global_cel,
            4500000, 5600000, 5200000,
            5, 2, 'unidad', true,
            'Apple', ARRAY['https://example.com/iphone13.jpg']
        ) RETURNING id INTO prod_iphone;
        RAISE NOTICE 'Producto creado: iPhone 13 128GB';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CEL-S23-256') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'CEL-S23-256', 'Samsung Galaxy S23 256GB', 'Samsung Galaxy S23 Phantom Black. Procesador Snapdragon 8 Gen 2.',
            cat_smartphones, sup_global_cel,
            4900000, 6000000, 5500000,
            3, 1, 'unidad', true,
            'Samsung', ARRAY['https://example.com/s23.jpg']
        );
        RAISE NOTICE 'Producto creado: Samsung Galaxy S23';
    END IF;

    -- --- REPUESTOS ---
    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'REP-DIS-IPX') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'REP-DIS-IPX', 'Display iPhone X OLED', 'Pantalla calidad OLED para iPhone X. Incluye marco y adhesivo.',
            cat_repuestos, sup_tech_parts,
            180000, 350000, 280000,
            20, 5, 'unidad', true,
            'Genérico', ARRAY['https://example.com/display-ipx.jpg']
        );
        RAISE NOTICE 'Producto creado: Display iPhone X';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'REP-DIS-IP11') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'REP-DIS-IP11', 'Display iPhone 11 Incell', 'Pantalla tecnología Incell para iPhone 11.',
            cat_repuestos, sup_tech_parts,
            130000, 250000, 200000,
            15, 5, 'unidad', true,
            'Genérico', ARRAY['https://example.com/display-ip11.jpg']
        );
        RAISE NOTICE 'Producto creado: Display iPhone 11';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'REP-BAT-S21') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'REP-BAT-S21', 'Batería Samsung S21 Original', 'Batería de reemplazo original para Samsung Galaxy S21.',
            cat_repuestos, sup_tech_parts,
            110000, 220000, 160000,
            10, 3, 'unidad', true,
            'Samsung', ARRAY['https://example.com/bat-s21.jpg']
        );
        RAISE NOTICE 'Producto creado: Batería Samsung S21';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'REP-PIN-C') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'REP-PIN-C', 'Pin de Carga USB-C Universal', 'Conector de carga USB-C para soldar. Pack x10.',
            cat_repuestos, sup_tech_parts,
            15000, 40000, 25000,
            100, 20, 'pack', true,
            'Genérico', NULL
        );
        RAISE NOTICE 'Producto creado: Pin Carga USB-C';
    END IF;

    -- --- ACCESORIOS ---
    SELECT id INTO prod_cargador FROM products WHERE sku = 'ACC-CAR-20W' LIMIT 1;
    IF prod_cargador IS NULL THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'ACC-CAR-20W', 'Cargador 20W USB-C', 'Cargador de pared carga rápida 20W. Compatible con iPhone y Android.',
            cat_accesorios, sup_global_cel,
            35000, 90000, 60000,
            50, 10, 'unidad', true,
            'Genérico', ARRAY['https://example.com/charger-20w.jpg']
        ) RETURNING id INTO prod_cargador;
        RAISE NOTICE 'Producto creado: Cargador 20W';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'ACC-CAB-LIGHT') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'ACC-CAB-LIGHT', 'Cable Lightning 1m', 'Cable de datos y carga para iPhone. 1 metro, reforzado.',
            cat_accesorios, sup_global_cel,
            10000, 40000, 25000,
            100, 20, 'unidad', true,
            'Genérico', ARRAY['https://example.com/cable-light.jpg']
        );
        RAISE NOTICE 'Producto creado: Cable Lightning';
    END IF;

    SELECT id INTO prod_funda FROM products WHERE sku = 'ACC-FUN-SIL' LIMIT 1;
    IF prod_funda IS NULL THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'ACC-FUN-SIL', 'Funda Silicona iPhone 13', 'Funda de silicona con felpa interior para iPhone 13. Varios colores.',
            cat_accesorios, sup_global_cel,
            15000, 60000, 30000,
            40, 10, 'unidad', true,
            'Genérico', NULL
        ) RETURNING id INTO prod_funda;
        RAISE NOTICE 'Producto creado: Funda Silicona';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'ACC-VID-TEMP') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'ACC-VID-TEMP', 'Vidrio Templado 9D Universal', 'Protector de pantalla vidrio templado 9D. Modelos varios.',
            cat_accesorios, sup_global_cel,
            3500, 25000, 10000,
            200, 50, 'unidad', true,
            'Genérico', NULL
        );
        RAISE NOTICE 'Producto creado: Vidrio Templado';
    END IF;

    -- --- COMPUTACIÓN ---
    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'COM-SSD-480') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'COM-SSD-480', 'SSD Kingston 480GB', 'Disco estado sólido Kingston A400 480GB SATA III.',
            cat_computacion, sup_compu_mayor,
            210000, 340000, 280000,
            12, 3, 'unidad', true,
            'Kingston', ARRAY['https://example.com/ssd-480.jpg']
        );
        RAISE NOTICE 'Producto creado: SSD Kingston 480GB';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'COM-RAM-8GB') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'COM-RAM-8GB', 'Memoria RAM 8GB DDR4 Notebook', 'Memoria RAM SODIMM 8GB 3200MHz para laptop.',
            cat_computacion, sup_compu_mayor,
            135000, 230000, 180000,
            15, 4, 'unidad', true,
            'Crucial', ARRAY['https://example.com/ram-8gb.jpg']
        );
        RAISE NOTICE 'Producto creado: RAM 8GB';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'COM-PEN-64') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'COM-PEN-64', 'Pendrive SanDisk 64GB', 'Memoria USB 3.0 64GB SanDisk.',
            cat_computacion, sup_compu_mayor,
            30000, 70000, 45000,
            30, 5, 'unidad', true,
            'SanDisk', NULL
        );
        RAISE NOTICE 'Producto creado: Pendrive 64GB';
    END IF;

    -- --- AUDIO ---
    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'AUD-AIR-PRO') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'AUD-AIR-PRO', 'Auriculares TWS Tipo Pro', 'Auriculares inalámbricos réplica calidad AAA con cancelación de ruido.',
            cat_audio, sup_global_cel,
            90000, 190000, 140000,
            25, 5, 'unidad', true,
            'Genérico', ARRAY['https://example.com/tws-pro.jpg']
        );
        RAISE NOTICE 'Producto creado: Auriculares TWS';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'AUD-JBL-GO3') THEN
        INSERT INTO products (
            sku, name, description, category_id, supplier_id, 
            purchase_price, sale_price, wholesale_price, 
            stock_quantity, min_stock, unit_measure, is_active, 
            brand, images
        ) VALUES (
            'AUD-JBL-GO3', 'Parlante JBL GO 3', 'Parlante portátil Bluetooth resistente al agua.',
            cat_audio, sup_compu_mayor,
            225000, 340000, 280000,
            8, 2, 'unidad', true,
            'JBL', ARRAY['https://example.com/jbl-go3.jpg']
        );
        RAISE NOTICE 'Producto creado: JBL GO 3';
    END IF;

    -- 5. GESTIÓN DE CLIENTES
    RAISE NOTICE 'Verificando clientes...';

    -- Nota: Usamos customer_code o ruc en lugar de document si no existe
    -- El error indicaba que la columna "document" no existe en la tabla customers.
    -- Revisando esquemas, parece que se usa 'ruc' o 'customer_code' como identificador.
    
    SELECT id INTO cust_juan FROM customers WHERE email = 'juan.perez@email.com' LIMIT 1;
    IF cust_juan IS NULL THEN
        INSERT INTO customers (name, ruc, phone, email, address, city, customer_type)
        VALUES ('Juan Pérez', '4567890', '0981 555 123', 'juan.perez@email.com', 'Av. Mariscal López 1234', 'Asunción', 'regular')
        RETURNING id INTO cust_juan;
        RAISE NOTICE 'Cliente creado: Juan Pérez';
    END IF;

    SELECT id INTO cust_maria FROM customers WHERE email = 'maria.gonzalez@email.com' LIMIT 1;
    IF cust_maria IS NULL THEN
        INSERT INTO customers (name, ruc, phone, email, address, city, customer_type)
        VALUES ('María González', '3456789', '0971 444 789', 'maria.gonzalez@email.com', 'Calle Palma 456', 'Asunción', 'premium')
        RETURNING id INTO cust_maria;
        RAISE NOTICE 'Cliente creado: María González';
    END IF;

    SELECT id INTO cust_local FROM customers WHERE email = 'contacto@local.com' LIMIT 1;
    IF cust_local IS NULL THEN
        INSERT INTO customers (name, ruc, phone, email, address, city, customer_type)
        VALUES ('Local Comercial', '8000123-4', '0991 111 222', 'contacto@local.com', 'Shopping del Sol', 'Asunción', 'empresa')
        RETURNING id INTO cust_local;
        RAISE NOTICE 'Cliente creado: Local Comercial';
    END IF;

    -- 6. GESTIÓN DE REPARACIONES (Celulares y JBL)
    RAISE NOTICE 'Verificando reparaciones...';

    -- Solo insertamos si no existe una reparación para este serial/modelo en proceso
    IF NOT EXISTS (SELECT 1 FROM repairs WHERE serial_number = 'F2LXYZ123' AND customer_id = cust_juan) THEN
        INSERT INTO repairs (
            customer_id, device_brand, device_model, serial_number, 
            problem_description, diagnosis, estimated_cost, status, 
            created_at, estimated_completion
        ) VALUES (
            cust_juan, 'Apple', 'iPhone 11', 'F2LXYZ123',
            'Pantalla rota, no da imagen', 'Se requiere cambio de módulo de pantalla completo', 350000, 'reparacion',
            NOW() - INTERVAL '2 days', NOW() + INTERVAL '1 day'
        );
        RAISE NOTICE 'Reparación creada: iPhone 11 (Juan)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM repairs WHERE serial_number = 'R58N12345' AND customer_id = cust_maria) THEN
        INSERT INTO repairs (
            customer_id, device_brand, device_model, serial_number, 
            problem_description, status, 
            created_at
        ) VALUES (
            cust_maria, 'Samsung', 'Galaxy S20 FE', 'R58N12345',
            'La batería dura muy poco y se calienta', 'diagnostico',
            NOW() - INTERVAL '1 day'
        );
        RAISE NOTICE 'Reparación creada: S20 FE (María)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM repairs WHERE serial_number = 'TL12345678' AND customer_id = cust_local) THEN
        INSERT INTO repairs (
            customer_id, device_brand, device_model, serial_number, 
            problem_description, diagnosis, estimated_cost, final_cost, status, 
            created_at, completed_at
        ) VALUES (
            cust_local, 'JBL', 'Charge 5', 'TL12345678',
            'No enciende, posible problema de carga', 'Falla en el IC de carga, se realizó reemplazo', 180000, 180000, 'listo',
            NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day'
        );
        RAISE NOTICE 'Reparación creada: JBL Charge 5 (Local)';
    END IF;

    -- Para el JBL Tune 510BT que no tiene serial en el insert original, chequeamos por descripción y modelo
    IF NOT EXISTS (SELECT 1 FROM repairs WHERE device_model = 'Tune 510BT' AND customer_id = cust_juan) THEN
        INSERT INTO repairs (
            customer_id, device_brand, device_model, problem_description, status, created_at
        ) VALUES (
            cust_juan, 'JBL', 'Tune 510BT', 'Uno de los lados dejó de sonar', 'recibido', NOW()
        );
        RAISE NOTICE 'Reparación creada: JBL Tune 510BT (Juan)';
    END IF;

    -- 7. GESTIÓN DE CAJA REGISTRADORA
    RAISE NOTICE 'Verificando caja registradora...';

    -- Asegurar que existan los tipos y tablas necesarios (Idempotente)
    DO $DDL$ 
    BEGIN
        -- Tipo cash_movement_type
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cash_movement_type') THEN
            CREATE TYPE cash_movement_type AS ENUM ('apertura', 'venta', 'ingreso', 'egreso', 'cierre');
        END IF;

        -- Tabla cash_registers
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_registers') THEN
            CREATE TABLE cash_registers (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                name TEXT NOT NULL,
                is_open BOOLEAN DEFAULT FALSE,
                balance DECIMAL(12,2) DEFAULT 0,
                created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            -- Políticas RLS básicas
            ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Usuarios autenticados pueden ver cajas" ON cash_registers FOR SELECT TO authenticated USING (true);
            CREATE POLICY "Admin/Vendedores gestionan cajas" ON cash_registers FOR ALL TO authenticated USING (
                EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendedor'))
            );
        END IF;

        -- Tabla cash_movements
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_movements') THEN
            CREATE TABLE cash_movements (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                register_id UUID REFERENCES cash_registers(id) ON DELETE CASCADE,
                type cash_movement_type NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                note TEXT,
                created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            -- Políticas RLS básicas
            ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Usuarios autenticados ven movimientos" ON cash_movements FOR SELECT TO authenticated USING (true);
            CREATE POLICY "Admin/Vendedores crean movimientos" ON cash_movements FOR INSERT TO authenticated WITH CHECK (
                EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendedor'))
            );
        END IF;
    END $DDL$;
    
    SELECT id INTO cash_register_id FROM cash_registers WHERE name = 'Caja Principal' LIMIT 1;
    IF cash_register_id IS NULL THEN
        -- Crear una caja principal
        INSERT INTO cash_registers (name, is_open, balance, created_by)
        VALUES ('Caja Principal', true, 500000, current_user_id)
        RETURNING id INTO cash_register_id;
        
        -- Movimiento inicial de apertura
        INSERT INTO cash_movements (register_id, type, amount, note, created_by, timestamp)
        VALUES (cash_register_id, 'apertura', 500000, 'Apertura de caja inicial', current_user_id, NOW() - INTERVAL '1 day');
        RAISE NOTICE 'Caja Principal creada y abierta';
    END IF;

    -- 8. GESTIÓN DE VENTAS HISTÓRICAS
    -- Verificamos si ya existe la venta del iPhone a Juan para no duplicar
    -- Usamos un criterio aproximado: mismo cliente, fecha reciente (últimos 2 días)
    
    RAISE NOTICE 'Verificando historial de ventas...';

    -- Bloque anónimo anidado para manejo dinámico de esquema de ventas
    DECLARE
        _col_total text;
        _col_subtotal text;
        _col_tax text;
        _col_discount text;
        _has_sale_number boolean;
        _has_user_id boolean;
        _has_code boolean;
        _col_item_subtotal text;
        _sale_id uuid;
        _sql text;
    BEGIN
        -- Detectar columnas disponibles en 'sales'
        -- Preferimos 'total_amount' sobre 'total' si ambos existen (lógica de migración)
        SELECT column_name INTO _col_total FROM information_schema.columns WHERE table_name='sales' AND column_name IN ('total_amount', 'total') ORDER BY length(column_name) DESC LIMIT 1;
        SELECT column_name INTO _col_subtotal FROM information_schema.columns WHERE table_name='sales' AND column_name IN ('subtotal_amount', 'subtotal') ORDER BY length(column_name) DESC LIMIT 1;
        SELECT column_name INTO _col_tax FROM information_schema.columns WHERE table_name='sales' AND column_name IN ('tax_amount', 'tax') ORDER BY length(column_name) DESC LIMIT 1;
        SELECT column_name INTO _col_discount FROM information_schema.columns WHERE table_name='sales' AND column_name IN ('discount_amount', 'discount') ORDER BY length(column_name) DESC LIMIT 1;
        
        _has_sale_number := EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='sale_number');
        _has_user_id := EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='user_id');
        _has_code := EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='code');
        
        -- Detectar columna en 'sale_items'
        SELECT column_name INTO _col_item_subtotal FROM information_schema.columns WHERE table_name='sale_items' AND column_name IN ('subtotal', 'total') ORDER BY length(column_name) DESC LIMIT 1;

        RAISE NOTICE 'Esquema de ventas detectado: Total=%, Subtotal=%, Tax=%, SaleNum=%, UserId=%, Code=%, ItemSub=%', 
                     COALESCE(_col_total, 'NULL'), COALESCE(_col_subtotal, 'NULL'), COALESCE(_col_tax, 'NULL'), _has_sale_number, _has_user_id, _has_code, COALESCE(_col_item_subtotal, 'NULL');

        -- --- VENTA 1: JUAN PEREZ ---
        IF NOT EXISTS (
            SELECT 1 FROM sales 
            WHERE customer_id = cust_juan 
            AND created_at > (NOW() - INTERVAL '2 days')
        ) THEN
            -- Construir INSERT dinámico para sales
            _sql := 'INSERT INTO sales (customer_id, payment_method, status, created_at';
            
            IF _has_sale_number THEN _sql := _sql || ', sale_number'; END IF;
            IF _has_code THEN _sql := _sql || ', code'; END IF;
            IF _has_user_id THEN _sql := _sql || ', user_id'; END IF;
            IF _col_total IS NOT NULL THEN _sql := _sql || ', ' || _col_total; END IF;
            IF _col_subtotal IS NOT NULL THEN _sql := _sql || ', ' || _col_subtotal; END IF;
            IF _col_tax IS NOT NULL THEN _sql := _sql || ', ' || _col_tax; END IF;
            IF _col_discount IS NOT NULL THEN _sql := _sql || ', ' || _col_discount; END IF;
            
            _sql := _sql || ') VALUES (' || quote_literal(cust_juan) || ', ''efectivo'', ''completed'', NOW() - INTERVAL ''1 day''';
            
            IF _has_sale_number THEN _sql := _sql || ', ''V-'' || floor(extract(epoch from now())) || ''-001'''; END IF;
            IF _has_code THEN _sql := _sql || ', ''V-'' || floor(extract(epoch from now())) || ''-001'''; END IF;
            IF _has_user_id THEN _sql := _sql || ', ' || quote_nullable(current_user_id); END IF;
            IF _col_total IS NOT NULL THEN _sql := _sql || ', 5600000'; END IF;
            IF _col_subtotal IS NOT NULL THEN _sql := _sql || ', 5090909'; END IF;
            IF _col_tax IS NOT NULL THEN _sql := _sql || ', 509091'; END IF;
            IF _col_discount IS NOT NULL THEN _sql := _sql || ', 0'; END IF;
            
            _sql := _sql || ') RETURNING id';
            
            EXECUTE _sql INTO _sale_id;
            sale_id_1 := _sale_id; -- Guardar ID para items
            
            -- Insertar Items Venta 1
            IF _col_item_subtotal IS NOT NULL THEN
                _sql := 'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, ' || _col_item_subtotal || ') VALUES ($1, $2, $3, $4, $5)';
                EXECUTE _sql USING sale_id_1, prod_iphone, 1, 5600000, 5600000;
            ELSE
                 -- Fallback simple si no hay columna subtotal (raro)
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (sale_id_1, prod_iphone, 1, 5600000);
            END IF;
            
            -- Movimientos
            INSERT INTO cash_movements (register_id, type, amount, note, created_by, timestamp)
            VALUES (cash_register_id, 'venta', 5600000, 'Venta iPhone 13 - Juan Pérez', current_user_id, NOW() - INTERVAL '1 day');
            
            UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = prod_iphone;
            UPDATE cash_registers SET balance = balance + 5600000 WHERE id = cash_register_id;
            RAISE NOTICE 'Venta creada: iPhone 13 (Juan)';
        END IF;
        
        -- --- VENTA 2: MARIA GONZALEZ ---
        IF NOT EXISTS (
            SELECT 1 FROM sales 
            WHERE customer_id = cust_maria 
            AND created_at > (NOW() - INTERVAL '1 day')
        ) THEN
            -- Construir INSERT dinámico para sales
            _sql := 'INSERT INTO sales (customer_id, payment_method, status, created_at';
            
            IF _has_sale_number THEN _sql := _sql || ', sale_number'; END IF;
            IF _has_code THEN _sql := _sql || ', code'; END IF;
            IF _has_user_id THEN _sql := _sql || ', user_id'; END IF;
            IF _col_total IS NOT NULL THEN _sql := _sql || ', ' || _col_total; END IF;
            IF _col_subtotal IS NOT NULL THEN _sql := _sql || ', ' || _col_subtotal; END IF;
            IF _col_tax IS NOT NULL THEN _sql := _sql || ', ' || _col_tax; END IF;
            IF _col_discount IS NOT NULL THEN _sql := _sql || ', ' || _col_discount; END IF;
            
            _sql := _sql || ') VALUES (' || quote_literal(cust_maria) || ', ''tarjeta'', ''completed'', NOW() - INTERVAL ''2 hours''';
            
            IF _has_sale_number THEN _sql := _sql || ', ''V-'' || floor(extract(epoch from now())) || ''-002'''; END IF;
            IF _has_code THEN _sql := _sql || ', ''V-'' || floor(extract(epoch from now())) || ''-002'''; END IF;
            IF _has_user_id THEN _sql := _sql || ', ' || quote_nullable(current_user_id); END IF;
            IF _col_total IS NOT NULL THEN _sql := _sql || ', 150000'; END IF;
            IF _col_subtotal IS NOT NULL THEN _sql := _sql || ', 136364'; END IF;
            IF _col_tax IS NOT NULL THEN _sql := _sql || ', 13636'; END IF;
            IF _col_discount IS NOT NULL THEN _sql := _sql || ', 0'; END IF;
            
            _sql := _sql || ') RETURNING id';
            
            EXECUTE _sql INTO _sale_id;
            sale_id_2 := _sale_id;
            
            -- Insertar Items Venta 2
            IF _col_item_subtotal IS NOT NULL THEN
                _sql := 'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, ' || _col_item_subtotal || ') VALUES ($1, $2, $3, $4, $5)';
                -- Item 1
                EXECUTE _sql USING sale_id_2, prod_cargador, 1, 90000, 90000;
                -- Item 2
                EXECUTE _sql USING sale_id_2, prod_funda, 1, 60000, 60000;
            ELSE
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (sale_id_2, prod_cargador, 1, 90000);
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (sale_id_2, prod_funda, 1, 60000);
            END IF;
            
            -- Movimientos
            INSERT INTO cash_movements (register_id, type, amount, note, created_by, timestamp)
            VALUES (cash_register_id, 'venta', 150000, 'Venta Accesorios - María', current_user_id, NOW() - INTERVAL '2 hours');
            
            UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = prod_cargador;
            UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = prod_funda;
            UPDATE cash_registers SET balance = balance + 150000 WHERE id = cash_register_id;
            RAISE NOTICE 'Venta creada: Accesorios (María)';
        END IF;
    END;

    -- Registrar un cierre de caja histórico (si no existe uno reciente)
    IF NOT EXISTS (
        SELECT 1 FROM cash_closures 
        WHERE register_id = cash_register_id::text
        AND date > (NOW() - INTERVAL '8 days')
        AND date < (NOW() - INTERVAL '6 days')
    ) THEN
        INSERT INTO cash_closures (
            register_id, type, date,
            opening_balance, closing_balance,
            income_total,
            notes
        ) VALUES (
            cash_register_id::text, 'z',
            NOW() - INTERVAL '7 days' + INTERVAL '12 hours',
            500000, 1500000,
            1000000,
            'Cierre normal semana pasada'
        );
        RAISE NOTICE 'Cierre de caja histórico creado';
    END IF;

    -- 9. MOVIMIENTOS DE PRODUCTOS (Historial de stock)
    RAISE NOTICE 'Verificando movimientos de inventario...';
    
    -- Solo insertamos si no hay movimientos para estos productos (para no llenar el historial en cada ejecución)
    -- Detectar si se usa 'movement_type' o 'type' y 'stock' o 'stock_quantity'
    DECLARE
        _col_mov_type text;
        _col_stock text;
        _sql_mov text;
        _check_exists integer;
        _initial_qty_iphone int := 6;
        _initial_qty_charger int := 51;
    BEGIN
        SELECT column_name INTO _col_mov_type FROM information_schema.columns WHERE table_name='product_movements' AND column_name IN ('movement_type', 'type') ORDER BY length(column_name) DESC LIMIT 1;
        SELECT column_name INTO _col_stock FROM information_schema.columns WHERE table_name='products' AND column_name IN ('stock_quantity', 'stock') ORDER BY length(column_name) DESC LIMIT 1;

        IF _col_mov_type IS NOT NULL THEN
            _sql_mov := 'INSERT INTO product_movements (product_id, ' || _col_mov_type || ', quantity, previous_stock, new_stock, notes, created_at) VALUES ($1, ''in'', $2, 0, $2, ''Stock Inicial'', NOW() - INTERVAL ''1 week'')';
            
            -- iPhone Movement
            EXECUTE 'SELECT 1 FROM product_movements WHERE product_id = $1 AND ' || _col_mov_type || ' = ''in'' LIMIT 1' INTO _check_exists USING prod_iphone;
            IF _check_exists IS NULL THEN
                 EXECUTE _sql_mov USING prod_iphone, _initial_qty_iphone;
                 RAISE NOTICE 'Movimiento inicial creado para iPhone 13';
            END IF;

            -- Charger Movement
            EXECUTE 'SELECT 1 FROM product_movements WHERE product_id = $1 AND ' || _col_mov_type || ' = ''in'' LIMIT 1' INTO _check_exists USING prod_cargador;
            IF _check_exists IS NULL THEN
                 EXECUTE _sql_mov USING prod_cargador, _initial_qty_charger;
                 RAISE NOTICE 'Movimiento inicial creado para Cargador 20W';
            END IF;
        END IF;
    END;

    -- 10. KANBAN ORDERS (Configuración del tablero para el usuario)
    IF current_user_id IS NOT NULL THEN
        RAISE NOTICE 'Verificando configuración Kanban...';
        
        IF NOT EXISTS (SELECT 1 FROM kanban_orders WHERE user_id = current_user_id AND board_type = 'sales_pipeline') THEN
            INSERT INTO kanban_orders (user_id, board_type, items)
            VALUES (current_user_id, 'sales_pipeline', '[]'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM kanban_orders WHERE user_id = current_user_id AND board_type = 'repairs_pipeline') THEN
            INSERT INTO kanban_orders (user_id, board_type, items)
            VALUES (current_user_id, 'repairs_pipeline', '[]'::jsonb);
        END IF;
    END IF;

    RAISE NOTICE 'Carga de datos completada exitosamente.';
END $$;
