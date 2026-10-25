// S1b: verificación POSTERIOR al despliegue de 01 + 04, por la Data API real.
// Usa una cuenta de PRUEBA con rol `customer` (idealmente en un comercio de prueba).
// Solo pide conteos (HEAD + count=exact): nunca descarga ni imprime filas, así que no
// expone datos reales aunque la protección fallara. No escribe nada.
//
//   S1B_SUPABASE_URL=https://<ref>.supabase.co S1B_ANON_KEY=<clave publicable> \
//   S1B_QA_EMAIL=<cuenta customer de prueba> S1B_QA_PASSWORD=<su contraseña> \
//   [S1B_QA_STAFF_EMAIL=... S1B_QA_STAFF_PASSWORD=...] node supabase/tests/s1b_postdeploy_dataapi.mjs
const url = process.env.S1B_SUPABASE_URL
const anon = process.env.S1B_ANON_KEY
if (!url || !anon || !process.env.S1B_QA_EMAIL || !process.env.S1B_QA_PASSWORD) {
  console.error('Faltan S1B_SUPABASE_URL, S1B_ANON_KEY, S1B_QA_EMAIL o S1B_QA_PASSWORD.')
  process.exit(2)
}

async function signIn(email, password) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })
  const body = await r.json()
  if (!r.ok || !body.access_token) throw new Error(`No se pudo iniciar sesión con la cuenta de prueba (${r.status}).`)
  return body.access_token
}

// Solo el conteo: con HEAD la respuesta no trae filas.
async function count(token, table) {
  const r = await fetch(`${url}/rest/v1/${table}?select=id`, {
    method: 'HEAD', headers: { apikey: anon, Authorization: `Bearer ${token}`, Prefer: 'count=exact' },
  })
  const total = r.headers.get('content-range')?.split('/')[1]
  return { status: r.status, total: total === undefined || total === '*' ? null : Number(total) }
}

const exposed = ['customers', 'repair_payments', 'repair_closeouts', 'repair_quality_checks', 'repair_cost_revisions',
  'repair_cost_revision_parts', 'customer_order_item_cost_snapshots', 'repair_status_history']

let failed = 0
const customerToken = await signIn(process.env.S1B_QA_EMAIL, process.env.S1B_QA_PASSWORD)
console.log('Cuenta customer de prueba:')
for (const table of exposed) {
  const { status, total } = await count(customerToken, table)
  const ok = status < 300 && total === 0
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${table}: ${total === null ? `sin conteo (HTTP ${status})` : `${total} fila(s) visibles`}`)
}

if (process.env.S1B_QA_STAFF_EMAIL && process.env.S1B_QA_STAFF_PASSWORD) {
  const staffToken = await signIn(process.env.S1B_QA_STAFF_EMAIL, process.env.S1B_QA_STAFF_PASSWORD)
  console.log('Cuenta de personal de prueba (tiene que seguir leyendo):')
  for (const table of ['customers', 'repair_payments', 'repair_status_history']) {
    const { status, total } = await count(staffToken, table)
    const ok = status < 300 && total !== null
    if (!ok) failed++
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${table}: HTTP ${status}${total === null ? '' : `, ${total} fila(s)`}`)
  }
}

console.log(failed ? `\n${failed} verificación(es) fallida(s)` : '\nTodo PASS')
process.exit(failed ? 1 : 0)
