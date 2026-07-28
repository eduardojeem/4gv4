import { describe, expect, it } from 'vitest'
import { validateSetting } from '@/lib/validation/website-settings'

const validCheckout = {
  payment: {
    cash: { enabled: true, label: 'Efectivo' },
    card: { enabled: false, label: 'Tarjeta' },
    transfer: { enabled: false, label: 'Transferencia' },
    digital_wallet: { enabled: false, label: 'Billetera digital' },
  },
  delivery: {
    enabled: true,
    defaultCost: 15000,
    freeThreshold: 250000,
    estimatedTime: '30-60 min',
  },
  pickup: {
    enabled: true,
    estimatedTime: '20-30 min',
  },
  minOrderAmount: 0,
}

describe('checkout website setting validation', () => {
  it('accepts a checkout with a payment method and a fulfillment option', () => {
    expect(validateSetting('checkout', validCheckout).success).toBe(true)
  })

  it('rejects a checkout without enabled payment methods', () => {
    const result = validateSetting('checkout', {
      ...validCheckout,
      payment: {
        cash: { enabled: false },
        card: { enabled: false },
        transfer: { enabled: false },
        digital_wallet: { enabled: false },
      },
    })

    expect(result.success).toBe(false)
  })

  it('rejects a checkout without delivery or pickup', () => {
    const result = validateSetting('checkout', {
      ...validCheckout,
      delivery: { ...validCheckout.delivery, enabled: false },
      pickup: { ...validCheckout.pickup, enabled: false },
    })

    expect(result.success).toBe(false)
  })

  it('accepts multiple bank transfer options', () => {
    const result = validateSetting('checkout', {
      ...validCheckout,
      payment: {
        ...validCheckout.payment,
        transfer: {
          enabled: true,
          transferOptions: [
            {
              id: 'bank-1',
              bankName: 'Banco Familiar',
              alias: 'tienda.familiar',
              accountNumber: '1234567',
              accountHolder: '4G Celulares',
            },
            {
              id: 'bank-2',
              bankName: 'Ueno Bank',
              alias: 'tienda.ueno',
              accountHolder: '4G Celulares',
            },
          ],
        },
      },
    })

    expect(result.success).toBe(true)
  })

  it('rejects incomplete bank transfer options', () => {
    const result = validateSetting('checkout', {
      ...validCheckout,
      payment: {
        ...validCheckout.payment,
        transfer: {
          enabled: true,
          transferOptions: [
            {
              id: 'bank-1',
              bankName: '',
              alias: '',
              accountNumber: '',
            },
          ],
        },
      },
    })

    expect(result.success).toBe(false)
  })

  it('limits bank transfer options to eight accounts', () => {
    const result = validateSetting('checkout', {
      ...validCheckout,
      payment: {
        ...validCheckout.payment,
        transfer: {
          enabled: true,
          transferOptions: Array.from({ length: 9 }, (_, index) => ({
            id: `bank-${index}`,
            bankName: `Banco ${index}`,
            alias: `alias.${index}`,
          })),
        },
      },
    })

    expect(result.success).toBe(false)
  })

  it('accepts delivery zones with paid and free shipping', () => {
    const result = validateSetting('checkout', {
      ...validCheckout,
      delivery: {
        ...validCheckout.delivery,
        zoneOptions: [
          { id: 'zone-1', name: 'Encarnacion', cost: 5000 },
          { id: 'zone-2', name: 'Centro', cost: 0 },
        ],
      },
    })

    expect(result.success).toBe(true)
  })

  it('rejects delivery zones without a name or with a negative cost', () => {
    const emptyName = validateSetting('checkout', {
      ...validCheckout,
      delivery: {
        ...validCheckout.delivery,
        zoneOptions: [{ id: 'zone-1', name: '', cost: 5000 }],
      },
    })
    const negativeCost = validateSetting('checkout', {
      ...validCheckout,
      delivery: {
        ...validCheckout.delivery,
        zoneOptions: [{ id: 'zone-1', name: 'Encarnacion', cost: -1 }],
      },
    })

    expect(emptyName.success).toBe(false)
    expect(negativeCost.success).toBe(false)
  })

  it('limits delivery zones to twenty options', () => {
    const result = validateSetting('checkout', {
      ...validCheckout,
      delivery: {
        ...validCheckout.delivery,
        zoneOptions: Array.from({ length: 21 }, (_, index) => ({
          id: `zone-${index}`,
          name: `Zona ${index}`,
          cost: 5000,
        })),
      },
    })

    expect(result.success).toBe(false)
  })

  it.each(['whatsapp', 'catalog'] as const)(
    'accepts %s mode without payment or fulfillment options',
    (commerceMode) => {
      const result = validateSetting('checkout', {
        ...validCheckout,
        commerceMode,
        payment: {
          cash: { enabled: false },
          card: { enabled: false },
          transfer: { enabled: false },
          digital_wallet: { enabled: false },
        },
        delivery: { ...validCheckout.delivery, enabled: false },
        pickup: { ...validCheckout.pickup, enabled: false },
      })

      expect(result.success).toBe(true)
    }
  )

  it('rejects an unknown public commerce mode', () => {
    const result = validateSetting('checkout', {
      ...validCheckout,
      commerceMode: 'external-store',
    })

    expect(result.success).toBe(false)
  })
})
