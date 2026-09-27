import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Supabase Preview ejecuta todo supabase/migrations sobre una base vacía.
// Un diagnóstico o un archivo con otro formato de nombre rompe la rama de
// prueba de cualquier PR (ver supabase/MIGRATIONS.md).
const files = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
  .filter((name) => name !== '.gitkeep')

describe('supabase/migrations', () => {
  it('solo contiene migraciones con versión de 14 dígitos', () => {
    const invalid = files.filter((name) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(name))
    expect(invalid).toEqual([])
  })

  it('no repite versiones', () => {
    const versions = files.map((name) => name.slice(0, 14))
    expect(new Set(versions).size).toBe(versions.length)
  })
})
