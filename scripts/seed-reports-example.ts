import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminSupabase } from '../src/lib/supabase/admin'

async function run() {
  const supabase = createAdminSupabase()
  const uuid = () => crypto.randomUUID()

  const categoryId = uuid()
  const supplierId = uuid()
  let productId = uuid()
  const customerId = uuid()
  const saleId = uuid()

  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

  console.log('Seeding minimal data for reports...')

  const { error: catErr } = await supabase.from('categories').insert({
    id: categoryId,
    name: 'Smartphones',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (catErr) console.warn('Category insert error:', catErr.message)

  const { error: supErr } = await supabase.from('suppliers').insert({
    id: supplierId,
    name: 'Proveedor Demo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active'
  })
  if (supErr) console.warn('Supplier insert error:', supErr.message)

  const { error: prodErr } = await supabase.from('products').insert({
    id: productId,
    sku: 'SKU-DEMO-001',
    name: 'Teléfono Demo X',
    category_id: categoryId,
    supplier_id: supplierId,
    purchase_price: 50000,
    sale_price: 80000,
    stock_quantity: 25,
    min_stock: 5,
    unit_measure: 'unidad',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (prodErr) console.warn('Product insert error:', prodErr.message)
  if (prodErr) {
    const { data: existing, error: fetchErr } = await supabase
      .from('products')
      .select('id')
      .eq('sku', 'SKU-DEMO-001')
      .limit(1)
      .maybeSingle()
    if (!fetchErr && existing?.id) {
      console.log('Using existing product id')
      // override productId with existing
      ;(productId as any) = existing.id
    }
  }

  const { error: custErr } = await supabase.from('customers').insert({
    id: customerId,
    name: 'Cliente Demo',
    email: 'cliente.demo@example.com',
    created_at: twoDaysAgo.toISOString(),
  })
  if (custErr) console.warn('Customer insert error:', custErr.message)

  const { error: saleErr } = await supabase.from('sales').insert({
    id: saleId,
    customer_id: customerId,
    created_by: null,
    code: `SAL-${Date.now()}`,
    subtotal_amount: 160000,
    total_amount: 160000,
    tax_amount: 0,
    discount_amount: 0,
    payment_method: 'efectivo',
    status: 'completada',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (saleErr) console.warn('Sale insert error:', saleErr.message)

  const { error: itemErr } = await supabase.from('sale_items').insert({
    id: uuid(),
    sale_id: saleId,
    product_id: productId,
    quantity: 2,
    unit_price: 80000,
    subtotal: 160000,
    created_at: new Date().toISOString(),
  })
  if (itemErr) console.warn('Sale item insert error:', itemErr.message)

  console.log('✅ Seed completed')
}

run().catch((e) => {
  console.error('Seed error:', e)
  process.exit(1)
})
