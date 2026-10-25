// S1: prueba por HTTP (PostgREST real) de la protección de costos.
// Requiere 01, 02 y 03 aplicadas y los datos de s1_rest_seed.sql.
// Solo para una base local aislada o una rama de Supabase: se niega a correr
// contra el proyecto de producción.
//
//   S1_SUPABASE_URL=http://127.0.0.1:55421 S1_ANON_KEY=... S1_JWT_SECRET=... node supabase/tests/s1_rest_smoke.mjs
import { createHmac } from 'node:crypto'

const PRODUCTION_REFS = ['cswtugmwazxdktntndpy']
const url = process.env.S1_SUPABASE_URL
const anonKey = process.env.S1_ANON_KEY
const secret = process.env.S1_JWT_SECRET
if (!url || !anonKey || !secret) {
  console.error('Faltan S1_SUPABASE_URL, S1_ANON_KEY o S1_JWT_SECRET.')
  process.exit(2)
}
if (PRODUCTION_REFS.some(ref => url.includes(ref))) {
  console.error('Se niega a correr contra producción.')
  process.exit(2)
}

const ORG_A = '00000000-0000-4000-8000-00000000030a'
const P_A1 = '00000000-0000-4000-8000-0000000003f1'
const P_B1 = '00000000-0000-4000-8000-0000000003f9'
const users = {
  owner: '00000000-0000-4000-8000-0000000003a1',
  tech: '00000000-0000-4000-8000-0000000003a2',
  techRead: '00000000-0000-4000-8000-0000000003a3',
  manager: '00000000-0000-4000-8000-0000000003a4',
  managerCost: '00000000-0000-4000-8000-0000000003a5',
  adminB: '00000000-0000-4000-8000-0000000003b1',
}

const b64 = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')
function jwt(sub) {
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const payload = b64({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600 })
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

async function call(user, method, path, { body, prefer } = {}) {
  const headers = { apikey: anonKey, Authorization: `Bearer ${user ? jwt(users[user]) : anonKey}`, 'Content-Type': 'application/json' }
  if (prefer) headers.Prefer = prefer
  const response = await fetch(`${url}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await response.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { status: response.status, json }
}

let failures = 0
let passed = 0
function check(name, condition, detail) {
  if (condition) { passed++; console.log(`ok   - ${name}`) }
  else { failures++; console.log(`FAIL - ${name}\n       ${JSON.stringify(detail).slice(0, 300)}`) }
}
const denied = r => r.status >= 400 && (r.json?.code === '42501' || /permission denied/i.test(JSON.stringify(r.json)))

// Lectura directa
for (const user of ['tech', 'owner']) {
  let r = await call(user, 'GET', 'products?select=*')
  check(`${user}: select=* rechazado`, denied(r), r)
  r = await call(user, 'GET', 'products?select=id,purchase_price')
  check(`${user}: select=purchase_price rechazado`, denied(r), r)
  r = await call(user, 'GET', 'products?select=id&order=purchase_price.desc')
  check(`${user}: order=purchase_price rechazado`, denied(r), r)
  r = await call(user, 'GET', 'products?select=id&purchase_price=gt.50')
  check(`${user}: filtro por costo rechazado`, denied(r), r)
  r = await call(user, 'GET', 'products?select=id,name,variants:product_variants(*)')
  check(`${user}: product_variants(*) embebido rechazado`, denied(r), r)
}
let r = await call('tech', 'GET', `products?select=id,name,sale_price,variants:product_variants(id,sale_price)&organization_id=eq.${ORG_A}`)
check('técnico: columnas permitidas → 200 con 2 filas', r.status === 200 && Array.isArray(r.json) && r.json.length === 2, r)
r = await call('tech', 'HEAD', 'products?select=id')
check('técnico: HEAD con select=id (conteo) funciona', r.status === 200 || r.status === 206, r)
r = await call('adminB', 'GET', `products?select=id&id=eq.${P_A1}`)
check('admin de B: no ve el producto de A', r.status === 200 && r.json.length === 0, r)

// RPC de costos
r = await call('tech', 'POST', 'rpc/get_product_costs', { body: { p_product_ids: [P_A1] } })
check('técnico: get_product_costs vacío', r.status === 200 && r.json.length === 0, r)
r = await call('techRead', 'POST', 'rpc/get_product_costs', { body: { p_product_ids: [P_A1] } })
check('con read_cost: get_product_costs devuelve el costo', r.status === 200 && Number(r.json[0]?.purchase_price) === 100, r)
r = await call('owner', 'POST', 'rpc/get_product_costs', { body: { p_product_ids: [P_A1, P_B1] } })
check('dueño de A: solo su costo aunque pida el de B', r.status === 200 && r.json.length === 1 && r.json[0].product_id === P_A1, r)
r = await call(null, 'POST', 'rpc/get_product_costs', { body: {} })
check('anon: get_product_costs rechazado', r.status >= 400, r)

// Vistas y RPC de reportes
r = await call('tech', 'GET', `products_safe?select=id,purchase_price&organization_id=eq.${ORG_A}`)
check('técnico: products_safe con costo null', r.status === 200 && r.json.length === 2 && r.json.every(row => row.purchase_price === null), r)
r = await call('owner', 'GET', `products_safe?select=id,purchase_price&id=eq.${P_A1}`)
check('dueño: products_safe con costo', r.status === 200 && Number(r.json[0]?.purchase_price) === 100, r)
r = await call('tech', 'POST', 'rpc/search_products', { body: {} })
check('técnico: search_products sin costo ni margen', r.status === 200 && r.json.length === 2 && r.json.every(row => row.purchase_price === null && row.profit_margin === null), r)

// Escritura
r = await call('manager', 'PATCH', `products?id=eq.${P_A1}`, { body: { purchase_price: 1 }, prefer: 'return=minimal' })
check('gerente sin update_cost: PATCH del costo no da error (no hay oráculo)…', r.status === 204, r)
r = await call('owner', 'POST', 'rpc/get_product_costs', { body: { p_product_ids: [P_A1] } })
check('… y el costo no cambió', Number(r.json?.[0]?.purchase_price) === 100, r)
r = await call('manager', 'POST', 'products', { body: { organization_id: ORG_A, sku: `HTTP-NEW-${Date.now()}`, name: 'Alta con costo', sale_price: 1, purchase_price: 5 }, prefer: 'return=minimal' })
check('gerente sin update_cost: alta con costo → PRODUCT_COST_FORBIDDEN', r.status >= 400 && JSON.stringify(r.json).includes('PRODUCT_COST_FORBIDDEN'), r)
r = await call('manager', 'PATCH', `products?id=eq.${P_A1}`, { body: { sale_price: 201 }, prefer: 'return=minimal' })
check('gerente: PATCH de precio de venta funciona', r.status === 204, r)
r = await call('manager', 'PATCH', `products?id=eq.${P_A1}&select=*`, { body: { sale_price: 202 }, prefer: 'return=representation' })
check('gerente: PATCH con return=representation y select=* rechazado', denied(r), r)
r = await call('manager', 'PATCH', `products?id=eq.${P_A1}&select=id,sale_price`, { body: { sale_price: 203 }, prefer: 'return=representation' })
check('gerente: PATCH devolviendo columnas permitidas funciona', r.status === 200 && Number(r.json[0]?.sale_price) === 203, r)
r = await call('managerCost', 'PATCH', `products?id=eq.${P_A1}`, { body: { purchase_price: 105 }, prefer: 'return=minimal' })
check('gerente con update_cost: cambia el costo', r.status === 204, r)
r = await call('owner', 'POST', 'rpc/get_product_costs', { body: { p_product_ids: [P_A1] } })
check('el costo cambiado se lee por RPC', Number(r.json?.[0]?.purchase_price) === 105, r)
r = await call('adminB', 'PATCH', `products?id=eq.${P_A1}`, { body: { purchase_price: 999 }, prefer: 'return=minimal' })
r = await call('owner', 'POST', 'rpc/get_product_costs', { body: { p_product_ids: [P_A1] } })
check('admin de B: no cambia el costo de A', Number(r.json?.[0]?.purchase_price) === 105, r)

console.log(`\n${passed} ok, ${failures} fallidas`)
process.exit(failures ? 1 : 0)
