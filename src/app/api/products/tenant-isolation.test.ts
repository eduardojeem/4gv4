import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const collection = readFileSync(resolve(process.cwd(), 'src/app/api/products/route.ts'), 'utf8')
const item = readFileSync(resolve(process.cwd(), 'src/app/api/products/[id]/route.ts'), 'utf8')

describe('products API tenant isolation contract', () => {
  it('scopes collection reads and server-owned inserts', () => {
    expect(collection).toContain(".eq('organization_id', organization.id)")
    expect(collection).toContain('organization_id: organization.id')
  })

  it('combines product id with the active organization for item operations', () => {
    const guardedReads = item.match(/\.eq\('organization_id', organization\.id\)/g) ?? []
    expect(guardedReads.length).toBeGreaterThanOrEqual(4)
  })

  // El chequeo de "¿este producto tiene transacciones?" antes de borrarlo
  // consultaba 'order_items' y 'repair_item_costs', que no existen en la
  // base -las tablas reales son 'customer_order_items' y
  // 'repair_cost_revision_parts'-. Supabase-js no tira excepcion por una
  // relacion inexistente: la consulta resuelve con count=null, que el
  // codigo convierte en 0 con `?? 0`. Resultado: un producto con pedidos
  // activos se podia borrar igual, porque el chequeo de seguridad nunca
  // detectaba el pedido -consultaba la tabla equivocada-, dejando ese
  // pedido con un product_id que ya no existe.
  it('checks for existing customer orders and repair cost revisions using tables that actually exist', () => {
    expect(collection).not.toContain("from('order_items')")
    expect(collection).not.toContain("from('repair_item_costs')")
    expect(collection).toContain("from('customer_order_items')")
    expect(collection).toContain("from('repair_cost_revision_parts')")
  })

  // Mismo problema en la limpieza posterior al borrado: 'cart_items' no
  // existe, la tabla real es 'customer_cart_items'.
  it('cleans up cart references using the real cart items table', () => {
    expect(collection).not.toContain("from('cart_items')")
    expect(collection).toContain("from('customer_cart_items')")
  })
})
