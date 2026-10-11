import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const ORG = 'org-propia'
const PAUSADO = '11111111-1111-4111-8111-111111111111'
const AJENO = '22222222-2222-4222-8222-222222222222'

const filas = [
  { id: PAUSADO, organization_id: ORG, image_url: null, images: ['https://cdn/pausado.jpg'], is_active: false },
  { id: AJENO, organization_id: 'otra-tienda', image_url: 'https://cdn/ajeno.jpg', images: [], is_active: true },
]

vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_options: unknown, handler: (request: NextRequest, ctx: { organization: { id: string } }) => unknown) =>
    (request: NextRequest) => handler(request, { organization: { id: ORG } }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const filtros: Array<(row: Record<string, unknown>) => boolean> = []
      const builder = {
        select: () => builder,
        eq: (col: string, value: unknown) => { filtros.push((row) => row[col] === value); return builder },
        in: (col: string, values: unknown[]) => { filtros.push((row) => values.includes(row[col])); return builder },
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: filas.filter((row) => filtros.every((f) => f(row))), error: null }).then(ok),
      }
      return builder
    },
  }),
}))

const { POST } = await import('@/app/api/orders/item-images/route')

const pedir = async (productIds: unknown) => {
  const response = await (POST as unknown as (r: NextRequest) => Promise<Response>)(
    new NextRequest('http://localhost/api/orders/item-images', { method: 'POST', body: JSON.stringify({ productIds }) })
  )
  return { status: response.status, body: await response.json() }
}

describe('fotos de los productos de un pedido', () => {
  it('muestra la de un producto propio aunque esté pausado', async () => {
    const { body } = await pedir([PAUSADO])
    expect(body.images).toEqual({ [PAUSADO]: 'https://cdn/pausado.jpg' })
  })

  it('no responde productos de otra tienda', async () => {
    const { body } = await pedir([AJENO])
    expect(body.images).toEqual({})
  })

  it('rechaza ids que no son UUID', async () => {
    const { status } = await pedir(['x,organization_id.neq.null'])
    expect(status).toBe(400)
  })

  it('el panel ya no usa el endpoint público de favoritos', () => {
    const panel = readFileSync(resolve(process.cwd(), 'src/components/dashboard/orders/OrdersDashboard.tsx'), 'utf8')
    expect(panel).toContain("fetch('/api/orders/item-images'")
    expect(panel).not.toContain('/api/public/favorites/metadata')
  })
})
