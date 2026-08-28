import { describe, expect, it } from 'vitest'
import { ecosystemItems } from './saas-ecosystem-marquee'
import { saasHighlights } from './saas-features-section'
import { businessTypes, defaultSyncPlans, planNotes, trustItems, workflowSteps } from './saas-landing-data'

describe('SaaS landing implemented capabilities', () => {
  it('does not advertise payment methods, providers or custom APIs', () => {
    const visibleCopy = [
      ...ecosystemItems.flatMap((item) => [item.name, item.category, item.badge]),
      ...saasHighlights.flatMap((item) => [item.title, item.description]),
      ...trustItems.map((item) => item.label),
      ...planNotes.flatMap((item) => [item.title, item.description]),
      ...businessTypes.flatMap((item) => [item.description, ...item.modules]),
      ...defaultSyncPlans.flatMap((plan) => [...plan.highlights]),
      ...workflowSteps.flatMap((item) => [item.title, item.description]),
    ].join(' ')

    expect(visibleCopy).not.toMatch(/pago|cobro|efectivo|tarjeta|Stripe|Bancard|Pagopar/i)
    expect(visibleCopy).not.toMatch(/\bAPI\b|integraci(?:ón|ones)/i)
  })

  it('describes the implemented public repair tracking without claiming QR access', () => {
    const repair = saasHighlights.find((item) => item.title.includes('reparaciones'))

    expect(repair?.description).toMatch(/seguimiento público/i)
    expect(repair?.description).not.toMatch(/QR/i)
  })

  it('explains customer-facing capabilities instead of implementation technology', () => {
    const ecosystemCopy = ecosystemItems
      .flatMap((item) => [item.name, item.category, item.badge])
      .join(' ')

    expect(ecosystemCopy).not.toMatch(/Supabase|PostgreSQL|RLS|API|infraestructura/i)
    expect(ecosystemCopy).toMatch(/ventas/i)
    expect(ecosystemCopy).toMatch(/inventario/i)
    expect(ecosystemCopy).toMatch(/reparaciones/i)
    expect(ecosystemCopy).toMatch(/clientes/i)
  })
})
