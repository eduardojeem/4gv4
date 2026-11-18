import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OrganizationStorefrontTab } from '@/components/superadmin/organizations/OrganizationStorefrontTab'
import { chosenStorefrontStyle, describeOrganizationStorefront, storefrontLookFrom } from '@/lib/superadmin/organization-storefront'
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

  it('muestra cada plantilla habilitada con su miniatura y abre un ejemplo sobre la tienda real', () => {
    const storefront = describeOrganizationStorefront({ companyInfo: { storefrontStyle: 'classic', brandColor: 'rose', headerStyle: 'dark' }, businessVertical: 'electronics', servicesAvailable: false, planCode: 'PRO', catalog })
    render(
      <OrganizationStorefrontTab
        storefront={storefront}
        business={{ verticalLabel: 'Tecnología', verticalIcon: '📱', operatingModel: 'Venta minorista', primaryActivity: 'Ventas y caja', specialties: [], attentionMode: null, appointmentMode: null }}
        slug="diracstorepy"
        organizationName="Dirac Store"
        planName="Pro Max"
        storefrontPublic
        marketplacePublic
      />,
    )
    const enabled = storefront.enabled!.flatMap((group) => group.templates)
    for (const template of enabled) {
      // La que usa aparece dos veces: en «Plantilla en uso» y en su tarjeta.
      expect(screen.getAllByRole('button', { name: new RegExp(`^Ver ejemplo de ${template.label.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}`) }).length).toBeGreaterThan(0)
    }
    const other = enabled.find((template) => !template.current && template.value !== 'auto')!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Ver ejemplo de ${other.label.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}`) }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: new RegExp(other.label.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')) })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByTitle(/Ejemplo de .* en la tienda de Dirac Store/)).toHaveAttribute('src', '/diracstorepy/inicio')
    expect(within(dialog).getByText(/no cambia nada de la tienda/)).toBeInTheDocument()
  })

  it('sin tienda publicada el ejemplo es una maqueta, no la tienda', () => {
    const storefront = describeOrganizationStorefront({ companyInfo: null, businessVertical: 'general', servicesAvailable: false, planCode: 'PRO', catalog })
    render(
      <OrganizationStorefrontTab
        storefront={storefront}
        business={{ verticalLabel: 'Comercio general', verticalIcon: '🏬', operatingModel: 'Venta minorista', primaryActivity: 'Ventas y caja', specialties: [], attentionMode: null, appointmentMode: null }}
        slug="sinpublicar"
        planName="Pro Max"
        storefrontPublic={false}
        marketplacePublic={false}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: /^Ver ejemplo/ })[0])
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByTitle(/Ejemplo de/)).not.toBeInTheDocument()
    expect(within(dialog).getByText(/no está publicada/)).toBeInTheDocument()
  })
})

describe('aspecto guardado para los ejemplos', () => {
  it('usa el color y el encabezado de la tienda, y cae a los de fábrica con datos inválidos', () => {
    expect(storefrontLookFrom({ brandColor: 'rose', headerStyle: 'dark', showTopBar: false })).toEqual({ brandColor: 'rose', customBrandColor: undefined, headerStyle: 'dark', showTopBar: false })
    expect(storefrontLookFrom({ brandColor: 'custom', customBrandColor: '#12AB34' })).toMatchObject({ brandColor: 'custom', customBrandColor: '#12AB34' })
    expect(storefrontLookFrom({ brandColor: 'custom', customBrandColor: 'rojo' })).toMatchObject({ brandColor: 'blue', customBrandColor: undefined })
    expect(storefrontLookFrom(null)).toEqual({ brandColor: 'blue', customBrandColor: undefined, headerStyle: 'glass', showTopBar: true })
  })

  it('marca la sugerida para el rubro y en «Automático» dibuja la plantilla resuelta', () => {
    const result = describeOrganizationStorefront({ companyInfo: null, businessVertical: 'electronics', servicesAvailable: false, planCode: 'PRO', catalog })
    expect(result.resolvedStyle).toBe(result.suggestedStyle)
    const all = [...(result.enabled ?? []).flatMap((group) => group.templates), ...(result.notIncluded ?? [])]
    expect(all.filter((template) => template.suggested).map((template) => template.value)).toEqual([result.suggestedStyle])
    const auto = all.find((template) => template.value === 'auto')
    if (auto) expect(auto.preview).toBe(result.suggestedStyle)
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
