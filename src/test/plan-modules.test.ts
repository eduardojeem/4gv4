import { describe, expect, it } from 'vitest'
import { deriveTechnicalModules } from '@/lib/saas/plan-modules'

describe('deriveTechnicalModules', () => {
  it('enables promotions when configured in plan features', () => {
    const modules = deriveTechnicalModules('basic', [
      { label: 'Promociones y descuentos', value: true },
    ])

    expect(modules).toContain('promotions')
  })

  it('allows disabling a default module from plan features', () => {
    const modules = deriveTechnicalModules('pro', [
      { label: 'Promociones y descuentos', value: false },
    ])

    expect(modules).not.toContain('promotions')
  })

  it('preserves the current repairs and WhatsApp plan contract', () => {
    expect(deriveTechnicalModules('free', [])).toContain('repairs')
    expect(deriveTechnicalModules('pro', [])).not.toContain('whatsapp')
  })

  it('controls the security module from plan features', () => {
    expect(deriveTechnicalModules('pro', [])).toContain('security')
    expect(deriveTechnicalModules('pro', [{ label: 'Seguridad y auditoría', value: false }])).not.toContain('security')
    expect(deriveTechnicalModules('basic', [{ label: 'Seguridad y auditoría', value: true }])).toContain('security')
  })

  it('controls the credits module from plan features', () => {
    expect(deriveTechnicalModules('pro', [])).not.toContain('credits')
    expect(deriveTechnicalModules('basic', [{ label: 'Créditos y cuotas', value: true }])).toContain('credits')
    expect(deriveTechnicalModules('pro', [{ label: 'Creditos y cuotas', value: false }])).not.toContain('credits')
  })

  it('includes services in every plan and orders plus delivery from Basic', () => {
    expect(deriveTechnicalModules('free', [])).toContain('services')
    expect(deriveTechnicalModules('free', [])).not.toContain('orders')
    expect(deriveTechnicalModules('free', [])).not.toContain('delivery')

    for (const tier of ['basic', 'pro', 'enterprise']) {
      expect(deriveTechnicalModules(tier, [])).toEqual(expect.arrayContaining([
        'services',
        'orders',
        'delivery',
      ]))
    }
  })

  it('allows the three operational modules to be controlled by commercial features', () => {
    expect(deriveTechnicalModules('pro', [{ label: 'Servicios', value: false }])).not.toContain('services')
    expect(deriveTechnicalModules('free', [{ label: 'Pedidos', value: true }])).toContain('orders')
    expect(deriveTechnicalModules('basic', [{ label: 'Entregas', value: false }])).not.toContain('delivery')
  })

  // Gratis mostraba "Ecommerce & Marketplace ✓" sin tener el módulo: esos
  // features cambiaban la publicidad pero no lo que recibía la tienda.
  it('conecta ecommerce, analítica, reparaciones y clientes a sus módulos', () => {
    expect(deriveTechnicalModules('free', [{ label: 'Ecommerce & Marketplace', value: true }])).toContain('ecommerce')
    expect(deriveTechnicalModules('basic', [{ label: 'Analytics avanzado', value: true }])).toContain('analytics')
    expect(deriveTechnicalModules('pro', [{ label: 'Analytics avanzado', value: false }])).not.toContain('analytics')
    expect(deriveTechnicalModules('free', [{ label: 'Módulo de Reparaciones', value: false }])).not.toContain('repairs')
    expect(deriveTechnicalModules('free', [{ label: 'CRM / Clientes', value: false }])).not.toContain('crm')
  })

  it('los features informativos no tocan módulos', () => {
    const base = deriveTechnicalModules('basic', [])
    expect(deriveTechnicalModules('basic', [
      { label: 'Gestión de usuarios', value: false },
      { label: 'Sucursales múltiples', value: false },
      { label: 'Reportes exportables', value: false },
      { label: 'Soporte prioritario', value: true },
    ]).sort()).toEqual(base.sort())
  })

  it('el inventario avanzado arrastra al básico', () => {
    const modules = deriveTechnicalModules('basic', [
      { label: 'Inventario', value: false },
      { label: 'Inventario avanzado', value: true },
    ])
    expect(modules).toEqual(expect.arrayContaining(['inventory', 'inventory_admin']))
  })
})
