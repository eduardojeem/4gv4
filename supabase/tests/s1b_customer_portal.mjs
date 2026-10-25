// S1b: el cliente (rol `customer`) conserva el acceso a SUS datos por el portal y las
// APIs públicas, y no ve los de otros. Web real contra una base AISLADA con 01 y 04.
// Usa la sesión por cookies (@supabase/ssr), igual que el navegador del cliente.
//
//   S1_SUPABASE_URL=http://127.0.0.1:55421 S1_ANON_KEY=... S1_SERVICE_KEY=... \
//   S1_APP_URL=http://localhost:3105 node supabase/tests/s1b_customer_portal.mjs
import { randomBytes, randomUUID } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'

const { S1_SUPABASE_URL: db, S1_ANON_KEY: anon, S1_SERVICE_KEY: service, S1_APP_URL: app } = process.env
const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/
if (!db || !anon || !service || !app || !local.test(db) || !local.test(app)) { console.error('Solo base y web locales (S1_*).'); process.exit(2) }

const run = randomBytes(3).toString('hex')
const svc = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
async function rest(method, path, body, prefer) {
  const r = await fetch(`${db}/rest/v1/${path}`, { method, headers: prefer ? { ...svc, Prefer: prefer } : svc, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

let passed = 0, failed = 0
const check = (name, ok, detail) => { if (ok) { passed++; console.log(`ok   - ${name}`) } else { failed++; console.log(`FAIL - ${name}\n       ${String(detail).slice(0, 300)}`) } }

// ─── Siembra sintética ──────────────────────────────────────────────────────
const email = `s1b-portal-${run}@test.local`
const password = randomBytes(18).toString('base64url')
const created = await (await fetch(`${db}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) })).json()
const userId = created.id
const orgId = randomUUID(), branchId = randomUUID(), slug = `s1b-portal-${run}`
const allModules = ['inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'services', 'orders', 'delivery', 'analytics', 'promotions', 'security']
await rest('POST', 'plans?on_conflict=code', { code: 'ENTERPRISE', name: 'Enterprise (prueba S1)', is_active: true, modules: allModules, limits: { users: 100, products: 100000, branches: 10 } }, 'resolution=merge-duplicates')
await rest('POST', 'organizations', { id: orgId, name: `S1B Portal ${run}`, slug, plan: 'ENTERPRISE', storefront_public: true })
await rest('POST', 'subscriptions', { organization_id: orgId, plan: 'ENTERPRISE', status: 'active', payment_status: 'paid', current_period_ends_at: new Date(Date.now() + 30 * 864e5).toISOString() })
await rest('POST', 'branches', { id: branchId, organization_id: orgId, code: `P${run}`, name: 'Sucursal', slug: `suc-${run}`, is_active: true, is_default: true })
await rest('POST', 'profiles?on_conflict=id', { id: userId, email }, 'resolution=merge-duplicates')
await rest('POST', 'organization_members', { organization_id: orgId, user_id: userId, role: 'customer', status: 'active' })
const ownCustomer = randomUUID(), otherCustomer = randomUUID()
await rest('POST', 'customers', [
  { id: ownCustomer, organization_id: orgId, name: 'Cliente Portal', phone: '0981111111', status: 'activo', profile_id: userId },
  { id: otherCustomer, organization_id: orgId, name: 'Persona Ajena', phone: '0982222222', status: 'activo', profile_id: null },
])
const ownTicket = `P-${run}-OWN`, otherTicket = `P-${run}-OTHER`
const [ownRepair] = await rest('POST', 'repairs', { organization_id: orgId, branch_id: branchId, customer_id: ownCustomer, ticket_number: ownTicket, device_brand: 'MarcaPropia', device_model: 'ModeloPropio', problem_description: 'Pantalla' })
await rest('POST', 'repairs', { organization_id: orgId, branch_id: branchId, customer_id: otherCustomer, ticket_number: otherTicket, device_brand: 'MarcaAjena', device_model: 'ModeloAjeno', problem_description: 'Batería' })

// ─── Sesión del cliente por cookies (como el navegador) ─────────────────────
const jar = new Map()
const ssr = createServerClient(db, anon, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: list => list.forEach(({ name, value }) => jar.set(name, value)) } })
const { error: loginError } = await ssr.auth.signInWithPassword({ email, password })
if (loginError) throw loginError
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join('; ')
const page = async path => { const r = await fetch(`${app}${path}`, { headers: { Cookie: cookie }, redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location') } }
const token = (await ssr.auth.getSession()).data.session.access_token

// ─── Acceso legítimo a lo propio ────────────────────────────────────────────
let r = await page('/marketplace/mis-reparaciones')
check('portal: «mis reparaciones» responde', r.status === 200, `${r.status} ${r.location ?? ''}`)
check('portal: lista la reparación propia', r.text.includes(ownTicket) || r.text.includes('ModeloPropio'), 'no aparece el ticket propio')
check('portal: no lista la reparación ajena', !r.text.includes(otherTicket) && !r.text.includes('ModeloAjeno'), 'aparece una reparación ajena')
r = await page(`/api/public/customer-scope?slug=${slug}`)
check('API customer-scope reconoce al cliente', r.status === 200 && /"success"\s*:\s*true/.test(r.text), `${r.status} ${r.text}`)
r = await page(`/api/public/repairs/${ownTicket}?org=${slug}`)
check('API pública: ve su reparación', r.status === 200 && r.text.includes(ownTicket), `${r.status} ${r.text}`)
r = await page(`/api/public/repairs/${otherTicket}?org=${slug}`)
check('API pública: no ve la reparación ajena', r.status !== 200 || !r.text.includes('ModeloAjeno'), `${r.status} ${r.text}`)
r = await page('/perfil')
check('perfil responde', r.status === 200, `${r.status} ${r.location ?? ''}`)

// ─── La Data API ya no le abre datos ajenos ─────────────────────────────────
const dataApi = async path => { const res = await fetch(`${db}/rest/v1/${path}`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } }); return res.json() }
const others = await dataApi(`customers?select=id&organization_id=eq.${orgId}`)
check('Data API: no lista clientes del comercio', Array.isArray(others) && others.length === 0, JSON.stringify(others))
const payments = await dataApi('repair_payments?select=id')
check('Data API: no lee pagos', Array.isArray(payments) && payments.length === 0, JSON.stringify(payments))
check('dato de control: la reparación propia existe', Boolean(ownRepair?.id), JSON.stringify(ownRepair))

console.log(`\n${passed} ok, ${failed} fallidas`)
process.exit(failed ? 1 : 0)
