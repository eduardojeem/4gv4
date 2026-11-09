import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  STOREFRONT_STYLE_PREFERENCES,
  STOREFRONT_TEMPLATE_GROUPS,
} from '@/lib/website/storefront-style'
import {
  canSwitchTemplate,
  cheapestPlanWithTemplate,
  defaultTemplatesForPlan,
  isTemplateInPlan,
  sanitizeTemplateList,
  templatesForPlan,
} from '@/lib/website/template-plan-access'
import { buildTemplateCatalog } from '@/lib/website/template-catalog'

const plans = [
  { code: 'BASIC' as const, name: 'Basic', templates: defaultTemplatesForPlan('BASIC') },
  { code: 'PRO' as const, name: 'Pro', templates: defaultTemplatesForPlan('PRO') },
  { code: 'ENTERPRISE' as const, name: 'Pro Max', templates: defaultTemplatesForPlan('ENTERPRISE') },
]

describe('plantillas por plan: valores por defecto', () => {
  it('tres niveles: Basic esencial, Pro + rubro, Pro Max + premium', () => {
    expect(defaultTemplatesForPlan('BASIC')).toEqual(['auto', 'classic', 'modern', 'catalog-basic'])
    expect(defaultTemplatesForPlan('PRO')).toEqual(expect.arrayContaining(['fashion', 'sport', 'tech', 'market', 'beauty', 'services']))
    expect(defaultTemplatesForPlan('PRO')).not.toContain('informatica-electronica')
    expect(defaultTemplatesForPlan('ENTERPRISE')).toEqual([...STOREFRONT_STYLE_PREFERENCES])
  })

  it('cada plantilla está en un solo grupo de rubro y ninguna queda afuera', () => {
    const grouped = STOREFRONT_TEMPLATE_GROUPS.flatMap((group) => group.templateKeys)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect([...grouped].sort()).toEqual([...STOREFRONT_STYLE_PREFERENCES].sort())
  })

  it('lo guardado por Super Admin manda; sin fila se usa el nivel por defecto', () => {
    const rows = [{ plan_code: 'BASIC', templates: ['classic', 'tech', 'inventada', 'classic'] }]
    expect(templatesForPlan('BASIC', rows)).toEqual(['classic', 'tech'])
    expect(templatesForPlan('PRO', rows)).toEqual(defaultTemplatesForPlan('PRO'))
    expect(sanitizeTemplateList('no-es-lista')).toEqual([])
  })
})

describe('plantillas por plan: reglas', () => {
  it('«Automático» se habilita solo si la plantilla que elige para el rubro está en el plan', () => {
    const basic = defaultTemplatesForPlan('BASIC')
    // Electrónica → Celulares & Gadgets (de rubro): no está en Basic.
    expect(isTemplateInPlan('auto', basic, 'electronics')).toBe(false)
    // Comercio general → Tienda Clásica: sí.
    expect(isTemplateInPlan('auto', basic, 'general')).toBe(true)
  })

  it('se conserva la plantilla actual aunque el plan no la traiga; cambiar a otra bloqueada no', () => {
    const basic = defaultTemplatesForPlan('BASIC')
    expect(canSwitchTemplate({ next: 'barber', current: 'barber', allowed: basic })).toBe(true)
    expect(canSwitchTemplate({ next: 'barber', current: 'classic', allowed: basic })).toBe(false)
    expect(canSwitchTemplate({ next: 'modern', current: 'barber', allowed: basic })).toBe(true)
  })

  it('indica el plan más barato que trae la plantilla', () => {
    expect(cheapestPlanWithTemplate('tech', plans)?.name).toBe('Pro')
    expect(cheapestPlanWithTemplate('informatica-electronica', plans)?.name).toBe('Pro Max')
    expect(cheapestPlanWithTemplate('classic', plans)?.name).toBe('Basic')
  })
})

describe('catálogo del panel', () => {
  const access = { planName: 'Basic', allowed: defaultTemplatesForPlan('BASIC'), plans }

  it('muestra todas las plantillas: bloqueadas por plan con el plan desde el que están', () => {
    const groups = buildTemplateCatalog({ businessVertical: 'electronics', context: { commerceMode: 'cart' }, access })
    const options = groups.flatMap((group) => group.options)
    expect(options).toHaveLength(STOREFRONT_STYLE_PREFERENCES.length)
    const mega = options.find((option) => option.value === 'informatica-electronica')
    expect(mega).toMatchObject({ status: 'locked_plan', upgradePlanName: 'Pro Max', reason: 'Disponible en el plan Pro Max.' })
    expect(options.find((option) => option.value === 'classic')?.status).toBe('available')
  })

  it('las que no aplican al negocio quedan apagadas con el motivo', () => {
    const groups = buildTemplateCatalog({ businessVertical: 'clothing', context: { servicesAvailable: false, commerceMode: 'cart' }, access: null })
    const options = groups.flatMap((group) => group.options)
    expect(options.find((option) => option.value === 'catalog-basic')).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('Catálogo') })
    expect(options.find((option) => option.value === 'services')?.status).toBe('unavailable')
  })

  it('ordena: Automático, después el rubro de la cuenta, y dentro del grupo primero lo disponible', () => {
    const groups = buildTemplateCatalog({ businessVertical: 'electronics', context: { commerceMode: 'cart' }, access: { ...access, allowed: ['classic', 'informatica-electronica'] } })
    expect(groups.map((group) => group.id).slice(0, 2)).toEqual(['auto', 'tech'])
    expect(groups[1].options.map((option) => option.value)).toEqual(['informatica-electronica', 'tech'])
  })

  it('la plantilla guardada sigue disponible aunque el plan no la traiga', () => {
    const groups = buildTemplateCatalog({ businessVertical: 'electronics', context: {}, savedValue: 'informatica-electronica', access })
    expect(groups.flatMap((group) => group.options).find((option) => option.value === 'informatica-electronica')?.status).toBe('available')
  })
})

vi.mock('@/hooks/use-storefront-template-access', () => ({
  useStorefrontTemplateAccess: () => ({
    access: { planName: 'Basic', planCode: 'BASIC', allowed: defaultTemplatesForPlan('BASIC'), plans, businessVertical: 'electronics', servicesAvailable: false },
    error: null,
    isLoading: false,
  }),
}))

describe('selector de /admin/website', () => {
  it('dice cuántas plantillas trae el plan y bloquea las demás con su plan', async () => {
    const { StorefrontTemplateSelector } = await import('@/components/admin/website/StorefrontTemplateSelector')
    render(<StorefrontTemplateSelector value="classic" onChange={vi.fn()} businessVertical="electronics" servicesAvailable={false} commerceMode="cart" />)
    expect(screen.getByText(/Tu plan/)).toHaveTextContent('Tu plan Basic incluye')
    expect(screen.getByRole('button', { name: /^Mega Tienda Tech/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Mega Tienda Tech/ })).toHaveAccessibleDescription('Disponible en el plan Pro Max.')
    expect(screen.getByRole('button', { name: /^Tienda Clásica/ })).toBeEnabled()
    expect(screen.getByRole('link', { name: /Ver planes para desbloquear/ })).toHaveAttribute('href', '/admin/subscriptions/change-plan')
  })
})
