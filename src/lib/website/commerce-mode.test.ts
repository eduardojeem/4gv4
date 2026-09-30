import { describe, expect, it } from 'vitest'
import { resolvePublicCommerceMode } from './commerce-mode'
import { upgradePlanNameFor } from '@/lib/saas/upgrade-plan'

// Sin el módulo de pedidos el servidor rechaza el pedido al confirmar: la
// tienda no puede mostrar un carrito que termina en error.
describe('modo de la tienda pública según el plan', () => {
  it('con pedidos online respeta lo que eligió el dueño', () => {
    expect(resolvePublicCommerceMode('cart', { ordersEnabled: true, hasWhatsapp: true })).toBe('cart')
    expect(resolvePublicCommerceMode('catalog', { ordersEnabled: true, hasWhatsapp: true })).toBe('catalog')
  })

  it('sin pedidos online el carrito pasa a WhatsApp, o a catálogo si no hay número', () => {
    expect(resolvePublicCommerceMode('cart', { ordersEnabled: false, hasWhatsapp: true })).toBe('whatsapp')
    expect(resolvePublicCommerceMode('cart', { ordersEnabled: false, hasWhatsapp: false })).toBe('catalog')
    expect(resolvePublicCommerceMode(undefined, { ordersEnabled: false, hasWhatsapp: true })).toBe('whatsapp')
  })

  it('los modos sin carrito no dependen del plan', () => {
    expect(resolvePublicCommerceMode('whatsapp', { ordersEnabled: false, hasWhatsapp: true })).toBe('whatsapp')
    expect(resolvePublicCommerceMode('catalog', { ordersEnabled: false, hasWhatsapp: false })).toBe('catalog')
  })
})

describe('plan al que hay que subir', () => {
  const availability = {
    orders: [
      { name: 'ULTRA', isActive: false },
      { name: 'Pro', isActive: true },
      { name: 'Pro Max', isActive: true },
    ],
  }

  it('es el primer plan activo que incluye el módulo', () => {
    expect(upgradePlanNameFor('orders', availability)).toBe('Pro')
  })

  it('sin ningún plan activo que lo incluya no inventa un nombre', () => {
    expect(upgradePlanNameFor('analytics', availability)).toBeNull()
    expect(upgradePlanNameFor('orders', undefined)).toBeNull()
  })
})
