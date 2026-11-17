import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OrganizationStorefrontTab } from '@/components/superadmin/organizations/OrganizationStorefrontTab'
import { chosenStorefrontStyle, describeOrganizationStorefront } from '@/lib/superadmin/organization-storefront'
import { defaultTemplatesForPlan } from '@/lib/website/template-plan-access'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const catalog = [
  { code: 'BASIC' as const, name: 'Pro', isActive: true, templates: defaultTemplatesForPlan('BASIC') },
  { code: 'PRO' as const, name: 'Pro Max', isActive: true, templates: defaultTemplatesForPlan('PRO') },
  { code: 'ENTERPRISE' as const, name: 'Ultra', isActive: true, templates: defaultTemplatesForPlan('ENTERPRISE') },
]

describe('plantilla de la tienda en Super Admin', () => {
  it('sin plantilla guardada usa «Automático»', () => {
    expect(chosenStorefrontStyle(null)).toBe('auto')
    expect(chosenStorefrontStyle({ storefrontStyle: 'inventada' })).toBe('auto')
    expect(chosenStorefrontStyle({ storefrontStyle: 'tech' })).toBe('tech')
  })

  it('en «Automático» dice qué plantilla termina mostrando según el rubro', () => {
    const result = describeOrganizationStorefront({ companyInfo: null, businessVertical: 'electronics', servicesAvailable: false, planCode: 'PRO', catalog })
    expect(result.isAuto).toBe(true)
    expect(result.resolved).not.toBe('auto')
    expect(result.resolvedLabel.length).toBeGreaterThan(0)
  })

  it('lista las habilitadas por nivel y las que no trae el plan con el plan más barato que las incluye', () => {
    const result = describeOrganizationStorefront({ companyInfo: { storefrontStyle: 'classic' }, businessVertical: 'general', servicesAvailable: false, planCode: 'BASIC', catalog })
    expect(result.inPlan).toBe(true)
    expect(result.enabled?.map((group) => group.tier)).toEqual(['base'])
    expect(result.enabled?.[0].templates.find((t) => t.value === 'classic')?.current).toBe(true)
    const premium = result.notIncluded?.find((t) => t.value === 'especial-cosmeticos')
    expect(premium?.availableIn).toBe('Ultra')
  })

  it('avisa cuando conserva una plantilla que su plan ya no incluye', () => {
    const result = describeOrganizationStorefront({ companyInfo: { storefrontStyle: 'especial-cosmeticos' }, businessVertical: 'cosmetics', servicesAvailable: false, planCode: 'BASIC', catalog })
    expect(result.inPlan).toBe(false)
  })

  it('sin catálogo no inventa la lista', () => {
    const result = describeOrganizationStorefront({ companyInfo: null, businessVertical: 'general', servicesAvailable: false, planCode: 'PRO', catalog: null })
    expect(result.enabled).toBeNull()
    expect(result.inPlan).toBe(true)
  })
})

describe('pestaña «Tienda y negocio»', () => {
  it('muestra la plantilla en uso, el tipo de negocio y la visibilidad', () => {
    const storefront = describeOrganizationStorefront({ companyInfo: { storefrontStyle: 'especial-cosmeticos' }, businessVertical: 'cosmetics', servicesAvailable: false, planCode: 'BASIC', catalog })
    render(
      <OrganizationStorefrontTab
        storefront={storefront}
        business={{ verticalLabel: 'Cosmética & Belleza', verticalIcon: '💄', operatingModel: 'Venta minorista', primaryActivity: 'Ventas y caja', specialties: [], attentionMode: null, appointmentMode: null }}
        slug="intercell"
        planName="Pro"
        storefrontPublic
        marketplacePublic={false}
      />,
    )
    // Aparece en «En uso» y en «No incluidas» (su plan no la trae).
    expect(screen.getAllByText(storefront.chosenLabel)).toHaveLength(2)
    expect(screen.getByText(/no incluye esta plantilla/)).toBeInTheDocument()
    expect(screen.getByText('Cosmética & Belleza')).toBeInTheDocument()
    expect(screen.getByText('Publicada')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver tienda/ })).toHaveAttribute('href', '/intercell/inicio')
  })
})

describe('ficha de la organización', () => {
  const view = readFileSync(resolve(process.cwd(), 'src/components/superadmin/organizations/OrganizationDetailView.tsx'), 'utf8')
  it('el rubro de belleza tiene su nombre (antes se mostraba como Comercio general)', () => {
    expect(view).toContain("beauty_services: { label: 'Belleza y cuidado personal'")
  })
  it('el modelo de operación usa las etiquetas del sistema (antes «mixto» decía «Venta Minorista»)', () => {
    expect(view).toContain('OPERATING_MODEL_LABELS[')
    expect(view).not.toContain("'Taller de reparación' : org.operating_model === 'service'")
  })
  it('tiene la pestaña «Tienda y negocio»', () => {
    expect(view).toContain('value="storefront"')
  })
})
