import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El comportamiento de la migración se probó contra la base local (ver el PR):
 * baja con exceso → plazo, vencimiento → productos apagados, pago de un plan
 * mayor → reactivación, cancelación vencida → Gratuito, período vencido → pago
 * pendiente. Estas pruebas cuidan que nadie desarme esas piezas.
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')
const migration = read('supabase/migrations/20261101000000_subscription_lifecycle_fixes.sql')
const service = read('src/lib/saas/subscription-service.ts')
const productItem = read('src/app/api/products/[id]/route.ts')

describe('ciclo de vida de los planes', () => {
  it('cualquier cambio de plan sincroniza el plazo de productos, también al subir', () => {
    expect(migration).toContain('after insert or update of plan on public.subscriptions')
    expect(migration).toContain('perform public.resolve_plan_downgrade_grace(p_organization_id)')
    expect(migration).toContain('perform public.open_plan_downgrade_grace(')
  })

  it('una cancelación programada vencida pasa a Gratuito y no queda como impaga', () => {
    expect(migration).toContain("perform public.apply_free_subscription_plan(target.organization_id, 'FREE')")
    expect(migration).toContain('and coalesce(cancel_at_period_end, false) = false')
  })

  it('programa los vencimientos con nombres fijos', () => {
    for (const job of ['subscriptions_expire_paid_periods', 'subscriptions_downgrade_overdue', 'plan_downgrade_grace_process']) {
      expect(migration).toContain(`cron.schedule('${job}'`)
    }
  })

  it('las funciones nuevas no quedan expuestas a usuarios', () => {
    expect(migration).toContain('revoke all on function public.sync_plan_downgrade_grace(uuid, text) from public, anon, authenticated')
    expect(migration).toContain('revoke all on function public.plan_product_limit(text) from public, anon, authenticated')
  })

  it('el exceso de productos no bloquea cancelar ni cambiar de plan: lo resuelve el plazo', () => {
    expect(service).toContain("const countResources: ResourceType[] = ['users', 'branches', 'cashRegisters', 'categories', 'repairs', 'services']")
    expect(service).toContain("const countResources: ResourceType[] = ['users', 'branches', 'cashRegisters', 'categories']")
  })

  it('las pruebas gratis vencen solas y el registro usa los días que muestra la tarjeta', () => {
    const trials = read('supabase/migrations/20261101010000_subscription_trials_and_discounts.sql')
    expect(trials).toContain("cron.schedule('subscriptions_expire_trials'")
    expect(read('src/app/api/auth/register-company/route.ts')).not.toContain('trial_days ?? 14')
  })

  it('el cupón de extender prueba no pisa una cuenta que ya paga', () => {
    expect(read('src/lib/saas/redeem-subscription-promo.ts')).toContain("promo.benefit_type === 'extend_trial' && subscription.status !== 'trialing'")
  })

  it('el superadmin no apaga un plan con clientes ni activa uno pago sin fecha de fin', () => {
    expect(read('src/app/api/superadmin/subscription-plans/[id]/route.ts')).toContain('No se puede desactivar')
    expect(read('src/app/api/superadmin/subscriptions/[id]/route.ts')).toContain('Indicá la fecha de fin del período')
  })

  it('reactivar un producto respeta el cupo del plan', () => {
    expect(productItem).toContain('if (updatePayload.is_active === true)')
    expect(productItem).toContain('await canCreateResource(organization.id, resourceType, 1)')
  })
})
