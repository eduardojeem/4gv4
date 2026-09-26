import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ExpensesPanel } from './ExpensesPanel'
import { ProfitabilityPanel } from './ProfitabilityPanel'

const filters = { startDate: '2026-09-01', endDate: '2026-09-30' }
it('sends search to the server and opens overdue across periods', async () => {
  const fetcher = vi.fn(async (_url: string) => new Response(JSON.stringify({ categories: [], obligations: [], total: 0 })))
  vi.stubGlobal('fetch', fetcher)
  render(<ExpensesPanel organizationId="org" branchId="branch" filters={filters} onChanged={vi.fn()} action={{ mode: 'overdue', nonce: 1 }} />)
  await userEvent.setup().type(screen.getByRole('searchbox'), 'Alquiler')
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes('search=Alquiler') && String(url).includes('dueView=overdue') && !String(url).includes('startDate='))).toBe(true))
})

it('offers a safe error if profitability connection fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  render(<ProfitabilityPanel organizationId="org" filters={filters} />)
  expect(await screen.findByText(/No se pudo conectar para cargar la rentabilidad/)).toBeInTheDocument()
})
