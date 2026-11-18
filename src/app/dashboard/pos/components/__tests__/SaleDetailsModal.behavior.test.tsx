import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const ctx = vi.hoisted(() => ({ org: 'org', branch: 'branch', current: { current: 'user:org' }, get: vi.fn(), print: vi.fn(), can: true }))
vi.mock('@/hooks/useSales', () => ({ useSales: () => ({ getSale: ctx.get }) }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => ({ scope: `user:${ctx.org}`, organizationId: ctx.org, currentScope: ctx.current }) }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useActiveOrganization: () => ({ organization: { id: ctx.org }, isLoading: false }) }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: ctx.branch, branches: [{ id: ctx.branch, name: 'Centro' }] }) }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: { id: 'user', profile: { name: 'Ana' } }, hasPermission: () => ctx.can }) }))
vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useSubscriptionStatus: () => ({ effectiveModules: ['pos', 'crm'] }) }))
vi.mock('@/hooks/use-shared-settings', () => ({ useSharedSettings: () => ({ settings: { companyName: 'Comercio real', companyPhone: '', companyAddress: '', companyEmail: '', companyRuc: '' }, isLoading: false, error: null, scope: 'organization' }) }))
vi.mock('@/lib/receipt-utils', () => ({ printReceipt: ctx.print }))
vi.mock('@/components/dashboard/after-sales/CreateAfterSalesCaseDialog', () => ({ CreateAfterSalesCaseDialog: () => null }))
import { SaleDetailsModal } from '../SaleDetailsModal'
const sale = (id: string) => ({ id, code: `VTA-${id}`, created_at: '2026-11-17T12:00:00Z', total_amount: 100, payment_status: 'partial', created_by: 'user', branch_id: 'branch', sale_items: [], sale_payments: [{ id: 'p', payment_method: 'cash', amount: 100 }] })
beforeEach(() => { vi.clearAllMocks(); ctx.org='org'; ctx.branch='branch'; ctx.current.current='user:org'; ctx.can=true; ctx.get.mockImplementation(async id => sale(id)) })
it('descarta la respuesta tardía de otra venta', async () => {
 let finish!: (data: ReturnType<typeof sale>) => void
 ctx.get.mockImplementationOnce(() => new Promise(resolve => { finish=resolve }))
 const { rerender } = render(<SaleDetailsModal isOpen saleId="a" onClose={() => {}} />)
 rerender(<SaleDetailsModal isOpen saleId="b" onClose={() => {}} />)
 await screen.findByText('VTA-b')
 await act(async () => { finish(sale('a')) })
 expect(screen.queryByText('VTA-a')).toBeNull()
 expect(screen.getByText('VTA-b')).toBeInTheDocument()
})
it('permite reintentar y muestra estados en español', async () => {
 ctx.get.mockResolvedValueOnce(null)
 render(<SaleDetailsModal isOpen saleId="a" onClose={() => {}} />)
 fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
 expect(await screen.findByText('Pago parcial')).toBeInTheDocument()
})
it('imprime solo los contactos reales del comercio', async () => {
 render(<SaleDetailsModal isOpen saleId="a" onClose={() => {}} />)
 fireEvent.click(await screen.findByRole('button', { name: 'Reimprimir copia' }))
 expect(ctx.print).toHaveBeenCalledWith(expect.objectContaining({ isReprint: true, receiptNumber: 'VTA-a' }), expect.objectContaining({ name: 'Comercio real', phone: '', address: '', email: '' }))
})
it('no ofrece acciones de gestión sin permiso', async () => {
 ctx.can=false
 render(<SaleDetailsModal isOpen saleId="a" onClose={() => {}} />)
 await screen.findByText('VTA-a')
 expect(screen.queryByRole('button', { name: 'Más' })).toBeNull()
})
it('no imprime ventas anuladas', async () => {
 ctx.get.mockResolvedValue({ ...sale('a'), status: 'cancelled' })
 render(<SaleDetailsModal isOpen saleId="a" onClose={() => {}} />)
 await waitFor(() => expect(screen.getByRole('button', { name: 'Reimprimir copia' })).toBeDisabled())
 expect(ctx.print).not.toHaveBeenCalled()
})
