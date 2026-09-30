import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deriveTechnicalModules, moduleForFeatureLabel } from '@/lib/saas/plan-modules'
import { ORGANIZATION_MODULES } from '@/lib/organization/business-profile'
import { PLAN_FEATURES } from '@/lib/saas/plan-feature-catalog'

const SQL = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261001120000_web_analytics_module.sql'),
  'utf8',
)

/** Arrays por defecto del trigger, por código de plan. */
function sqlDefaults(code: 'FREE' | 'BASIC' | 'PRO') {
  const match = SQL.match(new RegExp(`when '${code}' then array\\[([^\\]]*)\\]`))
  if (!match) throw new Error(`Sin defaults para ${code}`)
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map(([, code]) => code).sort()
}

describe('Visitas web como módulo propio', () => {
  it('existe en la app, en el catálogo de planes y en el CHECK de la base', () => {
    expect(ORGANIZATION_MODULES).toContain('web_analytics')
    expect(PLAN_FEATURES.find((feature) => feature.key === 'webAnalytics')?.module).toBe('web_analytics')
    const check = SQL.slice(SQL.indexOf('add constraint organizations_enabled_modules_check'), SQL.indexOf('-- 2) ---'))
    expect(check).toContain("'web_analytics'")
  })

  it('cada etiqueta del trigger habilita el mismo módulo que en la app', () => {
    const pairs = [...SQL.matchAll(/when '([^']+)' then '([a-z_]+)'/g)]
      .filter(([, label]) => !['free', 'basic', 'starter', 'pro', 'profesional', 'enterprise'].includes(label))
    expect(pairs.map(([, , code]) => code)).toContain('web_analytics')
    for (const [, label, code] of pairs) {
      expect(moduleForFeatureLabel(label), label).toBe(code)
    }
  })

  // Los defaults completos los compara la última migración del trigger
  // (finances-reports-modules-migration.test.ts).
  it('el trigger incluye Visitas web por defecto en Pro y Pro Max, no en Gratis', () => {
    expect(sqlDefaults('FREE')).not.toContain('web_analytics')
    expect(sqlDefaults('BASIC')).toContain('web_analytics')
    expect(sqlDefaults('PRO')).toContain('web_analytics')
  })

  it('Gratis no la trae; Pro y Pro Max sí', () => {
    expect(SQL).toContain("jsonb_build_object('label', 'Visitas web', 'value', sp.tier <> 'free')")
    const withRow = (tier: string, value: boolean) =>
      deriveTechnicalModules(tier, [{ label: 'Visitas web', value }])
    expect(withRow('free', false)).not.toContain('web_analytics')
    expect(withRow('basic', true)).toContain('web_analytics')
    expect(withRow('basic', true)).not.toContain('analytics')
    expect(withRow('pro', true)).toEqual(expect.arrayContaining(['analytics', 'web_analytics']))
  })

  it('nadie pierde acceso: listas propias de módulos y pruebas vigentes', () => {
    expect(SQL).toContain("array_append(o.enabled_modules, 'web_analytics')")
    expect(SQL).toContain("where module = 'analytics' and expires_at > now()")
  })
})
