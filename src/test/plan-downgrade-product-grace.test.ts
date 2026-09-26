import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El ciclo de gracia decide apagar productos de un cliente, asi que su contrato
 * se protege explicitamente: los plazos, el orden de conservacion y —sobre
 * todo— que no borre filas.
 */
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260818120000_plan_downgrade_product_grace.sql'),
  'utf8'
)

const service = readFileSync(
  resolve(process.cwd(), 'src/lib/saas/subscription-service.ts'),
  'utf8'
)

describe('ciclo de gracia por baja de plan', () => {
  it('abre una ventana de 7 dias al detectar excedente', () => {
    expect(migration).toContain('function public.open_plan_downgrade_grace')
    expect(migration).toContain("now() + interval '7 days'")
  })

  it('da 30 dias mas antes del archivado definitivo', () => {
    expect(migration).toContain("archive_deadline_at = now() + interval '30 days'")
  })

  it('conserva los mas vendidos y apaga el resto', () => {
    expect(migration).toContain('function public.rank_products_by_sales')
    expect(migration).toContain('order by r.units_sold desc')
    expect(migration).toContain('ranked.position > grace_row.product_limit')
  })

  it('excluye las ventas canceladas del ranking', () => {
    expect(migration).toContain("coalesce(lower(s.status), '') <> 'cancelado'")
  })

  // El punto mas delicado: `sale_items` y `sale_item_cost_snapshots` bloquean el
  // delete de cualquier producto vendido, y forzarlo destruiria el historico.
  it('archiva en lugar de borrar filas de products', () => {
    expect(migration).toContain('function public.enforce_plan_downgrade_archive')
    expect(migration).toContain('archived_by_plan_at = now()')
    expect(migration).not.toMatch(/delete\s+from\s+public\.products/i)
  })

  it('distingue lo apagado por el ciclo de lo que apago el usuario', () => {
    expect(migration).toContain('deactivated_by_plan')
    // Al regularizar solo se reactiva lo que apago el ciclo.
    expect(migration).toContain('and deactivated_by_plan = true')
  })

  it('no reinicia la ventana si el ciclo ya esta en curso', () => {
    expect(migration).toContain("if existing.organization_id is not null and existing.stage <> 'resolved' then")
  })

  it('cierra el ciclo cuando la organizacion vuelve a entrar en su cupo', () => {
    expect(migration).toContain('if active_count <= p_product_limit then')
    expect(migration).toContain('delete from public.plan_downgrade_grace where organization_id = p_organization_id')
  })

  it('procesa los vencimientos por cron sin pisarse entre corridas', () => {
    expect(migration).toContain('function public.process_plan_downgrade_grace')
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain("cron.schedule(")
  })

  it('se dispara al aplicar la baja programada', () => {
    expect(service).toContain('openProductGraceIfOverLimit')
    expect(service).toContain('open_plan_downgrade_grace')
  })

  it('lo archivado deja de ocupar cupo', () => {
    expect(service).toContain('countActiveProducts')
    expect(service).toContain("is('archived_by_plan_at', null)")
  })
})
