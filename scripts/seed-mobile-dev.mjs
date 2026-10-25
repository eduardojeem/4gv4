import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { assertLocalSeedTarget, buildSeedSql, getMobileDevDataset } from './mobile-dev-dataset.mjs';

const ROOT = process.cwd();
const LOCAL_PROJECT_ID = 'mitiendapy-mobile-dev';
const DATABASE_CONTAINER = 'supabase_db_mitiendapy-mobile-dev';
const GATEWAY_CONTAINER = 'supabase_kong_mitiendapy-mobile-dev';
const LOCAL_PROJECT = join(process.env.LOCALAPPDATA ?? '', 'MiTiendaPy', 'mobile-dev-supabase');
const LOCAL_SUPABASE_DIR = join(LOCAL_PROJECT, 'supabase');
const ROOT_ENV_PATH = join(ROOT, '.env.development.local');
const MOBILE_ENV_PATH = join(ROOT, 'mobile', '.env.local');
const FORBIDDEN_PROJECT_REFS = ['cswtugmwazxdktntndpy', 'yjrltxeccaoyyvfajafl'];
const DRY_RUN = process.argv.includes('--dry-run');
const PAGE_SIZE = 1000;
const PRODUCT_IMAGE_BUCKET = 'dev-product-images';

function fail(message) {
  throw new Error(message);
}

function run(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    input,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return { ok: false, output: result.stdout ?? '', stderr: result.stderr ?? '' };
  return { ok: true, output: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function dockerInspect(containerName) {
  const result = run('docker', ['inspect', '--format', '{{json .}}', containerName]);
  if (!result.ok) fail('Seed bloqueado: Docker no pudo verificar el stack local esperado.');
  try { return JSON.parse(result.output.trim()); } catch { fail('Seed bloqueado: Docker no devolvió metadata válida del stack local.'); }
}

function getJwtClaims(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return {
      ref: typeof payload.ref === 'string' ? payload.ref : null,
      projectId: typeof payload.project_id === 'string' ? payload.project_id : null,
      role: typeof payload.role === 'string' ? payload.role : null,
    };
  } catch { return null; }
}

function localEnvironment() {
  if (!existsSync(ROOT_ENV_PATH) || !existsSync(MOBILE_ENV_PATH)) {
    fail('Seed bloqueado: faltan los archivos locales de configuración DEV.');
  }
  const app = dotenv.parse(readFileSync(ROOT_ENV_PATH));
  const mobile = dotenv.parse(readFileSync(MOBILE_ENV_PATH));
  const apiUrl = app.NEXT_PUBLIC_SUPABASE_URL;
  const keyValues = [app.NEXT_PUBLIC_SUPABASE_ANON_KEY, app.SUPABASE_SERVICE_ROLE_KEY, mobile.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY];
  const claims = keyValues.map(getJwtClaims).filter(Boolean);
  const remoteReferenceDetected = FORBIDDEN_PROJECT_REFS.some((ref) =>
    String(apiUrl ?? '').includes(ref) || claims.some((claim) => claim.ref === ref || claim.projectId === ref));

  const configPath = join(LOCAL_SUPABASE_DIR, 'config.toml');
  const projectRefPath = join(LOCAL_SUPABASE_DIR, '.temp', 'project-ref');
  if (!existsSync(configPath) || existsSync(projectRefPath)) {
    fail('Seed bloqueado: falta la configuración del stack aislado o aparece vinculado a un ref remoto.');
  }
  const config = readFileSync(configPath, 'utf8').replace(/\r\n/g, '\n');
  const localProjectId = /^project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1] ?? '';
  if (localProjectId !== LOCAL_PROJECT_ID) fail('Seed bloqueado: el project_id local no coincide con el entorno DEV esperado.');

  const database = dockerInspect(DATABASE_CONTAINER);
  const gateway = dockerInspect(GATEWAY_CONTAINER);
  const projectLabel = (container) => container.Config?.Labels?.['com.docker.compose.project'] ?? '';
  const databaseHealthy = database.State?.Status === 'running'
    && database.State?.Health?.Status === 'healthy'
    && projectLabel(database) === LOCAL_PROJECT_ID
    && projectLabel(gateway) === LOCAL_PROJECT_ID;
  const bindings = gateway.NetworkSettings?.Ports?.['8000/tcp'] ?? [];
  const correctGatewayPort = bindings.some((binding) => binding.HostPort === '55321');
  if (!correctGatewayPort) fail('Seed bloqueado: el gateway local no está publicado en el puerto DEV esperado.');

  assertLocalSeedTarget({
    supabaseUrl: apiUrl,
    localProjectId,
    containerProjectId: projectLabel(database),
    databaseHealthy,
    remoteReferenceDetected,
  });

  if (!app.SUPABASE_SERVICE_ROLE_KEY || !app.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || !app.MOBILE_DEV_TEST_PASSWORD || app.MOBILE_DEV_TEST_PASSWORD.length < 12) {
    fail('Seed bloqueado: faltan credenciales locales válidas para provisionar usuarios de prueba.');
  }
  const ownerEmail = app.MOBILE_DEV_OWNER_EMAIL?.trim().toLowerCase();
  const technicianEmail = app.MOBILE_DEV_TECH_EMAIL?.trim().toLowerCase();
  const sellerEmail = 'seller@dev.example.test';
  const emails = [ownerEmail, sellerEmail, technicianEmail];
  if (emails.some((email) => !email || !/^[a-z0-9._%+-]+@dev\.example\.test$/.test(email))
    || new Set(emails).size !== emails.length) {
    fail('Seed bloqueado: los usuarios deben utilizar emails sintéticos reservados y distintos.');
  }
  for (const claim of claims) {
    if (FORBIDDEN_PROJECT_REFS.includes(claim.ref) || FORBIDDEN_PROJECT_REFS.includes(claim.projectId)) {
      fail('Seed bloqueado: se detectó una credencial asociada a un proyecto remoto prohibido.');
    }
  }

  const lanAddresses = Object.values(networkInterfaces()).flatMap((addresses) => (addresses ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal).map((address) => address.address));
  const mobileUrl = (() => { try { return new URL(mobile.EXPO_PUBLIC_SUPABASE_URL); } catch { return null; } })();
  const mobileLanReady = mobileUrl?.protocol === 'http:' && mobileUrl.port === '55321' && lanAddresses.includes(mobileUrl.hostname);
  return {
    app,
    mobile,
    emails: { owner: ownerEmail, seller: sellerEmail, technician: technicianEmail },
    mobileLanReady,
  };
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildPreflightSql() {
  const data = getMobileDevDataset();
  const requiredColumns = {
    organizations: ['id', 'name', 'slug', 'plan', 'owner_id', 'business_vertical', 'operating_model', 'marketplace_public', 'storefront_public'],
    branches: ['id', 'organization_id', 'code', 'name', 'slug', 'is_active', 'is_default'],
    profiles: ['id', 'full_name', 'role', 'status'],
    organization_members: ['organization_id', 'user_id', 'role', 'status'],
    user_roles: ['user_id', 'role', 'is_active'],
    user_branch_assignments: ['user_id', 'branch_id', 'is_primary', 'is_active', 'assigned_by', 'organization_id'],
    categories: ['id', 'organization_id', 'name', 'description', 'is_active'],
    products: ['id', 'organization_id', 'sku', 'name', 'description', 'category_id', 'brand', 'image_url', 'sale_price', 'purchase_price', 'foreign_purchase_price', 'wholesale_price', 'stock_quantity', 'min_stock', 'max_stock', 'is_active', 'visibility', 'has_variants', 'variant_attribute_config'],
    product_variants: ['id', 'organization_id', 'product_id', 'variant_name', 'sku', 'attributes', 'purchase_price', 'sale_price', 'wholesale_price', 'stock_quantity', 'min_stock', 'is_active'],
    branch_inventory: ['branch_id', 'product_id', 'stock_quantity', 'reserved_quantity', 'min_stock', 'max_stock'],
    branch_variant_inventory: ['organization_id', 'branch_id', 'product_id', 'variant_id', 'stock_quantity', 'reserved_quantity', 'min_stock'],
    customers: ['id', 'organization_id', 'name', 'email', 'phone', 'status', 'customer_type', 'segment', 'notes'],
    repairs: ['id', 'organization_id', 'branch_id', 'customer_id', 'technician_id', 'device_type', 'device_brand', 'device_model', 'problem_description', 'diagnosis', 'solution', 'status', 'priority', 'urgency', 'estimated_cost', 'final_cost', 'labor_cost', 'parts_cost', 'progress', 'received_at', 'created_at', 'estimated_completion', 'completed_at', 'payment_status', 'paid_amount', 'access_type', 'access_password', 'ticket_number', 'metadata'],
    sales: ['id', 'code', 'organization_id', 'branch_id', 'customer_id', 'created_by', 'total_amount', 'subtotal_amount', 'tax_amount', 'discount_amount', 'payment_method', 'payment_status', 'status', 'notes', 'created_at'],
    sale_items: ['id', 'organization_id', 'sale_id', 'product_id', 'quantity', 'unit_price', 'discount_amount', 'subtotal', 'total_price', 'variant_id'],
    cash_registers: ['id', 'organization_id', 'branch_id', 'name', 'created_by', 'is_open', 'balance', 'is_active'],
    cash_closures: ['id', 'organization_id', 'branch_id', 'register_id', 'type', 'date', 'opening_balance', 'closing_balance', 'expected_balance', 'income_total', 'expense_total', 'sales_total_cash', 'sales_total_card', 'sales_total_transfer', 'sales_total_mixed', 'movements_count', 'opened_by', 'closed_by', 'status', 'notes'],
    cash_movements: ['id', 'organization_id', 'branch_id', 'register_id', 'session_id', 'type', 'amount', 'payment_method', 'sale_id', 'created_by', 'note', 'reason', 'created_at'],
  };
  const columnsValues = Object.entries(requiredColumns).flatMap(([table, columns]) => columns.map((column) => `(${sqlString(table)}, ${sqlString(column)})`)).join(',\n');
  const rlsTables = Object.keys(requiredColumns).map(sqlString).join(', ');
  const products = data.products.map((product) => `(${sqlString(product.id)}::uuid, ${sqlString(product.sku)})`).join(', ');
  const variants = data.variants.map((variant) => `(${sqlString(variant.id)}::uuid, ${sqlString(variant.product_id)}::uuid, ${sqlString(variant.sku)}, ${sqlString(variant.variant_name)})`).join(', ');
  const customers = data.customers.map((customer) => `(${sqlString(customer.id)}::uuid, ${sqlString(customer.email)})`).join(', ');
  const repairs = data.repairs.map((repair) => `(${sqlString(repair.id)}::uuid, ${sqlString(repair.ticket_number)})`).join(', ');
  const sales = data.sales.map((sale) => `(${sqlString(sale.id)}::uuid, ${sqlString(sale.code)})`).join(', ');
  const categories = data.categories.map((category) => `(${sqlString(category.id)}::uuid, ${sqlString(category.name)})`).join(', ');
  const branchRows = data.branches.map((branch) => `(${sqlString(branch.id)}::uuid, ${sqlString(branch.slug)})`).join(', ');
  const registers = data.cash.registers.map((register) => `(${sqlString(register.id)}::uuid, ${sqlString(register.name)})`).join(', ');
  const sessions = data.cash.sessions.map((session) => `(${sqlString(session.id)}::uuid, ${sqlString(session.branch_id)}::uuid)`).join(', ');
  const movements = data.cash.movements.map((movement) => `(${sqlString(movement.id)}::uuid, ${sqlString(movement.note)})`).join(', ');
  return `BEGIN TRANSACTION READ ONLY;
WITH required_columns(table_name, column_name) AS (VALUES ${columnsValues}),
missing_columns AS (
  SELECT r.table_name || '.' || r.column_name AS object_name FROM required_columns r
  LEFT JOIN information_schema.columns c ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
  WHERE c.column_name IS NULL
),
missing_rls AS (
  SELECT t.table_name FROM unnest(ARRAY[${rlsTables}]::text[]) t(table_name)
  LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || t.table_name)
  WHERE c.oid IS NULL OR c.relrowsecurity IS NOT TRUE
),
collisions AS (
  SELECT
    EXISTS(SELECT 1 FROM public.organizations WHERE id=${sqlString(data.organization.id)}::uuid AND slug <> ${sqlString(data.organization.slug)})
      OR EXISTS(SELECT 1 FROM public.organizations WHERE slug=${sqlString(data.organization.slug)} AND id <> ${sqlString(data.organization.id)}::uuid)
      AS organization,
    EXISTS(SELECT 1 FROM public.branches b JOIN (VALUES ${branchRows}) e(id,slug) ON b.id=e.id WHERE b.organization_id <> ${sqlString(data.organization.id)}::uuid OR b.slug <> e.slug)
      OR EXISTS(SELECT 1 FROM public.branches b JOIN (VALUES ${branchRows}) e(id,slug) ON b.slug=e.slug WHERE b.id <> e.id)
      AS branches,
    EXISTS(SELECT 1 FROM public.categories c JOIN (VALUES ${categories}) e(id,name) ON c.id=e.id WHERE c.organization_id <> ${sqlString(data.organization.id)}::uuid OR c.name <> e.name)
      AS categories,
    EXISTS(SELECT 1 FROM public.products p JOIN (VALUES ${products}) e(id,sku) ON p.id=e.id WHERE p.organization_id <> ${sqlString(data.organization.id)}::uuid OR (p.sku <> e.sku AND NOT (p.id=${sqlString(data.products[0].id)}::uuid AND p.sku='DEV-SKU-001')))
      OR EXISTS(SELECT 1 FROM public.products p JOIN (VALUES ${products}) e(id,sku) ON p.sku=e.sku WHERE p.id <> e.id)
      AS products,
    EXISTS(SELECT 1 FROM public.product_variants v JOIN (VALUES ${variants}) e(id,product_id,sku,name) ON v.id=e.id WHERE v.organization_id <> ${sqlString(data.organization.id)}::uuid OR v.product_id <> e.product_id OR (COALESCE(v.sku,'') <> e.sku AND NOT (v.id=${sqlString(data.variants[0].id)}::uuid AND v.variant_name='Variante sintética DEV')))
      OR EXISTS(SELECT 1 FROM public.product_variants v JOIN (VALUES ${variants}) e(id,product_id,sku,name) ON v.sku=e.sku WHERE v.id <> e.id)
      AS variants,
    EXISTS(SELECT 1 FROM public.customers c JOIN (VALUES ${customers}) e(id,email) ON c.id=e.id WHERE c.organization_id <> ${sqlString(data.organization.id)}::uuid OR (COALESCE(c.email,'') <> e.email AND NOT (c.id=${sqlString(data.customers[0].id)}::uuid AND c.email='customer@dev.example.test')))
      OR EXISTS(SELECT 1 FROM public.customers c JOIN (VALUES ${customers}) e(id,email) ON c.email=e.email WHERE c.id <> e.id)
      AS customers,
    EXISTS(SELECT 1 FROM public.repairs r JOIN (VALUES ${repairs}) e(id,ticket_number) ON r.id=e.id WHERE r.organization_id <> ${sqlString(data.organization.id)}::uuid OR (COALESCE(r.ticket_number,'') <> e.ticket_number AND NOT (r.id=${sqlString(data.repairs[0].id)}::uuid AND r.customer_id=${sqlString(data.customers[0].id)}::uuid AND r.device_brand='Marca sintética')))
      OR EXISTS(SELECT 1 FROM public.repairs r JOIN (VALUES ${repairs}) e(id,ticket_number) ON r.ticket_number=e.ticket_number WHERE r.id <> e.id)
      AS repairs,
    EXISTS(SELECT 1 FROM public.sales s JOIN (VALUES ${sales}) e(id,code) ON s.id=e.id WHERE s.organization_id <> ${sqlString(data.organization.id)}::uuid OR (s.code <> e.code AND NOT (s.id=${sqlString(data.sales[0].id)}::uuid AND s.code='DEV-SALE-0001')))
      OR EXISTS(SELECT 1 FROM public.sales s JOIN (VALUES ${sales}) e(id,code) ON s.code=e.code WHERE s.id <> e.id)
      AS sales,
    EXISTS(SELECT 1 FROM public.cash_registers r JOIN (VALUES ${registers}) e(id,name) ON r.id=e.id WHERE r.organization_id <> ${sqlString(data.organization.id)}::uuid OR r.branch_id NOT IN (${data.branches.map((branch) => `${sqlString(branch.id)}::uuid`).join(', ')}) OR (r.name <> e.name AND NOT (r.id=${sqlString(data.cash.registers[0].id)}::uuid AND r.name='Caja DEV sintética')))
      AS cash_registers,
    EXISTS(SELECT 1 FROM public.cash_closures c JOIN (VALUES ${sessions}) e(id,branch_id) ON c.id=e.id WHERE c.organization_id <> ${sqlString(data.organization.id)}::uuid OR c.branch_id <> e.branch_id OR COALESCE(c.notes,'') NOT ILIKE '%fict%')
      AS cash_closures,
    EXISTS(SELECT 1 FROM public.cash_movements m JOIN (VALUES ${movements}) e(id,note) ON m.id=e.id WHERE m.organization_id <> ${sqlString(data.organization.id)}::uuid OR COALESCE(m.note,'') <> e.note)
      AS cash_movements
)
SELECT json_build_object(
  'missing_columns', COALESCE((SELECT json_agg(object_name) FROM missing_columns), '[]'::json),
  'missing_rls', COALESCE((SELECT json_agg(table_name) FROM missing_rls), '[]'::json),
  'cost_columns_nullable', (SELECT is_nullable='YES' FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='purchase_price')
      AND (SELECT is_nullable='YES' FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='foreign_purchase_price'),
  'enum_contract_ok',
    (SELECT count(*)=3 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='organization_role' AND e.enumlabel IN ('owner','seller','technician'))
    AND (SELECT count(*)=5 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='repair_status' AND e.enumlabel IN ('recibido','diagnostico','reparacion','listo','pausado'))
    AND (SELECT count(*)=2 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='cash_movement_type' AND e.enumlabel IN ('apertura','venta')),
  'required_functions_present', to_regprocedure('public.has_org_permission(uuid,text)') IS NOT NULL
    AND to_regprocedure('public.user_has_branch_access(uuid,uuid)') IS NOT NULL
    AND to_regprocedure('public.guard_product_cost_writes()') IS NOT NULL,
  'collisions', (SELECT to_jsonb(collisions) FROM collisions),
  'existing_open_cash_sessions', (SELECT count(*) FROM public.cash_closures WHERE organization_id=${sqlString(data.organization.id)}::uuid AND status='abierta'),
  'safe_legacy_session_ids', COALESCE((SELECT json_agg(c.id::text) FROM public.cash_closures c
    WHERE c.organization_id=${sqlString(data.organization.id)}::uuid
      AND c.branch_id=${sqlString(data.branches[0].id)}::uuid
      AND c.register_id=${sqlString(data.cash.registers[0].id)}
      AND c.status='abierta' AND c.notes='Prueba sintética local DEV'
      AND (SELECT count(*)=1 AND bool_and(m.type::text IN ('apertura','opening'))
        FROM public.cash_movements m WHERE m.session_id=c.id)), '[]'::json),
  'organization_exists', EXISTS(SELECT 1 FROM public.organizations WHERE id=${sqlString(data.organization.id)}::uuid AND slug=${sqlString(data.organization.slug)})
);
ROLLBACK;`;
}

function runLocalSql(sql) {
  const result = run('docker', [
    'exec', '-i', DATABASE_CONTAINER, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
    '-U', 'postgres', '-d', 'postgres',
  ], sql);
  if (!result.ok) fail('Seed local detenido: la validación SQL falló; no se imprimieron valores ni se continuó.');
  return result.output.trim();
}

function readPreflight() {
  const output = runLocalSql(buildPreflightSql());
  try { return JSON.parse(output); } catch { fail('Seed local detenido: no se pudo interpretar el precheck SQL de solo lectura.'); }
}

function assertPreflight(preflight) {
  const collisionEntries = Object.entries(preflight.collisions ?? {});
  const collisionNames = collisionEntries.filter(([, value]) => value).map(([key]) => key);
  const safeSessions = Array.isArray(preflight.safe_legacy_session_ids) ? preflight.safe_legacy_session_ids.length : 0;
  const unsafeOpenSessions = Number(preflight.existing_open_cash_sessions ?? 0) - safeSessions;
  if (preflight.missing_columns?.length || preflight.missing_rls?.length
    || preflight.cost_columns_nullable !== true || preflight.enum_contract_ok !== true
    || preflight.required_functions_present !== true || collisionNames.length || unsafeOpenSessions > 0) {
    fail(`Seed detenido por precheck: schema/RLS/contrato/identidad no coincide; revisar categorías ${[
      preflight.missing_columns?.length ? 'columns' : '',
      preflight.missing_rls?.length ? 'RLS' : '',
      preflight.enum_contract_ok !== true ? 'enums' : '',
      preflight.required_functions_present !== true ? 'functions' : '',
      preflight.cost_columns_nullable !== true ? 'cost-columns' : '',
      unsafeOpenSessions > 0 ? 'unrecognized-open-cash-session' : '',
      ...collisionNames,
    ].filter(Boolean).join(', ') || 'unknown'}. No se modificó el esquema.`);
  }
}

async function listLocalUsers(admin) {
  const users = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) fail('Seed detenido: no se pudo comprobar Auth del Supabase local.');
    users.push(...data.users);
    if (data.users.length < PAGE_SIZE) return users;
  }
  fail('Seed detenido: Auth local supera el límite seguro de paginación.');
}

async function ensureSyntheticUser(admin, existingUsers, email, fullName) {
  const existing = existingUsers.find((user) => user.email?.toLowerCase() === email);
  const userMetadata = { full_name: fullName, environment: 'local-development', seed: 'mitiendapy-mobile-dev' };
  if (existing) {
    const ownedSyntheticAccount = existing.email?.toLowerCase().endsWith('@dev.example.test')
      && (existing.user_metadata?.environment === 'local-development'
        || existing.user_metadata?.seed === 'mitiendapy-mobile-dev');
    if (!ownedSyntheticAccount) fail('Seed detenido: un email reservado ya pertenece a una cuenta local no marcada como sintética.');
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: (await getLocalEnv()).MOBILE_DEV_TEST_PASSWORD,
      email_confirm: true,
      user_metadata: userMetadata,
    });
    if (error) fail('Seed detenido: no se pudo actualizar una cuenta sintética de Auth local.');
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: (await getLocalEnv()).MOBILE_DEV_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: userMetadata,
  });
  if (error || !data.user) fail('Seed detenido: no se pudo crear una cuenta sintética de Auth local.');
  existingUsers.push(data.user);
  return data.user.id;
}

let cachedEnv;
async function getLocalEnv() {
  if (!cachedEnv) cachedEnv = dotenv.parse(readFileSync(ROOT_ENV_PATH));
  return cachedEnv;
}

async function ensureUsers(config) {
  const admin = createClient(config.app.NEXT_PUBLIC_SUPABASE_URL, config.app.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'mitiendapy-mobile-dev-seed' } },
  });
  const existingUsers = await listLocalUsers(admin);
  const owner = await ensureSyntheticUser(admin, existingUsers, config.emails.owner, 'Administrador Demo');
  const seller = await ensureSyntheticUser(admin, existingUsers, config.emails.seller, 'Vendedor Demo');
  const technician = await ensureSyntheticUser(admin, existingUsers, config.emails.technician, 'Técnico Demo');
  return { owner, seller, technician };
}

async function ensureProductImages(config) {
  const admin = createClient(config.app.NEXT_PUBLIC_SUPABASE_URL, config.app.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'mitiendapy-mobile-dev-seed' } },
  });
  const { data: buckets, error: bucketsError } = await admin.storage.listBuckets();
  if (bucketsError) fail('Seed detenido: no se pudo consultar Storage del Supabase local.');

  const bucket = buckets.find((item) => item.name === PRODUCT_IMAGE_BUCKET);
  if (!bucket) {
    const { error } = await admin.storage.createBucket(PRODUCT_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: '5MB',
      allowedMimeTypes: ['image/png'],
    });
    if (error) fail('Seed detenido: no se pudo crear el bucket local de imágenes de prueba.');
  } else if (!bucket.public) {
    fail('Seed detenido: el bucket local dev-product-images ya existe como privado; no se cambió su visibilidad.');
  }

  const mobileUrl = (() => { try { return new URL(config.mobile.EXPO_PUBLIC_SUPABASE_URL); } catch { return null; } })();
  const publicOrigin = config.mobileLanReady && mobileUrl
    ? mobileUrl.origin
    : new URL(config.app.NEXT_PUBLIC_SUPABASE_URL).origin;
  const baseUrl = `${publicOrigin}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}`;
  const assets = [...new Set(getMobileDevDataset().products.map((product) => product.image_asset))];

  for (const asset of assets) {
    const filePath = join(ROOT, 'scripts', 'dev-fixtures', 'products', asset);
    if (!existsSync(filePath)) fail('Seed detenido: falta una imagen local del dataset de prueba.');
    const { error } = await admin.storage.from(PRODUCT_IMAGE_BUCKET).upload(
      `dev-fixtures/products/${asset}`,
      readFileSync(filePath),
      { contentType: 'image/png', cacheControl: '3600', upsert: true },
    );
    if (error) fail('Seed detenido: no se pudo cargar una imagen en Storage local.');
  }
  return baseUrl;
}

function summaryQuery() {
  const organizationId = getMobileDevDataset().organization.id;
  return `BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
 'organizations',(SELECT count(*) FROM public.organizations WHERE id='${organizationId}'::uuid),
 'branches',(SELECT count(*) FROM public.branches WHERE organization_id='${organizationId}'::uuid),
 'memberships',(SELECT count(*) FROM public.organization_members WHERE organization_id='${organizationId}'::uuid AND status='active'),
 'branch_assignments',(SELECT count(*) FROM public.user_branch_assignments WHERE organization_id='${organizationId}'::uuid AND is_active),
 'products',(SELECT count(*) FROM public.products WHERE organization_id='${organizationId}'::uuid),
 'products_with_images',(SELECT count(*) FROM public.products WHERE organization_id='${organizationId}'::uuid AND image_url LIKE '%/dev-product-images/dev-fixtures/products/%'),
 'public_products',(SELECT count(*) FROM public.products WHERE organization_id='${organizationId}'::uuid AND visibility='public'),
 'public_products_in_stock',(SELECT count(*) FROM public.products WHERE organization_id='${organizationId}'::uuid AND visibility='public' AND stock_quantity>0),
 'hidden_products',(SELECT count(*) FROM public.products WHERE organization_id='${organizationId}'::uuid AND visibility='hidden'),
 'variants',(SELECT count(*) FROM public.product_variants WHERE organization_id='${organizationId}'::uuid),
 'branch_inventory',(SELECT count(*) FROM public.branch_inventory bi JOIN public.products p ON p.id=bi.product_id WHERE p.organization_id='${organizationId}'::uuid),
 'variant_inventory',(SELECT count(*) FROM public.branch_variant_inventory WHERE organization_id='${organizationId}'::uuid),
 'customers',(SELECT count(*) FROM public.customers WHERE organization_id='${organizationId}'::uuid),
 'repairs',(SELECT count(*) FROM public.repairs WHERE organization_id='${organizationId}'::uuid),
 'sales',(SELECT count(*) FROM public.sales WHERE organization_id='${organizationId}'::uuid),
 'sale_items',(SELECT count(*) FROM public.sale_items WHERE organization_id='${organizationId}'::uuid),
 'cash_registers',(SELECT count(*) FROM public.cash_registers WHERE organization_id='${organizationId}'::uuid AND id IN ('a1000000-0000-4000-8000-000000000013','a1000000-0000-4000-8000-000000000014')),
 'cash_sessions',(SELECT count(*) FROM public.cash_closures WHERE organization_id='${organizationId}'::uuid AND id IN ('a1000000-0000-4000-8000-000000000091','a1000000-0000-4000-8000-000000000092')),
 'cash_movements',(SELECT count(*) FROM public.cash_movements WHERE organization_id='${organizationId}'::uuid AND id BETWEEN 'a1000000-0000-4000-8000-000000000109'::uuid AND 'a1000000-0000-4000-8000-000000000122'::uuid),
 'open_seed_sessions',(SELECT count(*) FROM public.cash_closures WHERE organization_id='${organizationId}'::uuid AND id IN ('a1000000-0000-4000-8000-000000000091','a1000000-0000-4000-8000-000000000092') AND status='abierta'),
 'sales_total_matches',(SELECT count(*)=12 FROM public.sales s WHERE s.organization_id='${organizationId}'::uuid AND s.code LIKE 'DEV-SALE-%' AND s.total_amount=s.subtotal_amount),
 'sale_item_totals_match',(SELECT count(*)=0 FROM public.sales s JOIN LATERAL (SELECT COALESCE(sum(si.subtotal),0) AS subtotal FROM public.sale_items si WHERE si.sale_id=s.id) i ON true WHERE s.organization_id='${organizationId}'::uuid AND s.code LIKE 'DEV-SALE-%' AND s.total_amount<>i.subtotal),
 'cost_zero_exists',(SELECT count(*)>0 FROM public.products WHERE organization_id='${organizationId}'::uuid AND sku='DEV-PROD-001' AND purchase_price=0),
 'cost_unknown_exists',(SELECT count(*)>0 FROM public.products WHERE organization_id='${organizationId}'::uuid AND sku='DEV-PROD-002' AND purchase_price IS NULL),
 'public_flags_on',(SELECT marketplace_public=true AND storefront_public=true FROM public.organizations WHERE id='${organizationId}'::uuid)
);
ROLLBACK;`;
}

function readSummary() {
  const output = runLocalSql(summaryQuery());
  try { return JSON.parse(output); } catch { fail('No se pudo verificar el conteo agregado del dataset local.'); }
}

function assertExpectedSummary(summary) {
  const expected = {
    organizations: 1, branches: 2, memberships: 3, branch_assignments: 5,
    products: 30, public_products: 24, public_products_in_stock: 24, hidden_products: 6,
    products_with_images: 30,
    variants: 12, branch_inventory: 60, variant_inventory: 24,
    customers: 10, repairs: 10, sales: 12, sale_items: 24,
    cash_registers: 2, cash_sessions: 2, cash_movements: 14, open_seed_sessions: 0,
    sales_total_matches: true, sale_item_totals_match: true,
    cost_zero_exists: true, cost_unknown_exists: true, public_flags_on: true,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (summary[key] !== value) fail(`Verificación local falló en el agregado ${key}; se detuvo sin rollback automático.`);
  }
}

async function main() {
  const config = localEnvironment();
  const preflight = readPreflight();
  assertPreflight(preflight);
  const plan = getMobileDevDataset();
  if (DRY_RUN) {
    console.log(JSON.stringify({ target: 'LOCAL SUPABASE / 127.0.0.1:55321', schemaRls: 'PASS', collisionCheck: 'PASS', planned: { organizations: 1, branches: 2, products: plan.products.length, variants: plan.variants.length, customers: plan.customers.length, repairs: plan.repairs.length, sales: plan.sales.length, saleItems: plan.saleItems.length }, preexistingOpenSessions: preflight.existing_open_cash_sessions, recognizedSyntheticSessionsToClose: preflight.safe_legacy_session_ids.length, mobileLanReady: config.mobileLanReady, writes: 'NO' }, null, 2));
    return;
  }

  const productImageBaseUrl = await ensureProductImages(config);
  const userIds = await ensureUsers(config);
  const sql = buildSeedSql(
    { ...userIds, legacySmokeSessionIds: preflight.safe_legacy_session_ids },
    { debugStages: process.argv.includes('--debug-stages'), productImageBaseUrl },
  );
  const result = run('docker', [
    'exec', '-i', DATABASE_CONTAINER, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1',
    '-U', 'postgres', '-d', 'postgres',
  ], sql);
  if (!result.ok) {
    const diagnostic = `${result.stderr}\n${result.output}`;
    const postgresError = diagnostic.split(/\r?\n/).find((line) => /^ERROR:/i.test(line.trim()));
    const safeError = postgresError ? postgresError.trim().slice(0, 240) : 'error SQL no clasificado';
    const failedTable = /(?:INSERT\s+INTO|UPDATE)\s+public\.([a-z_]+)/i.exec(diagnostic)?.[1];
    const stages = [...diagnostic.matchAll(/seed-step:\s*([a-z_]+(?:#\d+)?)/gi)];
    const lastStage = stages.at(-1)?.[1];
    fail(`Seed detenido: la transacción local se revirtió${failedTable ? ` en public.${failedTable}` : lastStage ? ` durante ${lastStage}` : ''} (${safeError}). No se aplicó ninguna migración.`);
  }

  const summary = readSummary();
  assertExpectedSummary(summary);
  console.log(JSON.stringify({
    target: 'LOCAL SUPABASE / 127.0.0.1:55321',
    users: 3,
    verifiedCounts: summary,
    mobileLanReady: config.mobileLanReady,
    productionAccessed: false,
    remoteBranchAccessed: false,
    schemaChanged: false,
    rlsChanged: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Seed local falló.');
  process.exitCode = 1;
});
