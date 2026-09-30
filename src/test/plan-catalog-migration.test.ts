import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deriveTechnicalModules, moduleForFeatureLabel } from '@/lib/saas/plan-modules'
import { parsePlanLimit } from '@/lib/saas/plan-limits'

const SQL = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260930120000_plan_catalog_gratis_pro_promax.sql'),
  'utf8',
)

function planUpdate(tier: string) {
  const block = SQL.slice(SQL.indexOf('update public.subscription_plans set'), SQL.length)
    .split('update public.subscription_plans set')
    .find((part) => part.includes(`where tier = '${tier}'`))
  if (!block) throw new Error(`No hay UPDATE para ${tier}`)
  const json = (column: string) => JSON.parse(block.match(new RegExp(`${column} = '([\\s\\S]*?)'::jsonb`))![1])
  return { features: json('features') as Array<{ label: string; value: boolean }>, limits: json('limits') as Record<string, string> }
}

const byTier = {
  free: planUpdate('free'),
  basic: planUpdate('basic'),
  pro: planUpdate('pro'),
}

describe('catálogo Gratis / Pro / Pro Max', () => {
  it('Gratis: catálogo y WhatsApp, sin pedidos online', () => {
    const modules = deriveTechnicalModules('free', byTier.free.features)
    expect(modules).toEqual(expect.arrayContaining(['pos', 'inventory', 'repairs', 'crm', 'services', 'ecommerce']))
    expect(modules).not.toContain('orders')
    expect(modules).not.toContain('delivery')
    expect(modules).not.toContain('analytics')
  })

  it('Pro: pedidos online, créditos y promociones, sin analítica ni auditoría', () => {
    const modules = deriveTechnicalModules('basic', byTier.basic.features)
    expect(modules).toEqual(expect.arrayContaining(['orders', 'delivery', 'credits', 'promotions', 'inventory_admin']))
    expect(modules).not.toContain('analytics')
    expect(modules).not.toContain('security')
  })

  it('Pro Max: todos los módulos', () => {
    // web_analytics llega por defecto del tier (migración 20261001120000).
    expect(deriveTechnicalModules('pro', byTier.pro.features).sort()).toEqual([
      'analytics', 'credits', 'crm', 'delivery', 'ecommerce', 'inventory', 'inventory_admin',
      'orders', 'pos', 'promotions', 'repairs', 'security', 'services', 'web_analytics',
    ])
  })

  it('los límites acordados', () => {
    const limits = (tier: keyof typeof byTier) =>
      Object.fromEntries(Object.entries(byTier[tier].limits).map(([key, value]) => [key, parsePlanLimit(value)]))
    expect(limits('free')).toEqual({ users: 1, branches: 1, cashRegisters: 1, products: 100, repairs: 50, repairPhotos: 0 })
    expect(limits('basic')).toEqual({ users: 5, branches: 2, cashRegisters: 3, products: 500, repairs: 300, repairPhotos: 3 })
    expect(limits('pro')).toEqual({ users: 15, branches: 5, cashRegisters: 10, products: 10000, repairs: null, repairPhotos: 6 })
  })

  it('Gratis no ofrece prueba y Pro Max queda destacado', () => {
    const free = SQL.slice(SQL.indexOf("name = 'Gratis'"), SQL.indexOf("where tier = 'free'"))
    expect(free).toContain('trial_days = 0')
    const pro = SQL.slice(SQL.indexOf("name = 'Pro Max'"), SQL.indexOf("where tier = 'pro'"))
    expect(pro).toContain('is_popular = true')
  })
})

describe('el trigger de la base y la app conectan los mismos features', () => {
  it('cada etiqueta del trigger habilita el mismo módulo que en la app', () => {
    const pairs = [...SQL.matchAll(/when '([^']+)' then '([a-z_]+)'/g)]
      .filter(([, label]) => !['free', 'basic', 'starter', 'pro', 'profesional', 'enterprise'].includes(label))
    expect(pairs.length).toBeGreaterThan(15)
    for (const [, label, module] of pairs) {
      expect(moduleForFeatureLabel(label), label).toBe(module)
    }
  })

  it('el trigger conserva las fotos por reparación', () => {
    expect(SQL).toContain("'repairPhotos', coalesce(public.plan_limit_int(source_plan.limits, 'repairPhotos'")
  })
})
