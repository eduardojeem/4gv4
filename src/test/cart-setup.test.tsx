import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckoutSettingsEditor } from '@/components/admin/website/CheckoutSettingsEditor'
import { cartConfigErrors, fillCartTextsFromCompany, reviewCartSetup } from '@/lib/checkout/cart-setup'
import { CheckoutSettingsSchema } from '@/lib/validation/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { CheckoutSettings } from '@/types/website-settings'

const state = vi.hoisted(() => ({
  checkout: null as unknown,
  company: {} as Record<string, unknown>,
  updateSetting: vi.fn(),
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: { checkout: state.checkout, company_info: state.company },
    isLoading: false,
    isSaving: false,
    updateSetting: state.updateSetting,
  }),
}))

vi.mock('@/contexts/SubscriptionStatusContext', () => ({
  useSubscriptionStatus: () => ({
    modules: ['orders', 'delivery'],
    effectiveModules: ['orders', 'delivery'],
    entitledModules: ['orders', 'delivery'],
    modulePlanAvailability: {},
  }),
}))

const base = (): CheckoutSettings => getWebsiteSettingsDefaults().checkout
const withPayment = (key: keyof CheckoutSettings['payment'], patch: Record<string, unknown>): CheckoutSettings => {
  const checkout = base()
  return { ...checkout, payment: { ...checkout.payment, [key]: { ...checkout.payment[key], ...patch } } }
}
const ids = (issues: Array<{ id: string }>) => issues.map((issue) => issue.id)

describe('reglas del carrito', () => {
  it('la configuración inicial es válida', () => {
    expect(cartConfigErrors(base())).toEqual([])
  })

  it('transferencia sin cuentas o con cuentas incompletas no sirve', () => {
    expect(ids(cartConfigErrors(withPayment('transfer', { enabled: true, transferOptions: [] })))).toContain('transfer-no-account')
    expect(ids(cartConfigErrors(withPayment('transfer', { enabled: true, transferOptions: [{ id: 'a', bankName: 'Itaú', alias: '' }] })))).toContain('transfer-incomplete')
    expect(cartConfigErrors(withPayment('transfer', { enabled: true, transferOptions: [{ id: 'a', bankName: 'Itaú', alias: '80012345-6' }] }))).toEqual([])
  })

  it('billetera sin alias ni QR no sirve', () => {
    expect(ids(cartConfigErrors(withPayment('digital_wallet', { enabled: true })))).toContain('wallet-empty')
    expect(cartConfigErrors(withPayment('digital_wallet', { enabled: true, walletAlias: 'mi.tienda' }))).toEqual([])
  })

  it('delivery y retiro necesitan un tiempo estimado', () => {
    const checkout = { ...base(), delivery: { ...base().delivery, enabled: true, estimatedTime: '' }, pickup: { ...base().pickup, estimatedTime: ' ' } }
    expect(ids(cartConfigErrors(checkout))).toEqual(expect.arrayContaining(['delivery-time', 'pickup-time']))
  })

  it('el servidor rechaza lo mismo', () => {
    const result = CheckoutSettingsSchema.safeParse(withPayment('transfer', { enabled: true, transferOptions: [] }))
    expect(result.success).toBe(false)
    expect(CheckoutSettingsSchema.safeParse(base()).success).toBe(true)
  })

  it('avisa del retiro sin dirección, del delivery sin costo y del mínimo raro', () => {
    const checkout = { ...base(), minOrderAmount: 50, delivery: { ...base().delivery, enabled: true } }
    const issues = reviewCartSetup(checkout, { company: { address: '' }, deliveryModuleEnabled: true })
    expect(ids(issues)).toEqual(expect.arrayContaining(['pickup-no-address', 'delivery-no-cost', 'min-typo', 'no-confirmation']))
    expect(issues.find((issue) => issue.id === 'pickup-no-address')).toMatchObject({ level: 'warn', fixIn: 'company' })
  })

  it('sin el módulo de entregas y sin retiro no hay cómo recibir el pedido', () => {
    const checkout = { ...base(), pickup: { ...base().pickup, enabled: false }, delivery: { ...base().delivery, enabled: true } }
    expect(ids(reviewCartSetup(checkout, { company: { address: 'x' }, deliveryModuleEnabled: false }))).toContain('no-fulfillment')
  })

  it('completa los textos con los datos de la empresa sin pisar lo escrito', () => {
    const checkout = { ...base(), pickup: { ...base().pickup, instructions: '' }, delivery: { ...base().delivery, instructions: 'Lo mío' } }
    const filled = fillCartTextsFromCompany(checkout, { name: 'Panadería Sol', address: 'Av. España 123', hours: { weekdays: 'Lun a Vie 7 a 19', saturday: '', sunday: '' }, whatsapp: '0981 123456' })
    expect(filled.pickup.instructions).toContain('Av. España 123')
    expect(filled.pickup.instructions).toContain('Lun a Vie 7 a 19')
    expect(filled.delivery.instructions).toBe('Lo mío')
    expect(filled.confirmationMessage).toContain('Panadería Sol')
  })

  it('el carrito muestra dónde retirar', () => {
    const cart = readFileSync(resolve(process.cwd(), 'src/components/public/cart/CartPageClient.tsx'), 'utf8')
    expect(cart).toContain('Dónde retirar')
    expect(cart).toContain("fulfillmentType === 'PICKUP' && (pickupAddress")
  })
})

describe('guía del carrito en el editor', () => {
  beforeEach(() => {
    state.checkout = { ...base(), payment: { ...base().payment, transfer: { ...base().payment.transfer, enabled: true, transferOptions: [] } } }
    state.company = { name: 'Panadería Sol', address: 'Av. España 123', whatsapp: '0981123456' }
    state.updateSetting.mockReset().mockResolvedValue({ success: true })
  })

  it('muestra los pasos con lo que falta y no deja guardar', () => {
    render(<CheckoutSettingsEditor />)
    expect(screen.getByText('Configurá tu carrito para recibir pedidos')).toBeInTheDocument()
    expect(screen.getAllByText(/La transferencia necesita al menos una cuenta/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('switch', { name: /Retiro en local|retiro en local/ }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    expect(state.updateSetting).not.toHaveBeenCalled()
  })

  it('completa los textos con los datos de la empresa', () => {
    state.checkout = base()
    render(<CheckoutSettingsEditor />)
    fireEvent.click(screen.getByRole('button', { name: /Completar textos con mis datos/ }))
    expect((screen.getByLabelText(/Instrucciones para el cliente al retirar/) as HTMLTextAreaElement).value).toContain('Av. España 123')
  })
})
