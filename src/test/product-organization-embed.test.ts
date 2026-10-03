import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUCT_ORGANIZATION } from '@/lib/supabase/embeds'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * `agenda_services` une productos y organizaciones: PostgREST ve dos caminos
 * y un `organizations(...)` embebido desde productos responde PGRST201. El
 * marketplace mostraba 0 productos y ninguna categoría (y el bot de Telegram
 * no encontraba nada) porque el error se tomaba como «sin resultados».
 */
describe('productos con su empresa, sin relación ambigua', () => {
  it('la clave foránea nombrada existe y es la de products → organizations', () => {
    const baseline = leer('supabase/migrations/20260927000000_baseline_schema.sql')
    const fk = PRODUCT_ORGANIZATION.split('!')[1]
    expect(baseline).toMatch(new RegExp(`CONSTRAINT "${fk}" FOREIGN KEY \\("organization_id"\\) REFERENCES "public"\\."organizations"`))
  })

  it('el marketplace y el bot nombran la relación al pedir la empresa del producto', () => {
    for (const ruta of ['src/lib/public/marketplace.ts', 'src/lib/telegram/catalog.ts']) {
      const fuente = leer(ruta)
      expect(fuente, ruta).toContain('PRODUCT_ORGANIZATION')
      expect(fuente, ruta).not.toMatch(/[\s,'`]organizations!inner\(/)
    }
  })

  it('agenda_services sigue siendo la tabla que crea el segundo camino', () => {
    // Si algún día deja de serlo, se puede revisar si hace falta nombrar la relación.
    const agenda = leer('supabase/migrations/20261009120000_agenda_appointments.sql')
    expect(agenda).toContain('primary key (organization_id, product_id)')
  })
})
