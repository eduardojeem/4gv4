import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })

const organizationId = '62c07291-a593-4add-8232-4b4d2775484b'
const branchId = '25b2bcf7-8f59-4df7-bdd8-f17aa64f964c'
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!baseUrl || !serviceKey) throw new Error('Faltan las variables de Supabase en .env.local.')

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(`${response.status}: ${body?.message || body?.hint || 'Error de Supabase'}`)
  return body
}

async function upsert(table, rows, conflict) {
  return request(`${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  })
}

const categoryName = 'Ropa deportiva (Demo)'
let [category] = await request(`categories?organization_id=eq.${organizationId}&name=eq.${encodeURIComponent(categoryName)}&select=id&limit=1`)
if (!category) {
  ;[category] = await request('categories', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ organization_id: organizationId, name: categoryName, description: 'Productos de demostración con talles y colores.', is_active: true }),
  })
}

const products = [
  {
    id: 'd3000000-0000-4000-8000-000000000001', organization_id: organizationId,
    sku: 'DEMO-REMERA-CLASICA', name: 'Remera clásica Essential (Demo)',
    description: 'Remera unisex de algodón. Elegí talle y color; cada combinación administra su propio stock.',
    category_id: category.id, brand: 'Demo Wear', purchase_price: 45000, sale_price: 85000,
    wholesale_price: 72000, stock_quantity: 24, min_stock: 2, unit_measure: 'unidad',
    image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
    images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'],
    is_active: true, featured: true, visibility: 'public', has_variants: true,
    variant_attribute_config: [
      { key: 'size', label: 'Talle', control: 'select', options: ['S', 'M', 'L', 'XL'] },
      { key: 'color', label: 'Color', control: 'color', options: ['Negro', 'Blanco'] },
    ],
  },
  {
    id: 'd3000000-0000-4000-8000-000000000002', organization_id: organizationId,
    sku: 'DEMO-REMERA-SPORT', name: 'Remera deportiva Dry-Fit Pro (Demo)',
    description: 'Remera deportiva liviana y respirable. El precio y stock corresponden a la combinación elegida.',
    category_id: category.id, brand: 'Demo Sport', purchase_price: 65000, sale_price: 125000,
    wholesale_price: 108000, stock_quantity: 30, min_stock: 2, unit_measure: 'unidad',
    image_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=80',
    images: ['https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=80'],
    is_active: true, featured: true, visibility: 'public', has_variants: true,
    variant_attribute_config: [
      { key: 'size', label: 'Talle', control: 'select', options: ['XS', 'S', 'M', 'L', 'XL'] },
      { key: 'color', label: 'Color', control: 'color', options: ['Negro', 'Blanco', 'Azul'] },
    ],
  },
]

await upsert('products', products, 'id')

const definitions = [
  { product: products[0], sizes: ['S', 'M', 'L', 'XL'], colors: ['Negro', 'Blanco'], prefix: 'DEM-REM', stock: 3 },
  { product: products[1], sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: ['Negro', 'Blanco', 'Azul'], prefix: 'DEM-SPT', stock: 2 },
]
const variants = []
let sequence = 1
for (const definition of definitions) {
  for (const size of definition.sizes) for (const color of definition.colors) {
    variants.push({
      id: `d4000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
      organization_id: organizationId, product_id: definition.product.id,
      variant_name: `${size} / ${color}`, attributes: { size, color },
      sku: `${definition.prefix}-${size}-${color.slice(0, 3).toUpperCase()}`,
      purchase_price: definition.product.purchase_price,
      sale_price: definition.product.sale_price + (size === 'XL' ? 5000 : 0),
      wholesale_price: definition.product.wholesale_price,
      stock_quantity: definition.stock, min_stock: 1, is_active: true,
    })
    sequence += 1
  }
}
await upsert('product_variants', variants, 'id')
await upsert('branch_variant_inventory', variants.map((variant) => ({
  organization_id: organizationId, branch_id: branchId, product_id: variant.product_id,
  variant_id: variant.id, stock_quantity: variant.stock_quantity, reserved_quantity: 0, min_stock: variant.min_stock,
})), 'branch_id,variant_id')

console.log(`Datos demo listos: ${products.length} productos y ${variants.length} variantes en /4g-celulares/productos.`)
