import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'fixture-user' } }) }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useOptionalActiveOrganization: () => ({ organization: { id: 'fixture-org' } }) }))
vi.mock('@/contexts/branch-context', () => ({ useOptionalBranch: () => undefined }))
import { CustomerGlobalPaymentModal } from '@/components/dashboard/customers/CustomerGlobalPaymentModal'
import { mapRawToCustomer } from '@/hooks/use-customer-state'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear() })
it('shows an unavailable debt read instead of claiming the customer has no debts', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 500 })))
  render(<CustomerGlobalPaymentModal open customer={mapRawToCustomer({ id: 'fixture-customer', name: 'Cliente' })}
    onClose={() => {}} onSuccess={() => {}} />)
  expect(await screen.findByText('No se pudieron verificar las deudas.')).toBeVisible()
  expect(screen.queryByText('¡El cliente no tiene deudas pendientes!')).not.toBeInTheDocument()
})
