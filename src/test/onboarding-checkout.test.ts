import { describe, expect, it } from 'vitest'
import {
  STARTER_CHECKOUT_CHOICES,
  applyCheckoutChoices,
  checkoutChoicesError,
  choicesFromCheckout,
} from '@/lib/onboarding/checkout-choices'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

const base = () => {
  const checkout = getWebsiteSettingsDefaults().checkout
  return {
    ...checkout,
    payment: {
      ...checkout.payment,
      transfer: {
        ...checkout.payment.transfer,
        enabled: true,
        instructions: 'Mandanos el comprobante',
        transferOptions: [
          { id: 'a', bankName: 'Banco Viejo', accountNumber: '111' },
          { id: 'b', bankName: 'Otro banco', accountNumber: '222' },
        ],
      },
    },
    // Una tienda que ya configuró envíos: el inicial los trae apagados.
    delivery: { ...checkout.delivery, enabled: true },
    minOrderAmount: 50000,
  }
}

describe('configuración inicial: cobro y entrega', () => {
  it('una tienda nueva arranca con efectivo y retiro en el local', () => {
    expect(choicesFromCheckout(null)).toEqual(STARTER_CHECKOUT_CHOICES)
    expect(checkoutChoicesError(STARTER_CHECKOUT_CHOICES)).toBeNull()
  })

  it('lee lo que la tienda ya tiene guardado', () => {
    const choices = choicesFromCheckout(base())
    expect(choices).toMatchObject({ cash: true, transfer: true, transferBank: 'Banco Viejo', transferAccount: '111', delivery: true, pickup: true })
  })

  it('pide lo mínimo para que el cliente pueda comprar', () => {
    expect(checkoutChoicesError({ ...STARTER_CHECKOUT_CHOICES, cash: false })).toMatch(/forma de pago/)
    expect(checkoutChoicesError({ ...STARTER_CHECKOUT_CHOICES, pickup: false })).toMatch(/envíos|retiro/)
    expect(checkoutChoicesError({ ...STARTER_CHECKOUT_CHOICES, transfer: true })).toMatch(/banco/)
    expect(checkoutChoicesError({ ...STARTER_CHECKOUT_CHOICES, transfer: true, transferAlias: '80012345-6' })).toBeNull()
  })

  it('aplica lo elegido sin borrar el resto de la configuración', () => {
    const next = applyCheckoutChoices(base(), {
      ...STARTER_CHECKOUT_CHOICES,
      transfer: true,
      transferBank: 'Banco Nuevo',
      transferAccount: '999',
      transferHolder: 'Mi Tienda SA',
      delivery: true,
      deliveryCost: 15000,
      deliveryZones: 'Asunción',
    })
    expect(next.payment.transfer.enabled).toBe(true)
    // La cuenta principal se reemplaza; las otras se conservan.
    expect(next.payment.transfer.transferOptions).toEqual([
      { id: 'a', bankName: 'Banco Nuevo', accountNumber: '999', accountHolder: 'Mi Tienda SA', alias: undefined },
      { id: 'b', bankName: 'Otro banco', accountNumber: '222' },
    ])
    expect(next.payment.transfer.instructions).toBe('Mandanos el comprobante')
    expect(next.payment.card.enabled).toBe(false)
    expect(next.delivery).toMatchObject({ enabled: true, defaultCost: 15000, zones: 'Asunción' })
    expect(next.minOrderAmount).toBe(50000)
  })
})
