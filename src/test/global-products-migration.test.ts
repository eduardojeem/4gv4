import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SQL = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261004120000_global_products.sql'), 'utf8')
const leer = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('catálogo global de productos por código de barras', () => {
  it('una ficha por código del fabricante; los internos 2xx no entran', () => {
    expect(SQL).toContain('gtin text not null unique')
    expect(SQL).toContain("gtin !~ '^2[0-9]{12}$'")
  })

  it('la leen los usuarios con sesión y solo el servidor la escribe', () => {
    expect(SQL).toContain('enable row level security')
    expect(SQL).toContain("for select using (auth.role() = 'authenticated')")
    expect(SQL).toContain('revoke all on public.global_products from anon')
    expect(SQL).not.toMatch(/for (insert|update|delete|all)/i)
  })

  it('usa las marcas y categorías globales, sin borrar la ficha si se borran', () => {
    expect(SQL).toContain('references public.global_brands(id) on delete set null')
    expect(SQL).toContain('references public.global_categories(id) on delete set null')
  })

  it('la limpieza de fotos cuenta las del catálogo como usadas', () => {
    expect(leer('src/lib/superadmin/storage-cleanup.ts')).toContain("'global_products'")
  })

  it('está en Catálogos globales, antes de Modelos de equipos', () => {
    const shell = leer('src/components/superadmin/superadmin-shell.tsx')
    expect(shell.indexOf("href: '/superadmin/global-products'")).toBeGreaterThan(0)
    expect(shell.indexOf("href: '/superadmin/global-products'")).toBeLessThan(shell.indexOf("href: '/superadmin/device-models'"))
  })
})
