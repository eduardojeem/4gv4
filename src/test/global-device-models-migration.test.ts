import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEVICE_TYPES } from '@/lib/devices/global-models'

const SQL = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261003120000_global_device_models.sql'), 'utf8')
const leer = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('catálogo global de modelos de equipos', () => {
  it('la tabla acepta los mismos tipos de equipo que la app', () => {
    for (const type of DEVICE_TYPES) expect(SQL).toContain(`'${type}'`)
  })

  it('un modelo por marca sin importar mayúsculas', () => {
    expect(SQL).toContain('on public.global_device_models (lower(brand), lower(model))')
  })

  it('la leen los usuarios con sesión y solo el servidor la escribe', () => {
    expect(SQL).toContain('enable row level security')
    expect(SQL).toContain("for select using (auth.role() = 'authenticated')")
    expect(SQL).toContain('revoke all on public.global_device_models from anon')
    expect(SQL).not.toMatch(/for (insert|update|delete|all)/i)
  })

  it('las sugerencias de la tienda suman el catálogo, salvo para filtrar', () => {
    const route = leer('src/app/api/products/device-options/route.ts')
    expect(route).toContain("from('global_device_models')")
    expect(route).toContain('if (!soloProductos)')
    expect(route).toContain('mergeCatalogIntoOptions(propias')
  })

  it('está en el menú dentro de Catálogos globales', () => {
    const shell = leer('src/components/superadmin/superadmin-shell.tsx')
    const start = shell.indexOf("title: 'Catálogos globales'")
    // Hasta el cierre de sus hijos, sin depender de cuánto ocupa el grupo.
    const group = shell.slice(start, shell.indexOf('],', start))
    expect(group).toContain("href: '/superadmin/device-models'")
  })
})
