import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deriveTechnicalModules, moduleForFeatureLabel } from '@/lib/saas/plan-modules'
import { ORGANIZATION_MODULES } from '@/lib/organization/business-profile'
import { PLAN_FEATURES } from '@/lib/saas/plan-feature-catalog'
import { canExportReports } from '@/lib/saas/plan-features'

/** La última versión del trigger de sincronización de planes. */
const SQL = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261002120000_finances_reports_modules.sql'),
  'utf8',
)

function sqlDefaults(code: 'FREE' | 'BASIC' | 'PRO') {
  const match = SQL.match(new RegExp(`when '${code}' then array\\[([^\\]]*)\\]`))
  if (!match) throw new Error(`Sin defaults para ${code}`)
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map(([, code]) => code).sort()
}

describe('Finanzas y Reportes exportables como módulos', () => {
  it('el CHECK de la base acepta todos los módulos de la app', () => {
    const check = SQL.slice(SQL.indexOf('add constraint organizations_enabled_modules_check'), SQL.indexOf('-- 2) ---'))
    for (const code of ORGANIZATION_MODULES) expect(check, code).toContain(`'${code}'`)
  })

  it('cada módulo del catálogo existe en la app', () => {
    for (const feature of PLAN_FEATURES) {
      if (feature.module) expect(ORGANIZATION_MODULES, feature.key).toContain(feature.module)
    }
    expect(PLAN_FEATURES.find((feature) => feature.key === 'finances')?.module).toBe('finances')
    expect(PLAN_FEATURES.find((feature) => feature.key === 'reports')?.module).toBe('reports')
  })

  it('cada etiqueta del trigger habilita el mismo módulo que en la app', () => {
    const pairs = [...SQL.matchAll(/when '([^']+)' then '([a-z_]+)'/g)]
      .filter(([, label]) => !['free', 'basic', 'starter', 'pro', 'profesional', 'enterprise'].includes(label))
    const modules = pairs.map(([, , code]) => code)
    expect(modules).toEqual(expect.arrayContaining(['finances', 'reports', 'web_analytics']))
    for (const [, label, code] of pairs) {
      expect(moduleForFeatureLabel(label), label).toBe(code)
    }
  })

  it('los módulos por defecto del trigger coinciden con plan-modules.ts', () => {
    expect(sqlDefaults('FREE')).toEqual(deriveTechnicalModules('free', []).sort())
    expect(sqlDefaults('BASIC')).toEqual(deriveTechnicalModules('basic', []).sort())
    expect(sqlDefaults('PRO')).toEqual(deriveTechnicalModules('pro', []).sort())
  })

  it('Gratis no trae Finanzas ni exportar; Pro sí', () => {
    const free = deriveTechnicalModules('free', [{ label: 'Finanzas y rentabilidad', value: false }, { label: 'Reportes exportables (CSV/PDF)', value: false }])
    const pro = deriveTechnicalModules('basic', [{ label: 'Finanzas y rentabilidad', value: true }, { label: 'Reportes exportables (CSV/PDF)', value: true }])
    expect(free).not.toContain('finances')
    expect(canExportReports(free)).toBe(false)
    expect(pro).toEqual(expect.arrayContaining(['finances', 'reports']))
    expect(canExportReports(pro)).toBe(true)
  })

  it('las listas propias de módulos reciben los nuevos si el plan los incluye', () => {
    expect(SQL).toContain("case when 'finances' = any(p.modules) then array['finances']")
    expect(SQL).toContain("case when 'reports' = any(p.modules) then array['reports']")
  })
})
