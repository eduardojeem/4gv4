// S1: prueba de punta a punta de las APIs de la web contra una base AISLADA.
// Crea usuarios en el Auth local (contraseñas aleatorias que no se imprimen), siembra
// datos sintéticos con el rol de servicio y llama a las APIs con `Authorization: Bearer`,
// igual que la app móvil. Requiere 01, 02 y 03 aplicadas y la web corriendo contra esa base.
//
//   S1_SUPABASE_URL=http://127.0.0.1:55421 S1_ANON_KEY=... S1_SERVICE_KEY=... \
//   S1_APP_URL=http://localhost:3105 node supabase/tests/s1_api_e2e.mjs
import { randomBytes, randomUUID } from 'node:crypto'

const PRODUCTION_REFS = ['cswtugmwazxdktntndpy']
const { S1_SUPABASE_URL: db, S1_ANON_KEY: anon, S1_SERVICE_KEY: service, S1_APP_URL: app } = process.env
if (!db || !anon || !service || !app) { console.error('Faltan variables S1_*'); process.exit(2) }
if (PRODUCTION_REFS.some(ref => db.includes(ref)) || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(db) || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(app)) {
  console.error('Solo corre contra una base y una web locales.'); process.exit(2)
}

const run = randomBytes(3).toString('hex')
const svc = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
async function rest(method, path, body) {
  const r = await fetch(`${db}/rest/v1/${path}`, { method, headers: svc, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}
async function createUser(label) {
  const email = `s1e2e-${label}-${run}@test.local`
  const password = randomBytes(18).toString('base64url')
  const r = await fetch(`${db}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) })
  const user = await r.json()
  if (!r.ok) throw new Error(`crear usuario ${label}: ${JSON.stringify(user).slice(0, 200)}`)
  const t = await fetch(`${db}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const session = await t.json()
  if (!t.ok) throw new Error(`login ${label}: ${JSON.stringify(session).slice(0, 200)}`)
  return { id: user.id, token: session.access_token }
}

let passed = 0, failed = 0
const check = (name, ok, detail) => { if (ok) { passed++; console.log(`ok   - ${name}`) } else { failed++; console.log(`FAIL - ${name}\n       ${JSON.stringify(detail).slice(0, 400)}`) } }
async function api(user, method, path, body, extraHeaders = {}) {
  const r = await fetch(`${app}${path}`, { method, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json', ...extraHeaders }, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { json = text.slice(0, 300) }
  return { status: r.status, json }
}
const hasCost = value => JSON.stringify(value).includes('"purchase_price"') || JSON.stringify(value).includes('"purchasePrice"')

// ─── Siembra ────────────────────────────────────────────────────────────────
const users = {}
for (const label of ['owner', 'admin', 'tech', 'techRead', 'manager', 'managerCost', 'legacy', 'ownerB', 'multi', 'client']) users[label] = await createUser(label)
const orgA = randomUUID(), orgB = randomUUID(), branchA = randomUUID(), branchB = randomUUID()
// Plan sintético con todos los módulos (en producción la tabla `plans` se cargó fuera de las migraciones).
const allModules = ['inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'services', 'orders', 'delivery', 'analytics', 'promotions', 'security']
await fetch(`${db}/rest/v1/plans?on_conflict=code`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates' },
  body: JSON.stringify({ code: 'ENTERPRISE', name: 'Enterprise (prueba S1)', is_active: true, modules: allModules, limits: { users: 100, products: 100000, branches: 10 } }) })
await rest('POST', 'organizations', [{ id: orgA, name: `S1E2E A ${run}`, slug: `s1e2e-a-${run}`, plan: 'ENTERPRISE' }, { id: orgB, name: `S1E2E B ${run}`, slug: `s1e2e-b-${run}`, plan: 'ENTERPRISE' }])
await rest('POST', 'subscriptions', [orgA, orgB].map(organization_id => ({ organization_id, plan: 'ENTERPRISE', status: 'active', payment_status: 'paid',
  current_period_ends_at: new Date(Date.now() + 30 * 864e5).toISOString() })))
await rest('POST', 'branches', [
  { id: branchA, organization_id: orgA, code: `A${run}`, name: 'Sucursal A', slug: `suc-a-${run}`, is_active: true, is_default: true },
  { id: branchB, organization_id: orgB, code: `B${run}`, name: 'Sucursal B', slug: `suc-b-${run}`, is_active: true, is_default: true },
])
const member = (org, user, role) => ({ organization_id: org, user_id: user.id, role, status: 'active' })
await rest('POST', 'organization_members', [
  member(orgA, users.owner, 'owner'), member(orgA, users.admin, 'admin'), member(orgA, users.tech, 'technician'), member(orgA, users.techRead, 'technician'),
  member(orgA, users.manager, 'manager'), member(orgA, users.managerCost, 'manager'), member(orgA, users.legacy, 'manager'),
  member(orgB, users.ownerB, 'owner'), member(orgA, users.multi, 'technician'), member(orgB, users.multi, 'owner'),
  member(orgA, users.client, 'customer'),
])
// Ficha del cliente vinculada a su usuario, y otra persona del mismo comercio.
await fetch(`${db}/rest/v1/profiles?on_conflict=id`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates' },
  body: JSON.stringify({ id: users.client.id, email: `s1e2e-client-${run}@test.local` }) })
await rest('POST', 'customers', [
  { organization_id: orgA, name: 'Cliente E2E', status: 'activo', phone: '0981888888', profile_id: users.client.id },
  { organization_id: orgA, name: 'Otra persona E2E', status: 'activo', phone: '0981999999', profile_id: null },
])
await rest('POST', 'user_permissions', [
  { user_id: users.techRead.id, organization_id: orgA, permission: 'products.read_cost', is_active: true },
  { user_id: users.managerCost.id, organization_id: orgA, permission: 'products.update_cost', is_active: true },
  { user_id: users.managerCost.id, organization_id: orgA, permission: 'products.read_cost', is_active: true },
  { user_id: users.legacy.id, organization_id: null, permission: 'products.read_cost', is_active: true },
  { user_id: users.legacy.id, organization_id: null, permission: 'products.update_cost', is_active: true },
])
// Sucursal asignada al personal que no es dueño ni administrador (lo exige la RLS de tomas y reparaciones).
await rest('POST', 'user_branch_assignments', ['tech', 'techRead', 'manager', 'managerCost', 'legacy', 'multi'].map(label =>
  ({ user_id: users[label].id, branch_id: branchA, organization_id: orgA, is_active: true, is_primary: true })))
const [pA] = await rest('POST', 'products', { organization_id: orgA, sku: `E2E-A-${run}`, name: 'E2E A', sale_price: 200, purchase_price: 100, stock_quantity: 10, min_stock: 1 })
const [pB] = await rest('POST', 'products', { organization_id: orgB, sku: `E2E-B-${run}`, name: 'E2E B', sale_price: 300, purchase_price: 150, stock_quantity: 5, min_stock: 1 })
const costOf = async id => (await rest('GET', `products?select=purchase_price&id=eq.${id}`))[0]?.purchase_price

// ─── Lectura de productos ───────────────────────────────────────────────────
let r = await api(users.owner, 'GET', `/api/products/${pA.id}`)
check('dueño: GET producto con costo', r.status === 200 && Number(r.json?.data?.purchase_price) === 100, r)
r = await api(users.tech, 'GET', `/api/products/${pA.id}`)
check('técnico: GET producto sin costo', r.status === 200 && !hasCost(r.json?.data), r)
r = await api(users.techRead, 'GET', `/api/products/${pA.id}`)
check('con read_cost: GET producto con costo', r.status === 200 && Number(r.json?.data?.purchase_price) === 100, r)
r = await api(users.legacy, 'GET', `/api/products/${pA.id}`)
check('permiso heredado: GET producto sin costo', r.status === 200 && !hasCost(r.json?.data), r)
r = await api(users.tech, 'GET', '/api/products?per_page=50')
check('técnico: listado sin costos', r.status === 200 && !hasCost(r.json), r)
r = await api(users.owner, 'GET', '/api/products?per_page=50')
check('dueño: listado con costos', r.status === 200 && hasCost(r.json), r)
r = await api(users.ownerB, 'GET', `/api/products/${pA.id}`)
check('dueño de B: no ve el producto de A', r.status === 404 || r.status === 403, r)
r = await api(users.tech, 'GET', '/api/products/access')
check('técnico: /api/products/access sin permiso', r.status === 200 && r.json?.canReadCost === false, r)

// ─── Escritura de productos ─────────────────────────────────────────────────
r = await api(users.manager, 'PUT', `/api/products/${pA.id}`, { sale_price: 210 })
check('gerente sin permiso: cambia el precio de venta', r.status === 200, r)
check('… y el costo sigue igual', Number(await costOf(pA.id)) === 100, null)
r = await api(users.manager, 'PUT', `/api/products/${pA.id}`, { purchase_price: 1 })
check('gerente sin permiso: cambiar el costo → 403', r.status === 403 && r.json?.code === 'PRODUCT_COST_FORBIDDEN', r)
r = await api(users.legacy, 'PUT', `/api/products/${pA.id}`, { purchase_price: 2 })
check('permiso heredado: cambiar el costo → 403', r.status === 403, r)
check('… el costo no cambió', Number(await costOf(pA.id)) === 100, null)
r = await api(users.managerCost, 'PUT', `/api/products/${pA.id}`, { purchase_price: 120 })
check('gerente con update_cost: cambia el costo', r.status === 200 && Number(r.json?.data?.purchase_price) === 120, r)
check('… guardado en la base', Number(await costOf(pA.id)) === 120, null)
r = await api(users.owner, 'POST', '/api/products', { name: `Alta dueño ${run}`, sku: `E2E-N-${run}`, sale_price: 50, purchase_price: 30, stock_quantity: 1, min_stock: 0, unit_measure: 'unidad', is_active: true })
check('dueño: alta con costo → 201 con costo', r.status === 201 && Number(r.json?.data?.purchase_price) === 30, r)
const created = r.json?.data
r = await api(users.manager, 'POST', '/api/products', { name: `Alta gerente ${run}`, sku: `E2E-M-${run}`, sale_price: 50, stock_quantity: 1, min_stock: 0, unit_measure: 'unidad', is_active: true })
check('gerente sin permiso: alta sin costo → 201 sin costo', r.status === 201 && !hasCost(r.json?.data), r)
r = await api(users.manager, 'POST', '/api/products', { name: `Alta gerente 2 ${run}`, sku: `E2E-M2-${run}`, sale_price: 50, purchase_price: 9, stock_quantity: 1, unit_measure: 'unidad', is_active: true })
check('gerente sin permiso: alta con costo → 403', r.status === 403, r)
if (created?.id) {
  r = await api(users.owner, 'PUT', '/api/products', { id: created.id, name: `Alta dueño ${run}`, sku: `E2E-N-${run}`, sale_price: 55, stock_quantity: 1, min_stock: 0, unit_measure: 'unidad', is_active: true })
  check('dueño: PUT /api/products (edición completa) conserva el costo', r.status === 200 && Number(await costOf(created.id)) === 30, r)
}

// ─── Variantes ──────────────────────────────────────────────────────────────
r = await api(users.owner, 'POST', '/api/variants', { product_id: pA.id, name: 'Rojo', sku: `E2E-V-${run}`, price: 220, cost_price: 110, stock: 2, attributes: { color: 'rojo' } })
check('dueño: alta de variante', r.status === 201 || r.status === 200, r)
r = await api(users.owner, 'GET', `/api/variants?product_id=${pA.id}`)
check('dueño: variantes con costo', r.status === 200 && JSON.stringify(r.json).match(/"cost(_price|Price)?":\s*1\d\d/) !== null, r)
r = await api(users.tech, 'GET', `/api/variants?product_id=${pA.id}`)
check('técnico: variantes sin costo', r.status === 200 && !/"cost(_price|Price)?":\s*[1-9]/.test(JSON.stringify(r.json)), r)

// ─── Inventario, estadísticas y reparaciones ────────────────────────────────
r = await api(users.tech, 'GET', '/api/inventory/stats')
check('técnico: estadísticas de inventario sin valor al costo', r.status === 200 && !/stockCostValue|weightedMargin/.test(JSON.stringify(r.json)), r)
r = await api(users.owner, 'GET', '/api/inventory/stats')
check('dueño: estadísticas de inventario', r.status === 200, r)
r = await api(users.manager, 'POST', '/api/inventory-counts', { branch_id: branchA, name: `Toma ${run}` })
check('gerente sin permiso: abre una toma', r.status === 201 || r.status === 200, r)
const countId = r.json?.count?.id
if (countId) {
  const items = await rest('GET', `inventory_count_items?select=product_id,unit_cost&count_id=eq.${countId}&product_id=eq.${pA.id}`)
  check('la toma conserva el costo de la variante seleccionada', Number(items[0]?.unit_cost) === 110, {rows:items.length, knownCost:items[0]?.unit_cost !== null})
  r = await api(users.manager, 'GET', `/api/inventory-counts/${countId}`)
  check('… y no se lo muestra', r.status === 200 && !/unit_cost/.test(JSON.stringify(r.json)), r)
}
r = await api(users.tech, 'GET', `/api/repairs/inventory/search?q=E2E`)
check('técnico: búsqueda de repuestos sin costo', r.status === 200 && !/"unitCost":\s*\d/.test(JSON.stringify(r.json)), r)
r = await api(users.owner, 'GET', `/api/repairs/inventory/search?q=E2E`)
check('dueño: búsqueda de repuestos con costo', r.status === 200 && /"unitCost":\s*\d/.test(JSON.stringify(r.json)), r)

// ─── Usuario en dos organizaciones ──────────────────────────────────────────
// El proxy descarta x-organization-id del cliente; la organización activa viaja en la cookie.
r = await api(users.multi, 'GET', `/api/products/${pA.id}`, null, { Cookie: `active_organization_id=${orgA}` })
check('dos organizaciones: en A (técnico) no ve el costo', r.status === 200 && !hasCost(r.json?.data), r)
r = await api(users.multi, 'GET', `/api/products/${pB.id}`, null, { Cookie: `active_organization_id=${orgB}` })
check('dos organizaciones: en B (dueño) ve el costo', r.status === 200 && Number(r.json?.data?.purchase_price) === 150, r)

// ─── App móvil (mismas APIs con Bearer) ─────────────────────────────────────
r = await api(users.tech, 'GET', '/api/mobile/dashboard')
check('móvil: panel del técnico responde sin costos', r.status === 200 && !/purchase_price|stockCostValue/.test(JSON.stringify(r.json)), r)

// ─── Rol customer (S1b) ─────────────────────────────────────────────────────
r = await api(users.client, 'GET', '/api/products?per_page=5')
check('customer: las APIs del personal no lo aceptan', r.status === 403, r)
async function dataApi(user, path) {
  const res = await fetch(`${db}/rest/v1/${path}`, { headers: { apikey: anon, Authorization: `Bearer ${user.token}` } })
  return { status: res.status, json: await res.json().catch(() => null) }
}
r = await dataApi(users.client, `customers?select=id,name,phone&organization_id=eq.${orgA}`)
check('customer: Data API no lista la cartera de clientes', r.status === 200 && Array.isArray(r.json) && r.json.length === 0, r)
r = await dataApi(users.client, 'repair_cost_revisions?select=id,parts_internal_cost')
check('customer: Data API no lee revisiones de costo', r.status === 200 && Array.isArray(r.json) && r.json.length === 0, r)
r = await dataApi(users.tech, `customers?select=id&organization_id=eq.${orgA}`)
check('técnico: Data API sigue leyendo clientes', r.status === 200 && Array.isArray(r.json) && r.json.length === 2, r)


// Post-03: real session selectors, POS nullable RPC, reports and repair redaction.
for (const [org, product, visible] of [[orgB,pB,true],[orgA,pA,false],[orgB,pB,true]]) {
  const selected = await api(users.multi,'GET','/api/products/'+product.id,null,{'x-organization-id':org});
  check('mobile multi-org explicit selector / visible='+visible, selected.status===200 && (visible ? Number(selected.json?.data?.purchase_price)===150 : !hasCost(selected.json?.data)), {status:selected.status});
}
r=await api(users.multi,'GET','/api/products/'+pB.id,null,{'x-organization-id':orgA});
check('selected A cannot read product B',r.status===404||r.status===403,{status:r.status});
r=await api(users.admin,'GET','/api/products/'+pA.id,null,{'x-organization-id':orgA});
check('admin org A reads cost',r.status===200 && hasCost(r.json?.data),{status:r.status});
async function rpc(user,name,args,org=orgA) {
  const res=await fetch(db+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+user.token,'Content-Type':'application/json','x-organization-id':org},body:JSON.stringify(args)});
  return {status:res.status,json:await res.json().catch(()=>null)};
}
for(const [label,visible] of [['owner',true],['admin',true],['manager',false]]){
  const args={p_organization_id:orgA,p_branch_id:branchA,p_from:new Date(Date.now()-864e5).toISOString(),p_to:new Date().toISOString()};
  const pos=await rpc(users[label],'dashboard_pos_summary_s1',args);
  check(label+': nullable POS contract',pos.status===200 && pos.json.costHidden===!visible && (visible ? pos.json.totalCost===0 : pos.json.totalCost===null && pos.json.repairStats.netProfit===null && pos.json.repairStats.deliveredLaborCost===null),{status:pos.status});
  const report=await dataApi(users[label],'products_detailed?select=id,purchase_price,profit_margin_percentage');
  check(label+': post03 reports',report.status===200 && Array.isArray(report.json) && report.json.every(x=>visible || x.purchase_price===null && x.profit_margin_percentage===null),{status:report.status});
}
const [syntheticCustomer]=await rest('GET','customers?select=id&organization_id=eq.'+orgA+'&limit=1');
const [repair]=await rest('POST','repairs',{organization_id:orgA,branch_id:branchA,customer_id:syntheticCustomer.id,device_brand:'Synthetic',device_model:'Test',problem_description:'S1 isolated validation',parts_cost:40,labor_cost:20});
await rest('POST','repair_parts',{repair_id:repair.id,part_name:'Synthetic manual part',unit_cost:40,unit_price:60,quantity:1});
for(const label of ['owner','tech']) {
  const detail=await api(users[label],'GET','/api/repairs?search=S1%20isolated%20validation&pageSize=100',null,{'x-organization-id':orgA,'x-branch-id':branchA});
  const repairRow=(detail.json?.repairs??[]).find(x=>x.id===repair.id);
  const hasInternal=(node)=>node&&typeof node==='object'&&(Array.isArray(node)?node.some(hasInternal):Object.entries(node).some(([key,value])=>['parts_cost','unit_cost','internalCost','parts_internal_cost','purchase_price'].includes(key)&&value!==null&&value!==undefined||hasInternal(value)));
  const internal=repairRow&&hasInternal(repairRow);
  check(label+': repair list authorization',detail.status===200 && Boolean(repairRow) && (label==='owner'?internal:!internal),{status:detail.status,found:Boolean(repairRow)});
  const history=await api(users[label],'GET','/api/repairs/'+repair.id+'/costs',null,{'x-organization-id':orgA,'x-branch-id':branchA});
  check(label+': repair costs API post03',history.status===200 && (label==='owner'||history.json?.costHidden===true),{status:history.status});
}
const hiddenZero=await rest('POST','products',{organization_id:orgA,sku:'E2E-ZERO-'+run,name:'Zero cost',sale_price:20,purchase_price:0,stock_quantity:1});
const zero=await rpc(users.owner,'get_product_costs',{p_product_ids:[hiddenZero[0].id],p_organization_id:orgA});
check('real cost zero retained by RPC',zero.status===200 && zero.json?.length===1 && zero.json[0]?.purchase_price===0,{status:zero.status,hasRow:zero.json?.length===1,knownZero:zero.json?.[0]?.purchase_price===0});
const wrongScope=await rpc(users.multi,'dashboard_pos_summary_s1',{p_organization_id:orgB,p_branch_id:branchB,p_from:new Date(Date.now()-864e5).toISOString(),p_to:new Date().toISOString()},orgA);
check('POS rejects header/argument organization mismatch',wrongScope.status===403,{status:wrongScope.status});
const noCost=await rpc(users.manager,'get_product_costs',{p_product_ids:[hiddenZero[0].id],p_organization_id:orgA});
check('zero is not exposed without read_cost',noCost.status===200 && noCost.json.length===0,{status:noCost.status});

console.log(`\n${passed} ok, ${failed} fallidas`)
process.exit(failed ? 1 : 0)
