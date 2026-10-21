import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  PRODUCT_CLIENT_COLUMNS,
  PRODUCT_CLIENT_COLUMN_LIST,
  VARIANT_CLIENT_COLUMNS,
  VARIANT_CLIENT_COLUMN_LIST,
  attachProductCost,
  attachProductCosts,
  fetchProductCosts,
  fillEmbeddedProductCosts,
  type CostRpcClient,
} from './cost-columns'

const ROOT = process.cwd()
const MIGRATION = join(ROOT, 'supabase/pending-migrations/s1-product-cost/03_cost_column_privileges.sql')

function grantedColumns(sql: string, table: string): string[] {
  const match = sql.match(new RegExp(`grant select \\(([^)]*)\\) on table public\\.${table} to`, 'i'))
  if (!match) throw new Error(`No hay GRANT de columnas para ${table}`)
  return match[1].split(',').map(column => column.trim()).filter(Boolean)
}

function rpcClient(rows: Record<string, unknown[]>, error: { message: string } | null = null) {
  const rpc = vi.fn(async (fn: string, args?: Record<string, unknown>) => {
    if (error) return { data: null, error }
    const ids = (args?.p_product_ids ?? args?.p_variant_ids ?? []) as string[]
    const key = fn === 'get_product_costs' ? 'product_id' : 'variant_id'
    return { data: (rows[fn] ?? []).filter(row => ids.includes(String((row as Record<string, unknown>)[key]))), error: null }
  })
  return { client: { rpc } as unknown as CostRpcClient, rpc }
}

describe('columnas que la sesión del usuario puede leer', () => {
  it('el literal coincide con la lista y ninguna incluye el costo', () => {
    expect(PRODUCT_CLIENT_COLUMNS).toBe(PRODUCT_CLIENT_COLUMN_LIST.join(', '))
    expect(VARIANT_CLIENT_COLUMNS).toBe(VARIANT_CLIENT_COLUMN_LIST.join(', '))
    expect(PRODUCT_CLIENT_COLUMN_LIST).not.toContain('purchase_price')
    expect(PRODUCT_CLIENT_COLUMN_LIST).not.toContain('foreign_purchase_price')
    expect(VARIANT_CLIENT_COLUMN_LIST).not.toContain('purchase_price')
  })

  it('coincide exactamente con el GRANT de la migración 03', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(grantedColumns(sql, 'products')).toEqual([...PRODUCT_CLIENT_COLUMN_LIST])
    expect(grantedColumns(sql, 'product_variants')).toEqual([...VARIANT_CLIENT_COLUMN_LIST])
  })
})

describe('attachProductCosts', () => {
  it('agrega el costo visible y deja null el que no vuelve (sin permiso o de otra organización)', async () => {
    const { client, rpc } = rpcClient({ get_product_costs: [{ product_id: 'a', purchase_price: '100.50', foreign_purchase_price: null }] })
    const rows = await attachProductCosts(client, [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { organizationId: 'org' })
    expect(rows).toEqual([
      { id: 'a', name: 'A', purchase_price: 100.5, foreign_purchase_price: null },
      { id: 'b', name: 'B', purchase_price: null, foreign_purchase_price: null },
    ])
    expect(rpc).toHaveBeenCalledWith('get_product_costs', { p_product_ids: ['a', 'b'], p_organization_id: 'org' })
  })

  it('no inventa un 0: sin costo visible queda null', async () => {
    const { client } = rpcClient({})
    const [row] = await attachProductCosts(client, [{ id: 'a', purchase_price: 999 }])
    expect(row.purchase_price).toBeNull()
  })

  it('completa el costo de las variantes anidadas', async () => {
    const { client } = rpcClient({
      get_product_costs: [{ product_id: 'p', purchase_price: 10, foreign_purchase_price: null }],
      get_variant_costs: [{ variant_id: 'v1', purchase_price: 4 }],
    })
    const row = await attachProductCost(client, { id: 'p', variants: [{ id: 'v1' }, { id: 'v2' }] }, { variantsKey: 'variants' })
    expect(row.variants).toEqual([{ id: 'v1', purchase_price: 4 }, { id: 'v2', purchase_price: null }])
  })

  it('si la consulta de costos falla, la pantalla sigue con el costo en null', async () => {
    const { client } = rpcClient({}, { message: 'boom' })
    const [row] = await attachProductCosts(client, [{ id: 'a' }])
    expect(row.purchase_price).toBeNull()
    await expect(attachProductCosts(client, [{ id: 'a' }], { failSoft: false })).rejects.toThrow('boom')
  })

  it('divide pedidos grandes (la RPC acepta hasta 2000 ids)', async () => {
    const { client, rpc } = rpcClient({})
    await fetchProductCosts(client, Array.from({ length: 2500 }, (_, i) => `id-${i}`))
    expect(rpc).toHaveBeenCalledTimes(3)
  })

  it('sin ids no consulta', async () => {
    const { client, rpc } = rpcClient({})
    expect(await attachProductCosts(client, [])).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('fillEmbeddedProductCosts', () => {
  it('completa productos embebidos en el lugar', async () => {
    const { client } = rpcClient({ get_product_costs: [{ product_id: 'a', purchase_price: 7, foreign_purchase_price: 1 }] })
    const items = [{ product: { id: 'a', name: 'A' } }, { product: { id: 'x' } }, { product: null }]
    await fillEmbeddedProductCosts(client, items.map(item => item.product))
    expect(items[0].product).toEqual({ id: 'a', name: 'A', purchase_price: 7, foreign_purchase_price: 1 })
    expect(items[1].product).toEqual({ id: 'x', purchase_price: null, foreign_purchase_price: null })
  })
})

// Regresión: el navegador habla con la base con la sesión del usuario. Desde S1
// Etapa 2b no puede leer el costo de products/product_variants, así que ningún
// archivo que use el cliente del navegador puede pedir `*` ni las columnas de costo.
describe('consultas del navegador sobre productos', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path, out)
      else if (/\.(ts|tsx)$/.test(name) && !/\.(test|stories)\./.test(name)) out.push(path)
    }
    return out
  }
  const browserFiles = walk(join(ROOT, 'src')).filter(path => {
    const source = readFileSync(path, 'utf8')
    return /from ['"]@\/lib\/supabase\/client['"]/.test(source) && !/createAdminSupabase/.test(source)
  })

  it('hay archivos que revisar', () => {
    expect(browserFiles.length).toBeGreaterThan(20)
  })

  it.each(browserFiles.map(path => [path.slice(ROOT.length + 1).replace(/\\/g, '/'), path]))('%s no pide costo ni * de productos', (_, path) => {
    const source = readFileSync(path as string, 'utf8')
    const offenders: string[] = []
    const query = /\.from\(\s*['"](products|product_variants)['"]\s*\)([\s\S]{0,600})/g
    for (const match of source.matchAll(query)) {
      const select = match[2].match(/\.select\(\s*(`[^`]*`|'[^']*'|"[^"]*")/)
      if (!select) continue
      const columns = select[1]
      if (/^[`'"]\s*\*/.test(columns) || /purchase_price/.test(columns)) offenders.push(`${match[1]}: ${columns.slice(0, 80)}`)
    }
    for (const match of source.matchAll(/\b(products|product_variants)(![a-z_]+)?\s*\(\s*(\*|[^)]*purchase_price)/g)) {
      offenders.push(`embebido ${match[0].slice(0, 80)}`)
    }
    expect(offenders).toEqual([])
  })
})
