import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckoutSettingsEditor } from '@/components/admin/website/CheckoutSettingsEditor'
import { missingForMinimumOrder, resolvePublicCheckout } from '@/lib/website/commerce-mode'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { reviewWebsiteSection } from '@/lib/website/section-coach'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { hasStoreWhatsapp, storeWhatsappNumber } from '@/lib/whatsapp-number'
import type { WebsiteSettings } from '@/types/website-settings'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const state = vi.hoisted(() => ({
  checkout: null as unknown,
  company: {} as Record<string, unknown>,
  modules: ['orders', 'delivery'] as string[],
  entitled: ['orders', 'delivery'] as string[],
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: { checkout: state.checkout, company_info: state.company },
    isLoading: false,
    isSaving: false,
    updateSetting: vi.fn().mockResolvedValue({ success: true }),
  }),
}))

vi.mock('@/contexts/SubscriptionStatusContext', () => ({
  useSubscriptionStatus: () => ({
    modules: state.modules,
    effectiveModules: state.modules,
    entitledModules: state.entitled,
    modulePlanAvailability: { delivery: [{ name: 'Básico', isActive: true }] },
  }),
}))

const defaults = () => getWebsiteSettingsDefaults().checkout
const food = resolveStorefrontCapabilities({ businessVertical: 'food', operatingModel: 'retail', effectiveModules: ['orders', 'delivery'] })

describe('una sola regla de WhatsApp', () => {
  it('usa el WhatsApp o, si falta, el teléfono, en formato wa.me', () => {
    expect(storeWhatsappNumber({ whatsapp: '', phone: '0981 123 456' })).toBe('595981123456')
    expect(storeWhatsappNumber({ whatsapp: '+595 981 123456' })).toBe('595981123456')
    expect(hasStoreWhatsapp({ phone: '1234' })).toBe(false)
    expect(hasStoreWhatsapp(null)).toBe(false)
  })
})

describe('cobro que ve el cliente', () => {
  it('sin el módulo Entregas no se ofrece delivery', () => {
    const checkout = { ...defaults(), delivery: { ...defaults().delivery, enabled: true } }
    const result = resolvePublicCheckout(checkout, { ordersEnabled: true, deliveryEnabled: false, hasWhatsapp: true })
    expect(result.delivery.enabled).toBe(false)
    expect(result.commerceMode).toBe('cart')
  })

  it('si sin delivery no queda forma de recibir el pedido, pasa a WhatsApp o catálogo', () => {
    const checkout = { ...defaults(), delivery: { ...defaults().delivery, enabled: true }, pickup: { ...defaults().pickup, enabled: false } }
    expect(resolvePublicCheckout(checkout, { ordersEnabled: true, deliveryEnabled: false, hasWhatsapp: true }).commerceMode).toBe('whatsapp')
    expect(resolvePublicCheckout(checkout, { ordersEnabled: true, deliveryEnabled: false, hasWhatsapp: false }).commerceMode).toBe('catalog')
  })

  it('la tienda pública aplica el módulo de entregas en los dos caminos', () => {
    for (const path of ['src/app/api/public/website/settings/route.ts', 'src/lib/website/fetch-settings.ts']) {
      const source = read(path)
      expect(source).toContain("isOrganizationModuleEnabled(organization.id, 'delivery')")
      expect(source).toContain('resolvePublicCheckout(')
      expect(source).toContain('hasStoreWhatsapp(normalized.company_info)')
    }
  })
})

describe('pedido mínimo', () => {
  it('calcula cuánto falta', () => {
    expect(missingForMinimumOrder(50000, 30000)).toBe(20000)
    expect(missingForMinimumOrder(50000, 60000)).toBe(0)
    expect(missingForMinimumOrder(0, 10)).toBe(0)
  })

  it('lo exigen el servidor y el carrito', () => {
    const route = read('src/app/api/public/orders/route.ts')
    expect(route).toContain("code: 'MIN_ORDER_NOT_REACHED'")
    expect(route).toContain('missingForMinimumOrder(checkout.minOrderAmount, subtotal)')
    const cart = read('src/components/public/cart/CartPageClient.tsx')
    expect(cart).toContain('disabled={loading || items.length === 0 || missingForMinimum > 0}')
  })
})

describe('configuración inicial segura', () => {
  it('sin onboarding la tienda ofrece solo efectivo y retiro', () => {
    const checkout = defaults()
    expect(checkout.payment.cash.enabled).toBe(true)
    expect(checkout.payment.card.enabled).toBe(false)
    expect(checkout.payment.transfer.enabled).toBe(false)
    expect(checkout.payment.digital_wallet.enabled).toBe(false)
    expect(checkout.delivery.enabled).toBe(false)
    expect(checkout.pickup.enabled).toBe(true)
  })
})

describe('asistente de Pagos y entregas', () => {
  const settingsWith = (checkout: Partial<WebsiteSettings['checkout']>, company: Record<string, unknown> = {}) => {
    const base = getWebsiteSettingsDefaults()
    return { ...base, company_info: { ...base.company_info, ...company }, checkout: { ...base.checkout!, ...checkout } } as WebsiteSettings
  }

  it('avisa del delivery sin el módulo Entregas', () => {
    const settings = settingsWith({ delivery: { ...defaults().delivery, enabled: true } })
    const items = reviewWebsiteSection('checkout', settings, { capabilities: food, storefrontStyle: 'market', effectiveModules: ['orders'] })
    expect(items.some((item) => item.level === 'warn' && /módulo Entregas/.test(item.text))).toBe(true)
  })

  it('avisa del modo WhatsApp sin número y lleva a cargarlo', () => {
    const items = reviewWebsiteSection('checkout', settingsWith({ commerceMode: 'whatsapp' }, { whatsapp: '', phone: '' }), { capabilities: food, storefrontStyle: 'market' })
    expect(items[0]).toMatchObject({ level: 'warn', action: { kind: 'navigate', section: 'company' } })
  })
})

describe('editor de Pagos y entregas', () => {
  beforeEach(() => {
    state.checkout = { ...defaults(), delivery: { ...defaults().delivery, enabled: true } }
    state.company = { whatsapp: '0981123456' }
    state.modules = ['orders', 'delivery']
    state.entitled = ['orders', 'delivery']
  })

  it('bloquea el delivery sin el módulo y explica por qué', () => {
    state.modules = ['orders']
    state.entitled = ['orders']
    render(<CheckoutSettingsEditor />)
    expect(screen.getByRole('switch', { name: /envío a domicilio/ })).toBeDisabled()
    expect(screen.getByText(/disponible en el plan Básico/)).toBeInTheDocument()
  })

  it('distingue el módulo apagado en la cuenta', () => {
    state.modules = ['orders']
    render(<CheckoutSettingsEditor />)
    expect(screen.getByText(/apagado en Configuración/)).toBeInTheDocument()
  })

  it('no deja guardar el modo WhatsApp sin número y lleva a cargarlo', () => {
    state.checkout = { ...defaults(), commerceMode: 'whatsapp' }
    state.company = {}
    const onNavigate = vi.fn()
    render(<CheckoutSettingsEditor onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /Cargar WhatsApp/ }))
    expect(onNavigate).toHaveBeenCalledWith('company')
  })

  it('recomienda según el rubro y aplica sin activar lo que necesita datos', () => {
    state.checkout = { ...defaults(), delivery: { ...defaults().delivery, enabled: false } }
    render(<CheckoutSettingsEditor capabilities={food} />)
    expect(screen.getByText(/Recomendado para alimentos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar recomendación' }))
    expect(screen.getByRole('switch', { name: /envío a domicilio/ })).toBeChecked()
    expect(screen.getByRole('switch', { name: /Transferencia/ })).not.toBeChecked()
  })
})
