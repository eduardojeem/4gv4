import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getSuggestedModules,
  moduleDependencyProblems,
  modulesForVerticalChange,
  type OrganizationModule,
} from '@/lib/organization/business-profile'

const PRO = new Set<string>(['inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'services', 'orders', 'delivery', 'analytics', 'web_analytics', 'promotions', 'security', 'finances', 'reports'])

describe('cambiar de rubro', () => {
  it('no apaga las herramientas generales que la tienda usaba', () => {
    const actuales: OrganizationModule[] = ['inventory', 'pos', 'crm', 'repairs', 'finances', 'reports', 'security']
    const nuevos = modulesForVerticalChange(actuales, getSuggestedModules('beauty_services', 'service'), PRO)
    expect(nuevos).toEqual(expect.arrayContaining(['finances', 'reports', 'security']))
    // Lo del rubro sí cambia: una estética no necesita Reparaciones.
    expect(nuevos).not.toContain('repairs')
    expect(nuevos).toContain('services')
  })

  it('tampoco prende herramientas generales que la tienda tenía apagadas', () => {
    const nuevos = modulesForVerticalChange(['pos', 'crm'], getSuggestedModules('hardware', 'retail'), PRO)
    // «Analítica» viene en la recomendación de ferretería, pero es general: queda como estaba.
    expect(nuevos).not.toContain('analytics')
  })

  it('solo propone lo que incluye el plan', () => {
    const basico = new Set<string>(['inventory', 'pos', 'crm'])
    expect(modulesForVerticalChange([], getSuggestedModules('clothing', 'retail'), basico).sort()).toEqual(['crm', 'inventory', 'pos'])
  })
})

describe('dependencias entre módulos', () => {
  it('avisa lo que le falta a cada módulo', () => {
    expect(moduleDependencyProblems(['delivery', 'pos'])).toEqual(['Entregas necesita Pedidos: se entregan los pedidos online.'])
    expect(moduleDependencyProblems(['inventory_admin'])).toEqual(['Inventario avanzado necesita Inventario.'])
    expect(moduleDependencyProblems(['orders', 'ecommerce'])).toHaveLength(2)
  })

  it('con alguna de las alternativas alcanza', () => {
    expect(moduleDependencyProblems(['orders', 'ecommerce', 'services'])).toEqual([])
    expect(moduleDependencyProblems(['orders', 'delivery', 'inventory'])).toEqual([])
  })

  it('las recomendaciones de cada rubro no rompen ninguna dependencia', () => {
    for (const vertical of ['general', 'clothing', 'cosmetics', 'electronics', 'food', 'hardware', 'barbershop', 'beauty_services', 'other'] as const) {
      for (const model of ['retail', 'wholesale', 'service', 'repair', 'mixed'] as const) {
        expect(moduleDependencyProblems(getSuggestedModules(vertical, model)), `${vertical}/${model}`).toEqual([])
      }
    }
  })

  it('se valida en la configuración y al guardar', () => {
    const tarjeta = readFileSync(resolve(process.cwd(), 'src/components/admin/settings/BusinessProfileCard.tsx'), 'utf8')
    expect(tarjeta).toContain('disabled={!dirty || saving || dependencyProblems.length > 0}')
    expect(tarjeta).toContain('modulesForVerticalChange(enabled, getSuggestedModules(nextVertical, nextModel), entitled)')
    const api = readFileSync(resolve(process.cwd(), 'src/app/api/admin/organization-profile/route.ts'), 'utf8')
    expect(api).toContain("code: 'MODULE_DEPENDENCY'")
  })
})
