import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/categories/route.ts'), 'utf8')
const handler = (method: string) => {
  const start = route.indexOf(`export const ${method} =`)
  const next = route.indexOf('export const ', start + 10)
  return route.slice(start, next === -1 ? undefined : next)
}

describe('alta y edición de categorías', () => {
  it('escribe con la clave de servicio, siempre dentro de la organización', () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect(handler(method)).toContain('const supabase = writeClient()')
    }
    expect(handler('POST')).toContain('organization_id: organization.id')
    expect(handler('PUT')).toContain(".eq('organization_id', organization.id)")
    expect(handler('DELETE')).toContain(".eq('organization_id', organization.id)")
  })

  it('registra el error real de la base y traduce los conocidos', () => {
    expect(handler('POST')).toContain("logger.error(dbError(error, 'POST'))")
    expect(route).toContain("if (code === '23505') return 'Ya existe una categoria con este nombre.'")
    // Antes se perdía el detalle: el registro solo guardaba «Categories API POST error».
    expect(route).not.toContain("logger.error('Categories API POST error', { error })")
  })

  it('compara el nombre tal cual, sin comodines', () => {
    expect(route).toContain(".ilike('name', escapeLike(name))")
  })
})
