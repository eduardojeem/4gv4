const id = (value) => `a1000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const organizationId = id(1);
const branchIds = [id(11), id(12)];
const categorySpecs = [
  ['Celulares Demo', 'Categoría sintética para pruebas locales.'],
  ['Accesorios Demo', 'Categoría sintética para pruebas locales.'],
  ['Cargadores Demo', 'Categoría sintética para pruebas locales.'],
  ['Cables Demo', 'Categoría sintética para pruebas locales.'],
  ['Audio Demo', 'Categoría sintética para pruebas locales.'],
  ['Repuestos Demo', 'Categoría sintética para pruebas locales.'],
];
const productImageAssets = ['celulares.png', 'accesorios.png', 'cargadores.png', 'cables.png', 'audio.png', 'repuestos.png'];
const categoryIds = categorySpecs.map((_, index) => id(201 + index));
const productNames = [
  'Demo Phone A', 'Demo Phone B', 'Demo Phone C', 'Demo Tablet A', 'Demo Phone D', 'Demo Phone E',
  'Cable USB-C Demo', 'Cargador 20W Demo', 'Auriculares Demo', 'Funda Demo A', 'Funda Demo B',
  'Pantalla Repuesto Demo', 'Batería Repuesto Demo', 'Protector Demo', 'Cable Lightning Demo',
  'Cargador 33W Demo', 'Auriculares Bluetooth Demo', 'Adaptador Demo', 'Soporte Demo',
  'Power Bank Demo', 'Cámara Demo', 'Producto Demo Stock Bajo', 'Producto Demo Stock Uno',
  'Producto Demo Stock Cero', 'Repuesto Flex Demo', 'Vidrio Repuesto Demo', 'Cargador Auto Demo',
  'Cable HDMI Demo', 'Memoria Demo', 'Herramienta Taller Demo',
];
const categoryForProduct = [0, 0, 0, 0, 0, 0, 3, 2, 4, 1, 1, 5, 5, 1, 3, 2, 4, 1, 1, 1, 0, 1, 1, 1, 5, 5, 2, 3, 1, 5];
const variantProductNumbers = new Set([1, 2, 3, 4, 5, 6]);
const variantStock = [
  [[4, 2], [2, 1]], [[0, 3], [1, 0]], [[1, 0], [0, 2]],
  [[5, 2], [2, 1]], [[0, 0], [3, 1]], [[2, 1], [0, 0]],
];
const variantNames = [
  ['Negro / 128 GB', 'Azul / 128 GB'], ['Negro / 256 GB', 'Azul / 256 GB'],
  ['Wi-Fi / 64 GB', 'Wi-Fi / 128 GB'], ['10 pulgadas / Gris', '10 pulgadas / Azul'],
  ['Negro / 64 GB', 'Verde / 64 GB'], ['Blanco / 128 GB', 'Negro / 128 GB'],
];
const saleMethods = ['efectivo', 'tarjeta', 'transferencia', 'efectivo', 'tarjeta', 'transferencia'];

function productSalePrice(number) {
  if (number <= 6) return [1_500_000, 1_250_000, 980_000, 1_800_000, 850_000, 720_000][number - 1];
  return 25_000 + ((number * 7_500) % 210_000);
}

function finalStock(number, branchIndex) {
  if (number <= 6) return variantStock[number - 1][branchIndex].reduce((sum, value) => sum + value, 0);
  const central = [0, 1, 2, 5, 18, 30];
  const secondary = [1, 0, 3, 8, 12, 25];
  return (branchIndex === 0 ? central : secondary)[(number - 7) % 6];
}

const products = productNames.map((name, index) => {
  const number = index + 1;
  const purchasePrice = number === 1 ? 0 : number === 2 ? null : Math.round(productSalePrice(number) * 0.62);
  const hasVariants = variantProductNumbers.has(number);
  return {
    id: id(30 + number), organization_id: organizationId, sku: `DEV-PROD-${String(number).padStart(3, '0')}`,
    name, description: `Artículo ficticio ${String(number).padStart(2, '0')} para pruebas locales de MiTiendaPy.`,
    category_id: categoryIds[categoryForProduct[index]], brand: 'Marca Demo', sale_price: productSalePrice(number),
    image_asset: productImageAssets[categoryForProduct[index]],
    purchase_price: purchasePrice, foreign_purchase_price: null, wholesale_price: Math.round(productSalePrice(number) * 0.92),
    stock_quantity: 0, min_stock: number > 20 ? 2 : 1, max_stock: null, is_active: true,
    visibility: !hasVariants && finalStock(number, 0) + finalStock(number, 1) > 0 ? 'public' : 'hidden',
    has_variants: hasVariants, variant_attribute_config: hasVariants ? [{ name: 'opcion', label: 'Opción', type: 'select' }] : [],
  };
});

const variants = [];
for (let productNumber = 1; productNumber <= 6; productNumber += 1) {
  for (let option = 0; option < 2; option += 1) {
    const variantNumber = variants.length + 1;
    const variantId = variantNumber === 1 ? id(32) : id(60 + variantNumber);
    variants.push({
      id: variantId, organization_id: organizationId, product_id: id(30 + productNumber),
      variant_name: variantNames[productNumber - 1][option],
      sku: `DEV-VAR-${String(productNumber).padStart(2, '0')}-${option === 0 ? 'A' : 'B'}`,
      attributes: { opcion: variantNames[productNumber - 1][option] }, purchase_price: Math.round(productSalePrice(productNumber) * 0.52),
      sale_price: productSalePrice(productNumber) + option * 25_000, wholesale_price: null,
      stock_quantity: 0, min_stock: 1, is_active: true,
    });
  }
}

const customers = Array.from({ length: 10 }, (_, index) => ({
  id: id(21 + index), organization_id: organizationId,
  name: `Cliente Demo ${String(index + 1).padStart(2, '0')}`,
  email: `cliente-${String(index + 1).padStart(2, '0')}@dev.example.test`,
  phone: `000000${String(index + 1).padStart(4, '0')}`,
  status: 'activo', customer_type: 'regular', segment: 'regular',
  notes: 'Registro sintético local; no contactar.',
}));

const repairStatuses = ['recibido', 'diagnostico', 'reparacion', 'listo', 'recibido', 'diagnostico', 'reparacion', 'listo', 'pausado', 'recibido'];
const repairs = repairStatuses.map((status, index) => {
  const number = index + 1;
  const received = new Date(Date.UTC(2026, 9, 1 + index, 12)).toISOString();
  return {
    id: id(40 + number), organization_id: organizationId, branch_id: branchIds[index % 2],
    customer_id: id(21 + (index % customers.length)), technician_id: null,
    device_type: number === 4 ? 'tablet' : 'smartphone', device_brand: 'Marca Demo',
    device_model: `Equipo Demo ${String(number).padStart(2, '0')}`,
    problem_description: `Falla ficticia ${String(number).padStart(2, '0')} para pruebas locales.`,
    diagnosis: status === 'diagnostico' || status === 'reparacion' || status === 'listo' ? 'Diagnóstico sintético.' : null,
    solution: status === 'listo' ? 'Solución sintética aplicada.' : null,
    status, priority: number % 3 === 0 ? 'high' : 'medium', urgency: number % 3 === 0 ? 'urgent' : 'normal',
    estimated_cost: 80_000 + number * 25_000, final_cost: status === 'listo' ? 95_000 + number * 25_000 : null,
    labor_cost: 50_000, parts_cost: status === 'listo' ? 45_000 : 0,
    progress: 0, received_at: received, created_at: received,
    estimated_completion: new Date(Date.UTC(2026, 9, 4 + index, 18)).toISOString(),
    completed_at: status === 'listo' ? new Date(Date.UTC(2026, 9, 3 + index, 18)).toISOString() : null,
    payment_status: 'pendiente', paid_amount: 0, access_type: 'none', access_password: null,
    ticket_number: `DEV-REP-${String(40 + number).padStart(3, '0')}`,
    metadata: { seed: 'mitiendapy-mobile-dev', fixture: `repair-${String(number).padStart(2, '0')}` },
  };
});

const sales = [];
const saleItems = [];
for (let saleIndex = 0; saleIndex < 12; saleIndex += 1) {
  const saleNumber = saleIndex + 1;
  const branchIndex = saleIndex % 2;
  const saleId = id(50 + saleNumber);
  const method = saleMethods[saleIndex % saleMethods.length];
  const itemNumbers = [7 + saleIndex * 2, 8 + saleIndex * 2];
  const items = itemNumbers.map((productNumber, lineIndex) => {
    const quantity = saleIndex % 3 === 0 && lineIndex === 1 ? 2 : 1;
    const unitPrice = productSalePrice(productNumber);
    const amount = unitPrice * quantity;
    return {
      id: id(100 + saleIndex * 2 + lineIndex + 1), organization_id: organizationId,
      sale_id: saleId, product_id: id(30 + productNumber), quantity, unit_price: unitPrice,
      discount_amount: 0, subtotal: amount, total_price: amount, variant_id: null,
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const createdAt = new Date(Date.UTC(2026, 9, 1 + saleIndex, 15)).toISOString();
  sales.push({
    id: saleId, code: `DEV-SALE-${String(saleNumber).padStart(3, '0')}`,
    organization_id: organizationId, branch_id: branchIds[branchIndex],
    customer_id: id(21 + (saleIndex % customers.length)),
    user_key: saleIndex % 2 === 0 ? 'seller' : 'owner',
    total_amount: subtotal, subtotal_amount: subtotal, tax_amount: 0, discount_amount: 0,
    payment_method: method, payment_status: 'completed', status: 'completed',
    notes: 'Venta ficticia de seed local.', created_at: createdAt,
  });
  saleItems.push(...items);
}

const soldQuantityByBranchAndProduct = new Map();
for (const sale of sales) {
  const branchIndex = sale.branch_id === branchIds[0] ? 0 : 1;
  for (const item of saleItems.filter((candidate) => candidate.sale_id === sale.id)) {
    soldQuantityByBranchAndProduct.set(`${branchIndex}:${item.product_id}`, item.quantity);
  }
}

const branchInventory = products.flatMap((product) => branchIds.map((branchId, branchIndex) => {
  const productNumber = Number(product.sku.slice(-3));
  const stock = finalStock(productNumber, branchIndex);
  const soldQuantity = soldQuantityByBranchAndProduct.get(`${branchIndex}:${product.id}`) ?? 0;
  return {
    branch_id: branchId, product_id: product.id,
    stock_quantity: stock + soldQuantity, reserved_quantity: 0,
    min_stock: product.min_stock, max_stock: null,
  };
}));

const finalBranchInventory = branchInventory.map((entry) => {
  const productNumber = Number(products.find((product) => product.id === entry.product_id).sku.slice(-3));
  const branchIndex = entry.branch_id === branchIds[0] ? 0 : 1;
  return { ...entry, stock_quantity: finalStock(productNumber, branchIndex) };
});

const variantInventory = variants.flatMap((variant) => {
  const parentNumber = Number(variant.sku.slice(8, 10));
  const option = variant.sku.endsWith('-A') ? 0 : 1;
  return branchIds.map((branchId, branchIndex) => ({
    organization_id: organizationId, branch_id: branchId, product_id: variant.product_id,
    variant_id: variant.id, stock_quantity: variantStock[parentNumber - 1][option][branchIndex],
    reserved_quantity: 0, min_stock: 1,
  }));
});

const sessions = branchIds.map((branchId, branchIndex) => {
  const branchSales = sales.filter((sale) => sale.branch_id === branchId);
  const sumMethod = (method) => branchSales.filter((sale) => sale.payment_method === method).reduce((sum, sale) => sum + sale.total_amount, 0);
  const openingBalance = 100_000;
  const cashTotal = sumMethod('efectivo');
  return {
    id: id(91 + branchIndex), organization_id: organizationId, branch_id: branchId,
    register_id: id(13 + branchIndex), type: 'cierre', date: new Date(Date.UTC(2026, 9, 20, 20)).toISOString(),
    opening_balance: openingBalance, closing_balance: openingBalance + cashTotal,
    expected_balance: openingBalance + cashTotal, income_total: cashTotal, expense_total: 0,
    sales_total_cash: cashTotal, sales_total_card: sumMethod('tarjeta'),
    sales_total_transfer: sumMethod('transferencia'), sales_total_mixed: 0,
    movements_count: branchSales.length + 1, opened_by_key: 'owner', closed_by_key: 'owner',
    status: 'cerrada', notes: 'Cierre histórico ficticio del seed local.',
  };
});

const movements = sessions.map((session, branchIndex) => ({
  id: id(109 + branchIndex), organization_id: organizationId, branch_id: session.branch_id,
  register_id: session.register_id, session_id: session.id, type: 'apertura', amount: 100_000,
  payment_method: 'efectivo', created_by_key: 'owner', note: 'Apertura histórica ficticia.',
  reason: 'Fixture DEV local.', created_at: new Date(Date.UTC(2026, 9, 20, 8)).toISOString(),
}));
for (let saleIndex = 0; saleIndex < sales.length; saleIndex += 1) {
  const sale = sales[saleIndex];
  const branchIndex = sale.branch_id === branchIds[0] ? 0 : 1;
  movements.push({
    id: id(111 + saleIndex), organization_id: organizationId, branch_id: sale.branch_id,
    register_id: sessions[branchIndex].register_id, session_id: sessions[branchIndex].id,
    type: 'venta', amount: sale.total_amount, payment_method: sale.payment_method,
    sale_id: sale.id, created_by_key: sale.user_key,
    note: `Movimiento de venta ficticia ${sale.code}.`, reason: 'Fixture DEV local.', created_at: sale.created_at,
  });
}

const dataset = {
  organization: { id: organizationId, name: 'MiTiendaPy Demo', slug: 'mitiendapy-dev-synthetic', plan: 'PRO', owner_key: 'owner', business_vertical: 'electronics', operating_model: 'mixed', marketplace_public: true, storefront_public: true },
  branches: [
    { id: branchIds[0], organization_id: organizationId, code: 'DEV-CENTRAL', name: 'Casa Central Demo', slug: 'mitiendapy-dev-central', is_active: true, is_default: true },
    { id: branchIds[1], organization_id: organizationId, code: 'DEV-SECUNDARIA', name: 'Sucursal Demo', slug: 'mitiendapy-dev-secundaria', is_active: true, is_default: false },
  ],
  categories: categorySpecs.map(([name, description], index) => ({ id: categoryIds[index], organization_id: organizationId, name, description, is_active: true })),
  products, variants, customers, repairs, sales, saleItems, branchInventory, finalBranchInventory, variantInventory,
  userBranchAssignments: [
    { user_key: 'owner', branch_id: branchIds[0], is_primary: true },
    { user_key: 'owner', branch_id: branchIds[1], is_primary: false },
    { user_key: 'seller', branch_id: branchIds[0], is_primary: true },
    { user_key: 'technician', branch_id: branchIds[0], is_primary: true },
    { user_key: 'technician', branch_id: branchIds[1], is_primary: false },
  ],
  members: [
    { user_key: 'owner', role: 'owner', profile_role: 'admin', global_role: 'admin' },
    { user_key: 'seller', role: 'seller', profile_role: 'vendedor', global_role: 'vendedor' },
    { user_key: 'technician', role: 'technician', profile_role: 'tecnico', global_role: 'tecnico' },
  ],
  cash: {
    registers: [
      { id: id(13), branch_id: branchIds[0], name: 'Caja Demo Central' },
      { id: id(14), branch_id: branchIds[1], name: 'Caja Demo Sucursal' },
    ], sessions, movements,
  },
};

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlLiteral(value, column) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('El dataset contiene un número inválido.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return `${sqlString(JSON.stringify(value))}::jsonb`;
  }
  if (column === 'created_at' || column.endsWith('_at') || column === 'date' || column === 'received_at') {
    return `${sqlString(value)}::timestamptz`;
  }
  return sqlString(value);
}

function insertRows(table, rows, columns, conflictColumns, updateColumns = columns.filter((column) => !conflictColumns.includes(column))) {
  if (!rows.length) return '';
  const values = rows.map((row) => `(${columns.map((column) => sqlLiteral(row[column], column)).join(', ')})`).join(',\n');
  const conflict = conflictColumns.length === 1 ? conflictColumns[0] : conflictColumns.join(', ');
  const updates = updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(', ');
  const condition = updateColumns.length
    ? ` WHERE (${updateColumns.map((column) => `${table}.${column}`).join(', ')}) IS DISTINCT FROM (${updateColumns.map((column) => `EXCLUDED.${column}`).join(', ')})`
    : '';
  return `INSERT INTO public.${table} (${columns.join(', ')})\nVALUES\n${values}\nON CONFLICT (${conflict}) DO UPDATE SET ${updates}${condition};\n`;
}

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function getMobileDevDataset() {
  return structuredClone(dataset);
}

export function assertLocalSeedTarget({ supabaseUrl, localProjectId, containerProjectId, databaseHealthy, remoteReferenceDetected }) {
  let parsed;
  try { parsed = new URL(supabaseUrl); } catch { throw new Error('Seed bloqueado: la URL local no es válida.'); }
  const localHost = ['127.0.0.1', 'localhost'].includes(parsed.hostname.toLowerCase());
  if (parsed.protocol !== 'http:' || !localHost || parsed.port !== '55321'
    || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Seed bloqueado: el destino debe ser el Supabase local verificado en 55321.');
  }
  if (localProjectId !== 'mitiendapy-mobile-dev' || containerProjectId !== localProjectId || databaseHealthy !== true || remoteReferenceDetected === true) {
    throw new Error('Seed bloqueado: no se pudo demostrar que la base destino sea el stack DEV aislado.');
  }
  return true;
}

export function buildSeedSql(users, {
  debugStages = false,
  productImageBaseUrl = 'http://127.0.0.1:55321/storage/v1/object/public/dev-product-images',
} = {}) {
  for (const key of ['owner', 'seller', 'technician']) {
    if (!validUuid(users?.[key])) throw new Error('Seed bloqueado: Auth local devolvió un identificador no válido.');
  }
  const data = getMobileDevDataset();
  let imageBase;
  try {
    const parsed = new URL(productImageBaseUrl);
    const host = parsed.hostname.toLowerCase();
    const octets = host.split('.').map(Number);
    const privateLan = (octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
      && (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168)
        || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)));
    const localHost = host === 'localhost' || host === '127.0.0.1' || privateLan;
    if (parsed.protocol !== 'http:' || parsed.port !== '55321' || !localHost
      || parsed.username || parsed.password || parsed.search || parsed.hash
      || parsed.pathname.replace(/\/$/, '') !== '/storage/v1/object/public/dev-product-images') {
      throw new Error('invalid local storage base');
    }
    imageBase = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    throw new Error('Seed bloqueado: la URL de imágenes debe apuntar al Storage local aislado.');
  }
  const productsWithImages = data.products.map((product) => ({
    ...product,
    image_url: `${imageBase}/dev-fixtures/products/${encodeURIComponent(product.image_asset)}`,
  }));
  const userId = (key) => users[key];
  const legacySessionIds = users.legacySmokeSessionIds ?? [];
  if (!Array.isArray(legacySessionIds) || legacySessionIds.some((value) => !validUuid(value))) {
    throw new Error('Seed bloqueado: la sesión DEV previa no tiene identificadores válidos.');
  }
  const sql = [];
  const debugStepCounts = new Map();
  const pushSql = (statement) => {
    if (debugStages) {
      const table = /INSERT INTO public\.([a-z_]+)/i.exec(statement)?.[1];
      if (table) {
        const step = (debugStepCounts.get(table) ?? 0) + 1;
        debugStepCounts.set(table, step);
        sql.push(`DO $seed_label$ BEGIN RAISE NOTICE 'seed-step: ${table}#${step}'; END; $seed_label$;\n`);
      }
    }
    sql.push(statement);
  };
  sql.push(`BEGIN;\nSET LOCAL statement_timeout = '45s';\nSET LOCAL lock_timeout = '5s';\n`);
  pushSql(insertRows('organizations', [{ ...data.organization, owner_id: userId(data.organization.owner_key) }], ['id', 'name', 'slug', 'plan', 'owner_id', 'business_vertical', 'operating_model', 'marketplace_public', 'storefront_public'], ['id'], ['name', 'slug', 'plan', 'owner_id', 'business_vertical', 'operating_model', 'marketplace_public', 'storefront_public']));
  pushSql(insertRows('branches', data.branches, ['id', 'organization_id', 'code', 'name', 'slug', 'is_active', 'is_default'], ['id']));
  const profiles = data.members.map((member) => ({ id: userId(member.user_key), full_name: member.user_key === 'owner' ? 'Administrador Demo' : member.user_key === 'seller' ? 'Vendedor Demo' : 'Técnico Demo', role: member.profile_role, status: 'active' }));
  pushSql(insertRows('profiles', profiles, ['id', 'full_name', 'role', 'status'], ['id']));
  const members = data.members.map((member) => ({ organization_id: data.organization.id, user_id: userId(member.user_key), role: member.role, status: 'active' }));
  pushSql(insertRows('organization_members', members, ['organization_id', 'user_id', 'role', 'status'], ['organization_id', 'user_id']));
  const roles = data.members.map((member) => ({ user_id: userId(member.user_key), role: member.global_role, is_active: true }));
  pushSql(insertRows('user_roles', roles, ['user_id', 'role', 'is_active'], ['user_id']));
  const assignments = data.userBranchAssignments.map((assignment) => ({
    user_id: userId(assignment.user_key), branch_id: assignment.branch_id,
    is_primary: assignment.is_primary, is_active: true, assigned_by: userId('owner'), organization_id: data.organization.id,
  }));
  for (const assignment of assignments) {
    const values = ['user_id', 'branch_id', 'is_primary', 'is_active', 'assigned_by', 'organization_id'];
    const columns = values.map((column) => column).join(', ');
    const literals = values.map((column) => sqlLiteral(assignment[column], column)).join(', ');
    const identity = `user_id = ${sqlLiteral(assignment.user_id, 'user_id')} AND branch_id = ${sqlLiteral(assignment.branch_id, 'branch_id')}`;
    const exact = `${identity} AND is_primary IS NOT DISTINCT FROM ${sqlLiteral(assignment.is_primary, 'is_primary')} AND is_active IS NOT DISTINCT FROM TRUE AND assigned_by IS NOT DISTINCT FROM ${sqlLiteral(assignment.assigned_by, 'assigned_by')} AND organization_id IS NOT DISTINCT FROM ${sqlLiteral(assignment.organization_id, 'organization_id')}`;
    const primaryRepair = assignment.is_primary
      ? `UPDATE public.user_branch_assignments SET is_primary = TRUE WHERE ${identity} AND is_primary IS DISTINCT FROM TRUE;`
      : '';
    pushSql(`DO $seed_assignment$ BEGIN
      IF EXISTS (SELECT 1 FROM public.user_branch_assignments WHERE ${exact}) THEN
        NULL;
      ELSIF EXISTS (SELECT 1 FROM public.user_branch_assignments WHERE ${identity}) THEN
        UPDATE public.user_branch_assignments SET is_primary = FALSE, is_active = TRUE, assigned_by = ${sqlLiteral(assignment.assigned_by, 'assigned_by')}, organization_id = ${sqlLiteral(assignment.organization_id, 'organization_id')} WHERE ${identity};
        ${primaryRepair}
      ELSE
        INSERT INTO public.user_branch_assignments (${columns}) VALUES (${literals});
      END IF;
    END $seed_assignment$;`);
  }
  pushSql(insertRows('categories', data.categories, ['id', 'organization_id', 'name', 'description', 'is_active'], ['id']));
  pushSql(insertRows('products', productsWithImages, ['id', 'organization_id', 'sku', 'name', 'description', 'category_id', 'brand', 'image_url', 'sale_price', 'purchase_price', 'foreign_purchase_price', 'wholesale_price', 'stock_quantity', 'min_stock', 'max_stock', 'is_active', 'visibility', 'has_variants', 'variant_attribute_config'], ['id']));
  pushSql(insertRows('product_variants', data.variants, ['id', 'organization_id', 'product_id', 'variant_name', 'sku', 'attributes', 'purchase_price', 'sale_price', 'wholesale_price', 'stock_quantity', 'min_stock', 'is_active'], ['id']));
  pushSql(insertRows('branch_inventory', data.branchInventory, ['branch_id', 'product_id', 'stock_quantity', 'reserved_quantity', 'min_stock', 'max_stock'], ['branch_id', 'product_id']));
  pushSql(insertRows('branch_variant_inventory', data.variantInventory, ['organization_id', 'branch_id', 'product_id', 'variant_id', 'stock_quantity', 'reserved_quantity', 'min_stock'], ['branch_id', 'variant_id']));
  pushSql(insertRows('customers', data.customers, ['id', 'organization_id', 'name', 'email', 'phone', 'status', 'customer_type', 'segment', 'notes'], ['id']));
  const repairs = data.repairs.map((repair) => ({ ...repair, technician_id: userId('technician') }));
  pushSql(insertRows('repairs', repairs, ['id', 'organization_id', 'branch_id', 'customer_id', 'technician_id', 'device_type', 'device_brand', 'device_model', 'problem_description', 'diagnosis', 'solution', 'status', 'priority', 'urgency', 'estimated_cost', 'final_cost', 'labor_cost', 'parts_cost', 'progress', 'received_at', 'created_at', 'estimated_completion', 'completed_at', 'payment_status', 'paid_amount', 'access_type', 'access_password', 'ticket_number', 'metadata'], ['id']));
  const sales = data.sales.map((sale) => {
    const { user_key, ...row } = sale;
    return { ...row, created_by: userId(user_key) };
  });
  pushSql(insertRows('sales', sales, ['id', 'code', 'organization_id', 'branch_id', 'customer_id', 'created_by', 'total_amount', 'subtotal_amount', 'tax_amount', 'discount_amount', 'payment_method', 'payment_status', 'status', 'notes', 'created_at'], ['id']));
  pushSql(insertRows('sale_items', data.saleItems, ['id', 'organization_id', 'sale_id', 'product_id', 'quantity', 'unit_price', 'discount_amount', 'subtotal', 'variant_id'], ['id']));
  pushSql(insertRows('cash_registers', data.cash.registers.map((register) => ({ ...register, organization_id: data.organization.id, created_by: userId('owner'), is_open: false, balance: 0, is_active: true })), ['id', 'organization_id', 'branch_id', 'name', 'created_by', 'is_open', 'balance', 'is_active'], ['id']));
  const sessions = data.cash.sessions.map((session) => ({ ...session, opened_by: userId(session.opened_by_key), closed_by: userId(session.closed_by_key) }));
  pushSql(insertRows('cash_closures', sessions, ['id', 'organization_id', 'branch_id', 'register_id', 'type', 'date', 'opening_balance', 'closing_balance', 'expected_balance', 'income_total', 'expense_total', 'sales_total_cash', 'sales_total_card', 'sales_total_transfer', 'sales_total_mixed', 'movements_count', 'opened_by', 'closed_by', 'status', 'notes'], ['id']));
  const movements = data.cash.movements.map((movement) => {
    const { created_by_key, ...row } = movement;
    return { ...row, created_by: userId(created_by_key) };
  });
  pushSql(insertRows('cash_movements', movements, ['id', 'organization_id', 'branch_id', 'register_id', 'session_id', 'type', 'amount', 'payment_method', 'sale_id', 'created_by', 'note', 'reason', 'created_at'], ['id']));
  pushSql(insertRows('branch_inventory', data.finalBranchInventory, ['branch_id', 'product_id', 'stock_quantity', 'reserved_quantity', 'min_stock', 'max_stock'], ['branch_id', 'product_id']));
  if (legacySessionIds.length) {
    const sessionList = legacySessionIds.map((sessionId) => `${sqlString(sessionId)}::uuid`).join(', ');
    sql.push(`DO $seed_reconcile$
DECLARE reconciled_count integer;
BEGIN
  UPDATE public.cash_closures c
  SET type = 'cierre', status = 'cerrada', closed_by = ${sqlString(userId('owner'))},
      closing_balance = c.opening_balance, expected_balance = c.opening_balance,
      discrepancy = 0, last_activity_at = now(),
      notes = c.notes || ' · conciliada como fixture histórico local'
  WHERE c.id IN (${sessionList})
    AND c.organization_id = ${sqlString(data.organization.id)}::uuid
    AND c.branch_id = ${sqlString(data.branches[0].id)}::uuid
    AND c.register_id = ${sqlString(data.cash.registers[0].id)}
    AND c.status = 'abierta'
    AND c.notes = 'Prueba sintética local DEV'
    AND (SELECT count(*) = 1 AND bool_and(m.type::text IN ('apertura', 'opening'))
         FROM public.cash_movements m WHERE m.session_id = c.id);
  GET DIAGNOSTICS reconciled_count = ROW_COUNT;
  IF reconciled_count <> ${legacySessionIds.length} THEN
    RAISE EXCEPTION 'LOCAL_DEV_CASH_RECONCILIATION_PRECONDITION_FAILED';
  END IF;
END;
$seed_reconcile$;
`);
  }
  sql.push(`UPDATE public.cash_registers SET balance = 0, is_open = false WHERE id IN (${data.cash.registers.map((register) => sqlString(register.id)).join(', ')}) AND organization_id = ${sqlString(data.organization.id)};\nCOMMIT;\n`);
  return sql.join('\n');
}
