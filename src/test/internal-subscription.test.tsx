import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useSubscriptionStatus: () => state.value }))
const state = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))

import { SubscriptionBanner } from '@/components/admin/SubscriptionBanner'
import { planOrganizationUpdate } from '@/lib/superadmin/organization-update'
import { buildOrganizationPatch, organizationEditDefaults } from '@/lib/superadmin/organization-edit'
import { calculateRecurringRevenue } from '@/lib/superadmin/metrics-calculations'
import { computeBillingMetrics } from '@/lib/superadmin/billing-metrics'
import { summarizeSubscription } from '@/lib/superadmin/organization-quick-actions'
import { evaluateSubscriptionStatus } from '@/lib/saas/subscription-status'

const now = new Date('2026-11-19T12:00:00Z')
const org = { id: 'org-1', name: 'MiTiendaPY', slug: 'mitiendapy', plan: 'ENTERPRISE' }
const base = { status: null, isBlocked: false, isTrialing: false, trialDaysLeft: null, downgradedFromExpiry: false, moduleTrials: [] }

afterEach(cleanup)

describe('cuenta interna desde superadmin', () => {
  it('queda activa, sin vencimiento ni cobro, y no bloquea', () => {
    const result = planOrganizationUpdate({ status: 'internal' }, org, null, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.subscription).toEqual({ status: 'active', payment_status: 'internal', current_period_ends_at: null, trial_ends_at: null, cancel_at_period_end: false })
    expect(evaluateSubscriptionStatus({ status: 'active', paymentStatus: 'internal', periodEndsAt: null }, now).isBlocked).toBe(false)
  })

  it('al pasarla a otro estado deja de figurar como interna', () => {
    const current = { id: 's', status: 'active', payment_status: 'internal', trial_ends_at: null, current_period_ends_at: null }
    const result = planOrganizationUpdate({ status: 'suspended' }, org, current, now)
    expect(result.ok && result.plan.subscription).toMatchObject({ status: 'suspended', payment_status: null })
  })

  it('el selector la muestra como «internal» y no la manda de nuevo si no cambió', () => {
    const original = { ...org, subscription_status: 'active', payment_status: 'internal' }
    const defaults = organizationEditDefaults(original)
    expect(defaults.status).toBe('internal')
    expect(buildOrganizationPatch(original, defaults)).toEqual({})
  })

  it('no suma al MRR ni a los cobros', () => {
    const prices = { ENTERPRISE: 500000 }
    expect(calculateRecurringRevenue([{ plan: 'ENTERPRISE', status: 'active', paymentStatus: 'internal' }], prices).mrr).toBe(0)
    const billing = computeBillingMetrics([{ organization_id: 'org-1', plan: 'ENTERPRISE', status: 'active', payment_status: 'internal', current_period_ends_at: null }], [], prices, now.getTime())
    expect(billing.mrr).toBe(0)
    expect(billing.uncollectedSubscriptions).toBe(0)
  })

  it('el resumen dice «Cuenta interna»', () => {
    expect(summarizeSubscription({ status: 'active', payment_status: 'internal' }, now)).toMatchObject({ headline: 'Cuenta interna', blocked: false })
  })
})

describe('banner de suscripción', () => {
  it('a una cuenta interna no le pide nada', () => {
    state.value = { ...base, status: 'active', isInternal: true }
    const { container } = render(<SubscriptionBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('al superadmin le muestra el estado, sin pedirle que pague', () => {
    state.value = { ...base, status: null, isBlocked: true, viewerIsSuperAdmin: true }
    render(<SubscriptionBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Vista de superadmin: esta tienda no tiene suscripción')
    expect(screen.queryByText('Renovar plan')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gestionar' })).toHaveAttribute('href', '/superadmin/organizations')
  })

  it('al comercio bloqueado le sigue pidiendo renovar', () => {
    state.value = { ...base, status: 'expired', isBlocked: true }
    render(<SubscriptionBanner />)
    expect(screen.getByRole('link', { name: /Renovar plan/ })).toBeInTheDocument()
  })
})
