import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrustBarEditor } from '@/components/admin/website/TrustBarEditor'
import { ProcessStepsEditor } from '@/components/admin/website/ProcessStepsEditor'
import { AnnouncementsManager } from '@/components/announcements/AnnouncementsManager'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import {
  ANNOUNCEMENT_IDEAS,
  PROCESS_TEMPLATES_BY_FAMILY,
  SERVICES_SECTION_IDEAS,
  SERVICE_PRESET_CATEGORY,
  TRUST_BAR_IDEAS,
  guidanceFamily,
  heroFieldsForStyle,
  showsFinancialServices,
  type GuidanceFamily,
} from '@/lib/website/vertical-guidance'
import { PROCESS_STEP_TEMPLATES } from '@/lib/website/process-steps'
import { getCompatibleHeroPresetIds } from '@/lib/website/storefront-capabilities'

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: {
      company_info: { processSectionEnabled: true },
      trust_bar: {
        enabled: true,
        position: 'above_carousel',
        items: [{ id: 'a', icon: 'truck', title: 'Envíos a todo el país', description: 'Recibilo en tu casa', active: true }],
      },
    },
    isLoading: false,
    error: null,
    isSaving: false,
    updateSetting: vi.fn(),
    updateSettings: vi.fn(),
  }),
}))

const caps = (businessVertical: Parameters<typeof resolveStorefrontCapabilities>[0]['businessVertical'], modules: string[] = ['inventory', 'ecommerce']) =>
  resolveStorefrontCapabilities({ businessVertical, operatingModel: 'retail', effectiveModules: modules as never })

const FAMILIES: GuidanceFamily[] = ['general', 'clothing', 'barbershop', 'cosmetics', 'electronics', 'food', 'hardware', 'other', 'repairs']

describe('sugerencias por rubro', () => {
  it('cada rubro tiene beneficios, avisos, recorridos y textos de servicios', () => {
    for (const family of FAMILIES) {
      expect(TRUST_BAR_IDEAS[family].length).toBeGreaterThanOrEqual(3)
      expect(ANNOUNCEMENT_IDEAS[family].length).toBeGreaterThan(0)
      expect(SERVICES_SECTION_IDEAS[family].length).toBeGreaterThan(0)
      for (const id of PROCESS_TEMPLATES_BY_FAMILY[family]) {
        expect(PROCESS_STEP_TEMPLATES.some((template) => template.id === id)).toBe(true)
      }
    }
  })

  it('las reparaciones mandan sobre el rubro', () => {
    expect(guidanceFamily(caps('electronics', ['inventory', 'repairs']))).toBe('repairs')
    expect(guidanceFamily(caps('electronics'))).toBe('electronics')
  })

  it('pagos y giros solo para comercio general', () => {
    expect(showsFinancialServices('general')).toBe(true)
    expect(showsFinancialServices('barbershop')).toBe(false)
    expect(SERVICE_PRESET_CATEGORY.barbershop).toBe('Barbería')
  })

  it('barbería y gastronomía tienen su propia portada', () => {
    expect(getCompatibleHeroPresetIds(caps('barbershop', ['services']))[0]).toBe('barbershop')
    expect(getCompatibleHeroPresetIds(caps('food'))).toEqual(['food', 'general'])
  })

  it('la portada pide solo lo que muestra cada plantilla', () => {
    const repairs = { tracking: { kind: 'repairs' as const, href: '/mis-reparaciones' as const } }
    expect(heroFieldsForStyle('market', repairs)).toEqual({ buttons: false, tracking: false, stats: false })
    expect(heroFieldsForStyle('classic', repairs)).toEqual({ buttons: true, tracking: true, stats: true })
    expect(heroFieldsForStyle('sport', repairs)).toEqual({ buttons: true, tracking: false, stats: false })
  })
})

describe('Beneficios de comprar en tu tienda', () => {
  it('suma ideas del rubro con un toque y no repite las cargadas', () => {
    render(<TrustBarEditor capabilities={caps('clothing')} storefrontStyle="fashion" />)
    const ideas = within(screen.getByRole('region', { name: /Ideas para moda/ }))
    expect(ideas.queryByRole('button', { name: /Envíos a todo el país/ })).not.toBeInTheDocument()
    fireEvent.click(ideas.getByRole('button', { name: /Cambios fáciles/ }))
    expect(screen.getAllByDisplayValue('Cambios fáciles')).toHaveLength(1)
    expect(screen.getByText('Hay cambios sin guardar')).toBeInTheDocument()
  })

  it('la ubicación solo se elige en Clásica', () => {
    const { unmount } = render(<TrustBarEditor storefrontStyle="market" />)
    expect(screen.queryByRole('radiogroup', { name: 'Ubicación en el inicio' })).not.toBeInTheDocument()
    expect(screen.getByText(/los ubica sola/)).toBeInTheDocument()
    unmount()
    render(<TrustBarEditor storefrontStyle="classic" />)
    expect(screen.getByRole('radiogroup', { name: 'Ubicación en el inicio' })).toBeInTheDocument()
  })
})

describe('Cómo atendés a tus clientes', () => {
  it('una barbería ve primero el recorrido de turnos y no el de pagos y giros', () => {
    render(<ProcessStepsEditor capabilities={caps('barbershop', ['services'])} />)
    const ready = within(screen.getByRole('region', { name: /Recorridos listos/ }))
    const buttons = ready.getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('Turnos')
    expect(ready.queryByText('Pagos y giros')).not.toBeInTheDocument()
  })
})

describe('Aviso al entrar a tu tienda', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'idea-1' })
  })

  it('una idea se carga como borrador para editar', () => {
    render(
      <AnnouncementsManager
        initial={[]}
        max={3}
        audience="tu tienda"
        previewScope="tienda"
        upload={vi.fn()}
        onSave={vi.fn()}
        ideas={ANNOUNCEMENT_IDEAS.food}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Pedidos para el finde/ }))
    expect(screen.getByDisplayValue('Pedidos para el finde')).toBeInTheDocument()
  })
})
