import { expect, it } from 'vitest'
import { resolveTechPublication, publishedPaymentLabels } from './mega-tech-publication'
import type { WebsiteSettings } from '@/types/website-settings'

const settings = { company_info: { name: 'Tienda', repairTrackingEnabled: true, servicesPageEnabled: true }, services: [{ id: 's', title: 'Atención', active: true }], booking_section: { enabled: true } } as WebsiteSettings
it('no anuncia ofertas ni atención publicada si la configuración no está disponible', () => {
  expect(resolveTechPublication(null, { hasCatalog: true, hasRepairs: true, hasServices: true })).toEqual({ catalog: true, offers: false, repairs: false, services: false, booking: false })
})
it('un módulo apagado no se reactiva por preferencias públicas guardadas', () => {
  expect(resolveTechPublication(settings, { hasCatalog: false, hasRepairs: false, hasServices: false })).toEqual({ catalog: false, offers: false, repairs: false, services: false, booking: false })
})
it('respeta reparación, servicios y ofertas ocultos aunque el módulo esté activo', () => {
  const hidden = { ...settings, company_info: { ...settings.company_info, repairTrackingEnabled: false, servicesPageEnabled: false }, offers_section: { enabled: false } } as WebsiteSettings
  expect(resolveTechPublication(hidden, { hasCatalog: true, hasRepairs: true, hasServices: true })).toEqual({ catalog: true, offers: false, repairs: false, services: false, booking: false })
})
it('publica servicios y la intención de reservas solo con módulo y sección habilitados', () => {
  expect(resolveTechPublication(settings, { hasCatalog: true, hasRepairs: false, hasServices: true })).toMatchObject({ services: true, booking: true, repairs: false })
})
it('los pagos requieren configuración y control autorizado, sin inventar cuotas o QR', () => {
  const checkout = { payment: { cash: { enabled: true, label: 'Al retirar' }, card: { enabled: true }, transfer: { enabled: false }, digital_wallet: { enabled: true } } } as WebsiteSettings['checkout']
  expect(publishedPaymentLabels(checkout, undefined)).toEqual([])
  expect(publishedPaymentLabels(checkout, { cash: true, card: false, transfer: true, digital_wallet: true })).toEqual(['Al retirar', 'Billetera digital'])
})
