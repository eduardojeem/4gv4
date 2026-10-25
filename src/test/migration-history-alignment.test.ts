import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Supabase aplica a producción, al fusionar en main, las migraciones cuyo
 * número no está en su historial. Si una migración se aplica a mano con otro
 * número, al fusionar se volvería a ejecutar. Estas pruebas cuidan que el
 * historial del repo siga alineado con el de producción.
 */
const MIGRATIONS = join(process.cwd(), 'supabase/migrations')
const files = readdirSync(MIGRATIONS).filter((file) => /^\d{14}_.+\.sql$/.test(file))
const nameOf = (file: string) => file.slice(15, -4)

describe('historial de migraciones', () => {
  it('ninguna migración aparece dos veces con números distintos', () => {
    const names = files.map(nameOf)
    const repeated = names.filter((name, index) => names.indexOf(name) !== index)
    expect(repeated).toEqual([])
  })

  it('las migraciones aplicadas a mano en producción usan el número que tienen allá', () => {
    for (const file of [
      '20261021230952_s1_cost_read_functions.sql',
      '20261022011708_s1_cost_column_privileges.sql',
      '20261023121250_allow_cancelled_credit_installments.sql',
      '20261023121531_products_atomic_create_cost_null_and_sku.sql',
      '20261025130103_variant_branch_stock_target_atomic.sql',
    ]) {
      expect(files).toContain(file)
    }
  })

  it('las migraciones de costos S1 son idénticas a los scripts revisados de la etapa', () => {
    const stage = join(process.cwd(), 'supabase/pending-migrations/s1-product-cost')
    expect(readFileSync(join(MIGRATIONS, '20261021230952_s1_cost_read_functions.sql'), 'utf8')).toBe(
      readFileSync(join(stage, '02_cost_read_functions.sql'), 'utf8'),
    )
    expect(readFileSync(join(MIGRATIONS, '20261022011708_s1_cost_column_privileges.sql'), 'utf8')).toBe(
      readFileSync(join(stage, '03_cost_column_privileges.sql'), 'utf8'),
    )
  })
})
