// @vitest-environment node
// FormData y File nativos de Node: los de jsdom no viajan en un Request de Node 24.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

/**
 * Admin → Sitio web, web y app: la organización la resuelve SIEMPRE el servidor
 * (dueño o administrador de la organización activa) y nunca sale del pedido.
 */

const uploads = vi.hoisted(() => ({ paths: [] as string[] }))
vi.mock('@/lib/api/withAdminAuth', () => ({
  // Lo que deja pasar withAdminAuth: un administrador de la organización A.
  withAdminAuth: (handler: (request: Request, context: unknown) => unknown) => (request: Request) =>
    handler(request, { user: { id: 'user-a', role: 'admin' }, organizationId: 'org-a' }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    storage: {
      from: () => ({
        upload: async (path: string) => { uploads.paths.push(path); return { error: null } },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    },
  }),
}))
vi.mock('@/lib/website/website-media', () => ({
  getWebsiteMediaLibrary: async () => [],
  addWebsiteMediaItem: async () => undefined,
  MAX_WEBSITE_MEDIA_COUNT: 20,
}))
vi.mock('@/lib/images/server-upload-optimizer', () => ({
  optimizeServerImage: async (buffer: Buffer) => ({ buffer, extension: 'webp', mimeType: 'image/webp' }),
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-organization-id': 'org-b' }) }))

import { POST as uploadLogo } from '@/app/api/admin/website/logo/route'
import { productUpdateSchema } from '@/lib/validation/schemas'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8')
function routes(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) routes(path, out)
    else if (name === 'route.ts') out.push(path)
  }
  return out
}

describe('subida de imágenes del sitio', () => {
  it('guarda en la carpeta de la organización resuelta por el servidor, aunque el pedido diga otra', async () => {
    const form = new FormData()
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' }))
    form.append('organization_id', 'org-b')
    const response = await uploadLogo(new Request('http://test/api/admin/website/logo', { method: 'POST', body: form }) as never)
    expect(response.status).toBe(200)
    expect(uploads.paths).toHaveLength(1)
    expect(uploads.paths[0]).toMatch(/^website\/logos\/org-a\/[0-9a-f-]+\.webp$/)
    expect(uploads.paths[0]).not.toContain('org-b')
  })
})

describe('rutas de administración del sitio', () => {
  const files = routes(resolve(ROOT, 'src/app/api/admin/website'))

  it('hay rutas que revisar', () => {
    expect(files.length).toBeGreaterThanOrEqual(8)
  })

  it.each(files.map((file) => [file.slice(ROOT.length + 1).replace(/\\/g, '/'), file]))('%s exige administrador y resuelve la organización en el servidor', (_, file) => {
    const source = readFileSync(file as string, 'utf8')
    // withAdminAuth (dueño/admin) o withTenantAuth con settings.manage (también dueño/admin).
    const tenantGuard = /withTenantAuth\(\{ permission: 'settings\.manage' \}/.test(source)
    expect(/withAdminAuth/.test(source) || tenantGuard).toBe(true)
    if (tenantGuard) expect(source).toMatch(/context\.organization\.id/)
    else if (/organization_id|organizationId/.test(source)) expect(source).toMatch(/resolveWebsiteAdminOrganizationId/)
    // Nunca del cuerpo ni de la URL del pedido.
    expect(source).not.toMatch(/(body|parsed\.data|searchParams|formData)\??\.(get\(['"])?organization_?[iI]d/)
  })

  it('withAdminAuth solo deja pasar a dueño o administrador de la organización activa', () => {
    const source = read('src/lib/api/withAdminAuth.ts')
    expect(source).toMatch(/\['owner', 'admin'\]\.includes\(orgMembership\.role\)/)
    expect(source).toMatch(/\.eq\('status', 'active'\)/)
  })

  it('un x-organization-id ajeno solo lo respeta para superadmin', () => {
    const source = read('src/lib/website/admin-organization.ts')
    expect(source).toMatch(/context\.user\.role === 'super_admin'/)
  })
})

describe('destacados', () => {
  it('la API de productos acepta marcar y desmarcar destacados', () => {
    const parsed = productUpdateSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001', featured: true })
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.featured).toBe(true)
    expect(read('src/app/api/products/[id]/route.ts')).toMatch(/'featured',/)
  })
})

describe('S1: lo que llega al editor del sitio no trae costos', () => {
  it('la configuración del sitio no lee productos ni costos', () => {
    for (const path of ['src/app/api/admin/website/settings/route.ts', 'src/app/api/admin/website/sync-company/route.ts']) {
      const source = read(path)
      expect(source).not.toMatch(/from\('products'\)|purchase_price|cost/i)
    }
  })

  it('la app guarda de cada producto solo campos públicos', () => {
    const source = read('mobile/src/lib/website-model.ts')
    const block = source.slice(source.indexOf('export function toPublicProduct'), source.indexOf('// ─── Apariencia'))
    expect(block).not.toMatch(/purchase|cost|margin/)
  })
})
