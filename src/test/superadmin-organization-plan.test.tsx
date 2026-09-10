import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  activeModules,
  moduleUsage,
  planCoverage,
  resolveModuleState,
  unusedActiveModules,
  type ModuleContext,
} from '@/lib/superadmin/organization-modules'
import { OrganizationDetailView, type FullOrganizationDetail } from '@/components/superadmin/organizations/OrganizationDetailView'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/components/superadmin/EnterSupportButton', () => ({ EnterSupportButton: () => null }))

const PLAN_PRO = ['inventory', 'pos', 'repairs', 'crm', 'ecommerce', 'credits']

/**
 * La pestaña calculaba la lista de modulos activos asi:
 *
 *   org.enabled_modules?.length ? org.enabled_modules : ['pos','inventory','crm','ecommerce']
 *
 * Ese fallback no solo era inventado: contradice la regla del sistema. En
 * `resolveEffectiveModules`, `enabled_modules === null` significa «todos los
 * del plan estan activos», no «estos cuatro».
 */
describe('qué módulos tiene realmente activos', () => {
  it('sin elección propia, están activos todos los del plan', () => {
    const ctx: ModuleContext = { entitled: PLAN_PRO, trials: [], enabled: null }
    expect(activeModules(PLAN_PRO, ctx)).toEqual(PLAN_PRO)
    // El fallback viejo habria dicho que `repairs` y `credits` estaban apagados.
    expect(resolveModuleState('repairs', ctx)).toBe('on')
    expect(resolveModuleState('credits', ctx)).toBe('on')
  })

  it('distingue «lo apagaron» de «el plan no lo da»', () => {
    const ctx: ModuleContext = { entitled: PLAN_PRO, trials: [], enabled: ['pos', 'inventory'] }
    expect(resolveModuleState('pos', ctx)).toBe('on')
    expect(resolveModuleState('repairs', ctx)).toBe('off_by_org')
    expect(resolveModuleState('analytics', ctx)).toBe('not_in_plan')
  })

  it('una prueba vigente habilita el módulo y se dice que es prueba', () => {
    const ctx: ModuleContext = { entitled: ['pos'], trials: ['repairs'], enabled: null }
    expect(resolveModuleState('repairs', ctx)).toBe('trial')
  })

  it('un módulo prendido que el plan no incluye se señala como anomalía', () => {
    // Queda de una baja de plan mal aplicada: hay que revisarlo, no esconderlo.
    const ctx: ModuleContext = { entitled: ['pos'], trials: [], enabled: ['pos', 'analytics'] }
    expect(resolveModuleState('analytics', ctx)).toBe('on_outside_plan')
  })
})

describe('la cobertura se mide contra el plan, no contra el catálogo', () => {
  it('un Free con todo lo suyo prendido está al 100%', () => {
    // Antes se comparaba contra los 20 modulos que existen: un Free completo
    // salia «15% de cobertura funcional», como si desaprovechara algo.
    const ctx: ModuleContext = { entitled: ['pos', 'inventory'], trials: [], enabled: null }
    expect(planCoverage(ctx)).toEqual({ active: 2, entitled: 2, percent: 100 })
  })

  it('apagar la mitad baja la cobertura a la mitad', () => {
    const ctx: ModuleContext = { entitled: ['pos', 'inventory'], trials: [], enabled: ['pos'] }
    expect(planCoverage(ctx).percent).toBe(50)
  })

  it('un plan sin módulos cargados no devuelve un porcentaje', () => {
    expect(planCoverage({ entitled: [], trials: [], enabled: null }).percent).toBeNull()
  })
})

describe('el uso real de cada módulo', () => {
  it('lee la señal que corresponde a cada uno', () => {
    const señales = { sales: 1, products: 47, customers: 12, orders: 0, repairs: 3, credits: 1 }
    expect(moduleUsage('pos', señales)).toEqual({ used: true, label: '1 venta cobrada' })
    expect(moduleUsage('inventory', señales).label).toBe('47 productos')
    expect(moduleUsage('repairs', señales).label).toBe('3 reparaciones')
    expect(moduleUsage('credits', señales).label).toBe('1 crédito')
  })

  it('un módulo prendido sin actividad se marca como sin usar', () => {
    expect(moduleUsage('ecommerce', { orders: 0 })).toEqual({
      used: false,
      label: 'Sin pedidos web',
    })
  })

  it('sin una señal barata no afirma «nunca se usó»', () => {
    // Decirlo sin haberlo comprobado seria inventar un dato.
    expect(moduleUsage('analytics', { sales: 5 })).toEqual({ used: null, label: null })
    expect(moduleUsage('pos', {})).toEqual({ used: null, label: null })
  })

  it('lista los módulos activos que nunca se usaron', () => {
    const ctx: ModuleContext = { entitled: ['pos', 'ecommerce', 'repairs'], trials: [], enabled: null }
    expect(unusedActiveModules(['pos', 'ecommerce', 'repairs', 'analytics'], ctx, {
      sales: 10,
      orders: 0,
      repairs: 0,
    })).toEqual(['ecommerce', 'repairs'])
  })
})

// ── La pantalla ─────────────────────────────────────────────────────────────

const base = (over: Partial<FullOrganizationDetail> = {}): FullOrganizationDetail => ({
  organization: {
    id: '3f2b1a44-1111-4222-8333-444455556666',
    name: 'HCA Celular', slug: 'hca-celular', plan: 'PRO', logo_url: null, owner_id: 'owner-1',
    created_at: '2025-02-14T10:00:00Z', updated_at: '2026-08-06T21:43:00Z',
    business_vertical: 'general', operating_model: 'retail',
    enabled_modules: null, storefront_public: true, marketplace_public: true,
  } as never,
  owner: { id: 'owner-1', email: 'dueno@hca.com.py', full_name: 'Hugo Cáceres', avatar_url: null } as never,
  settings: { currency: 'PYG', timezone: 'America/Asuncion', display_name: null, modules: {} } as never,
  members: [],
  membersFailed: false,
  subscription: null,
  plan_details: { id: 'p', name: 'Pro', tier: 'pro', price_monthly: 250_000, currency: 'PYG' },
  plan_limits: { users: 10, branches: 3, products: 5000, repairs: 500, cashRegisters: 10, categories: null },
  plan_limits_source: 'technical',
  plan_modules: PLAN_PRO,
  module_trials: [],
  all_plans: [
    { code: 'PRO', name: 'Pro', limits: { users: 10, branches: 3, products: 5000, cashRegisters: 10, repairs: 500 } },
    { code: 'ENTERPRISE', name: 'Enterprise', limits: { users: null, branches: null, products: null, cashRegisters: null, repairs: null } },
  ],
  branches: [{
    id: 'b1', name: 'Casa Central', code: 'CC', slug: 'casa-central',
    address: 'Mcal. López 1234', city: 'Asunción', phone: '021-555-100',
    email: null, is_active: true, is_default: true, created_at: '2025-02-14T10:00:00Z',
  }],
  counts: { products: 47, quotaProducts: 47, staffMembers: 2, cashRegisters: 2, sales: 1, customers: 12, repairs: 3, categories: 5, services: 0 },
  activity: {
    revenueTotal: 50_000, revenueLast30: 0, completedSales: 1, totalSales: 1,
    lastSaleAt: '2026-08-06T21:43:17Z', daysSinceLastSale: 34,
  },
  activityTruncated: false,
  admin_settings: null, company_info: null, billing: null, settings_modules: {},
  repair_summary: { total: 3, open: 1, completed: 2, cancelled: 0, collected: 180_000, pendingBalance: 0, lastRepairAt: null },
  online_summary: { total: 0, paid: 0, revenue: 0, partial: 0, open: 0, cancelled: 0, lastOrderAt: null },
  credit_summary: {
    total: 1, active: 1, completed: 0, defaulted: 0, cancelled: 0,
    principal: 750_000, outstanding: 300_000, overdueInstallments: 0, overdueAmount: 0,
    byOrigin: { repair: 1 }, averageTerm: 3, lastCreditAt: null, installmentsTruncated: false,
  },
  billing_summary: {
    paidTotal: 0, paidCount: 0, pendingCount: 0, failedCount: 0, refundedCount: 0,
    lastPaidAt: null, lastPaidAmount: null, lastPaidMethod: null, currency: null, mixedCurrency: false,
  },
  ...over,
})

const abrir = async (nombre: RegExp) => {
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('tab', { name: nombre }))
}

describe('la pestaña de módulos', () => {
  it('mide el uso contra lo que incluye el plan', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrir(/Módulos|Rubro/)
    expect(screen.getByText('6 de 6 módulos que incluye (100%)')).toBeInTheDocument()
  })

  it('explica que sin elección propia están todos los del plan', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrir(/Módulos|Rubro/)
    expect(screen.getByText(/no eligió módulos: tiene activos todos los que su plan incluye/)).toBeInTheDocument()
  })

  it('avisa qué módulos activos nunca se usaron', async () => {
    // `ecommerce` esta prendido y la organizacion no recibio un solo pedido:
    // es plata que paga por algo que no toca.
    render(<OrganizationDetailView data={base()} />)
    await abrir(/Módulos|Rubro/)
    expect(screen.getByText(/módulos? activos? que nunca se us(aron|ó)/)).toBeInTheDocument()
  })

  it('un módulo apagado por la organización no dice «No contratado»', async () => {
    render(<OrganizationDetailView data={base({
      organization: { ...base().organization, enabled_modules: ['pos', 'inventory'] } as never,
    })} />)
    await abrir(/Módulos|Rubro/)
    expect(screen.getAllByText('Disponible, apagado').length).toBeGreaterThan(0)
    expect(screen.queryByText('No contratado')).not.toBeInTheDocument()
  })

  it('muestra el uso de cada módulo activo', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrir(/Módulos|Rubro/)
    expect(screen.getAllByText('47 productos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3 reparaciones').length).toBeGreaterThan(0)
    expect(screen.getByText('Sin pedidos web — activo pero sin usar')).toBeInTheDocument()
  })
})

describe('la pestaña de suscripción', () => {
  it('no dice «activa» sobre una organización sin suscripción', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getByText('No hay una suscripción registrada')).toBeInTheDocument()
    // El rotulo del estado y el del cobro dicen los dos «Sin suscripción».
    expect(screen.getAllByText('Sin suscripción').length).toBeGreaterThan(0)
  })

  it('con suscripción muestra su estado real', async () => {
    render(<OrganizationDetailView data={base({
      subscription: {
        id: 's1', plan: 'PRO', status: 'past_due', provider: 'bancard',
        payment_status: 'failed', provider_customer_id: null, provider_subscription_id: null,
        current_period_starts_at: '2026-08-01T00:00:00Z',
        current_period_ends_at: '2026-09-01T00:00:00Z',
        trial_ends_at: null, cancel_at_period_end: false,
      } as never,
    })} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getByText('Pago vencido')).toBeInTheDocument()
    expect(screen.queryByText('No hay una suscripción registrada')).not.toBeInTheDocument()
  })

  it('un plan sin precio no se muestra como ₲0', async () => {
    render(<OrganizationDetailView data={base({
      plan_details: { id: 'p', name: 'Free', tier: 'free', price_monthly: 0, currency: 'PYG' },
    })} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getByText('El plan no tiene precio cargado')).toBeInTheDocument()
  })

  it('el historial de cobros dice cuando nunca se cobró', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getByText('Historial de cobros')).toBeInTheDocument()
    expect(screen.getByText('Nunca registró un pago')).toBeInTheDocument()
  })

  it('las cajas se cuentan de verdad contra su tope', async () => {
    // Antes la fila decia «— / 10»: el recurso nunca se contaba.
    render(<OrganizationDetailView data={base()} />)
    await abrir(/Suscripción|Plan/)
    const cajas = screen.getByText('Cajas').closest('div')!.parentElement!
    expect(cajas.textContent).toContain('de 10')
  })
})

/**
 * La seccion listaba seis renglones «usado / tope» en texto plano, en el orden
 * en que estaban escritos: un catalogo al 99% del tope se leia igual que uno al
 * 2%, y no decia cuanto espacio queda ni que pasa al llegar al limite.
 */
describe('los límites del plan', () => {
  const apretado = (over: Partial<FullOrganizationDetail> = {}) =>
    base({
      counts: { products: 4990, quotaProducts: 4990, staffMembers: 10, cashRegisters: 2, sales: 1, customers: 12, repairs: 3, categories: 5, services: 0 },
      ...over,
    })

  it('lo más apretado va primero', async () => {
    render(<OrganizationDetailView data={apretado()} />)
    await abrir(/Suscripción|Plan/)
    // Colaboradores esta 10/10 y Productos 4990/5000: los dos arriba.
    expect(screen.getAllByText('Sin cupo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cerca del tope').length).toBeGreaterThan(0)
  })

  it('dice cuánto espacio queda, no solo el porcentaje', async () => {
    render(<OrganizationDetailView data={apretado()} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getByText(/quedan 10/)).toBeInTheDocument()
  })

  it('resume cuántos recursos hay que mirar', async () => {
    render(<OrganizationDetailView data={apretado()} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getByText(/recursos cerca del tope/)).toBeInTheDocument()
  })

  it('con espacio en todo lo dice en verde, no deja el resumen vacío', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getByText('Con espacio en todo')).toBeInTheDocument()
  })

  it('explica qué pasa al llegar al tope, solo donde importa', async () => {
    render(<OrganizationDetailView data={apretado()} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getByText(/No se pueden invitar más personas/)).toBeInTheDocument()
    // La reparacion esta lejos del tope: su aviso no aparece.
    expect(screen.queryByText(/No se pueden abrir más órdenes de taller/)).not.toBeInTheDocument()
  })

  it('ofrece el plan siguiente donde el tope aprieta', async () => {
    render(<OrganizationDetailView data={apretado({
      all_plans: [
        { code: 'PRO', name: 'Pro', limits: { users: 10, products: 5000 } },
        { code: 'ENTERPRISE', name: 'Enterprise', limits: { users: null, products: null } },
      ],
    })} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getAllByText(/Con Enterprise: sin tope/).length).toBeGreaterThan(0)
  })

  it('un recurso sin contar dice «Sin dato», no cero', async () => {
    render(<OrganizationDetailView data={base({
      counts: { ...base().counts, cashRegisters: null },
    })} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getByText('Esta pantalla no cuenta este recurso')).toBeInTheDocument()
  })

  it('cada recurso explica qué ocupa cupo exactamente', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrir(/Suscripción|Plan/)
    expect(screen.getByText(/lo archivado por baja de plan no cuenta/)).toBeInTheDocument()
    expect(screen.getByText(/Los clientes de la web no cuentan/)).toBeInTheDocument()
  })
})
