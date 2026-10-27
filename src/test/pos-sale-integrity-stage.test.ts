import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Etapa SQL pendiente del POS (variantes, IVA por producto, costo histórico).
 * Vive fuera de supabase/migrations para que no se aplique sola al fusionar.
 * Parchea las funciones vigentes por texto: si un bloque esperado no coincide
 * con producción, aborta. Estas pruebas cuidan que los bloques salgan
 * literalmente de lo que hoy define la base.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')
const STAGE = 'supabase/pending-migrations/pos-sale-integrity'
const BASELINE = read('supabase/migrations/20260927000000_baseline_schema.sql')
const S1_READS = read('supabase/migrations/20261021230952_s1_cost_read_functions.sql')
const M01 = read(`${STAGE}/01_pos_variant_lines_and_product_tax.sql`)
const M02 = read(`${STAGE}/02_variant_cost_snapshot.sql`)
const M03 = read(`${STAGE}/03_dashboard_net_and_historical_cost.sql`)
const blocks = (sql: string, tag: 'old' | 'new') =>
  [...sql.matchAll(new RegExp(`${tag}_block := \\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$;`, 'g'))].map(match => match[1])

describe('etapa SQL pos-sale-integrity', () => {
  it('no está en supabase/migrations: no se aplica sola al fusionar', () => {
    const applied = readdirSync(join(process.cwd(), 'supabase/migrations'))
    expect(applied.some(file => /variant_lines_and_product_tax|historical_cost|variant_cost_snapshot/.test(file))).toBe(false)
    expect(existsSync(join(process.cwd(), STAGE, 'README.md'))).toBe(true)
  })

  it('cada bloque que reemplaza en v2 existe tal cual en la definición vigente', () => {
    const olds = blocks(M01, 'old')
    expect(olds).toHaveLength(2)
    for (const block of olds) expect(BASELINE).toContain(block)
    expect(BASELINE).toContain('  tax_amount numeric := 0;')
  })

  it('v5 deja de borrar líneas con snapshot de costo y comisión', () => {
    const v5 = M01.slice(M01.indexOf('create or replace function public.process_pos_sale_atomic_v5'))
    expect(v5).not.toMatch(/delete from public\.sale_items/i)
    expect(v5).not.toMatch(/insert into public\.sale_items/i)
    expect(v5).toContain('adjust_variant_stock_atomic')
    // Y v2 inserta una línea por variante con sus datos.
    expect(blocks(M01, 'new').join('\n')).toContain('group by (value->>\'product_id\')::uuid, nullif(value->>\'variant_id\', \'\')::uuid')
  })

  it('en mayorista la variante sin precio propio hereda el del producto', () => {
    expect(M01).toContain('coalesce(nullif(v.wholesale_price,0), parent_price)')
  })

  it('el IVA usa la tasa de cada producto solo con precios con IVA incluido', () => {
    expect(M01).toContain('coalesce(product.tax_rate, p_tax_rate)')
    expect(M01).toContain('products_tax := round(products_net * p_tax_rate / 100, 2);')
  })

  it('v5 mantiene los permisos de producción: solo el servidor', () => {
    expect(M01).toMatch(/from public, anon, authenticated;/)
    expect(M01).toMatch(/to service_role;/)
    expect(M01).not.toMatch(/to authenticated, service_role;/)
  })

  it('el snapshot toma el costo de la variante y si no, el del producto', () => {
    expect(M02).toContain('coalesce(nullif(variant.purchase_price, 0), nullif(product.purchase_price, 0))')
  })

  it('el dashboard parchea bloques que existen y lee snapshots con la regla de costo de S1', () => {
    for (const block of blocks(M03, 'old')) expect(S1_READS).toContain(block)
    expect(S1_READS).toContain('coalesce(sum(coalesce(s.subtotal_amount,s.total_amount)),0) net,')
    expect(M03).toContain('public.can_read_product_cost(p_organization_id)')
    expect(M03).toContain("coalesce(sum(s.total_amount - coalesce(s.tax_amount,0)),0) net,")
  })

  it('compara sin depender de los saltos de línea de Windows de producción', () => {
    for (const sql of [M01, M03]) expect(sql).toContain(String.raw`source := replace(source, E'\r\n', E'\n');`)
  })

  it('cada paso tiene su reversión', () => {
    for (const file of ['rollback_01.sql', 'rollback_02.sql', 'rollback_03.sql']) {
      expect(existsSync(join(process.cwd(), STAGE, file))).toBe(true)
    }
  })
})
