import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { AfterSalesDashboard } from '../AfterSalesDashboard'

vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/contexts/SubscriptionStatusContext', () => ({
    useSubscriptionStatus: () => ({ tieneTaller: true }),
}))

vi.mock('@/components/dashboard/common/SectionGuideButton', () => ({
    SectionGuideButton: () => <button>Guía</button>,
}))

vi.mock('../CreateAfterSalesCaseDialog', () => ({
    CreateAfterSalesCaseDialog: () => null,
}))

describe('AfterSalesDashboard validations upon completion', () => {
    const mockCase = {
        id: 'case-1',
        case_number: 'CASO-0001',
        request_type: 'return',
        source_type: 'sale',
        status: 'approved',
        reason: 'Producto defectuoso',
        notes: null,
        quantity: 1,
        product_id: 'prod-1',
        sale_id: 'sale-1',
        repair_id: null,
        generated_repair_id: null,
        created_at: '2026-09-10T10:00:00Z',
        resolved_at: null,
        sales: {
            code: 'POS-12345',
            total_amount: 100000,
            created_at: '2026-09-09T10:00:00Z',
        },
        products: {
            name: 'Auriculares Bluetooth',
            sku: 'AURI-BT',
            image_url: null,
        },
        customers: {
            name: 'Ana López',
            phone: '0981 555 666',
        },
    }

    function createFetchMock(cases: any[] = [mockCase]) {
        return vi.fn().mockImplementation((input: RequestInfo | URL) => {
            const url = String(input)
            if (url.includes('/api/after-sales/summary')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        success: true,
                        data: { open: 0, approved: 1, completed: 0, rejected: 0, refunds: 0, quarantined: 0 },
                    }),
                })
            }
            if (url.includes('/api/after-sales')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        success: true,
                        data: cases,
                        pagination: { total: cases.length },
                    }),
                })
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        }) as unknown as typeof fetch
    }

    beforeEach(() => {
        vi.restoreAllMocks()
        global.fetch = createFetchMock([mockCase])
    })

    afterEach(() => {
        cleanup()
    })

    it('blocks confirmation when refund amount is entered without selecting refund method', async () => {
        render(<AfterSalesDashboard />)

        await waitFor(() => {
            expect(screen.getByText('CASO-0001')).toBeInTheDocument()
        })

        const completeBtn = screen.getByRole('button', { name: /marcar completado/i })
        fireEvent.click(completeBtn)

        await waitFor(() => {
            expect(screen.getByText(/marcar completado caso CASO-0001/i)).toBeInTheDocument()
        })

        const confirmBtn = screen.getByRole('button', { name: /confirmar/i })
        expect(confirmBtn).not.toBeDisabled()

        const refundInput = screen.getByLabelText(/monto a reintegrar/i)
        fireEvent.change(refundInput, { target: { value: '50000' } })

        // refund > 0 without method -> disabled
        expect(confirmBtn).toBeDisabled()
        expect(screen.getByText(/selección requerida/i)).toBeInTheDocument()

        const cashBtn = screen.getByRole('button', { name: /por caja/i })
        fireEvent.click(cashBtn)

        expect(confirmBtn).not.toBeDisabled()
    })

    it('blocks confirmation when refund amount exceeds original sale total', async () => {
        render(<AfterSalesDashboard />)

        await waitFor(() => {
            expect(screen.getByText('CASO-0001')).toBeInTheDocument()
        })

        const completeBtn = screen.getByRole('button', { name: /marcar completado/i })
        fireEvent.click(completeBtn)

        await waitFor(() => {
            expect(screen.getByText(/marcar completado caso CASO-0001/i)).toBeInTheDocument()
        })

        const refundInput = screen.getByLabelText(/monto a reintegrar/i)
        fireEvent.change(refundInput, { target: { value: '150000' } })

        const cashBtn = screen.getByRole('button', { name: /por caja/i })
        fireEvent.click(cashBtn)

        const confirmBtn = screen.getByRole('button', { name: /confirmar/i })
        expect(confirmBtn).toBeDisabled()
        expect(screen.getByText(/supera el total original de la operación/i)).toBeInTheDocument()
    })

    it('blocks confirmation if pending rework repair in workshop is not consented', async () => {
        const reworkCase = {
            ...mockCase,
            source_type: 'repair',
            request_type: 'repair_warranty',
            generated_repair: {
                ticket_number: 'REP-000099',
                status: 'en_reparacion',
            },
        }

        global.fetch = createFetchMock([reworkCase])

        render(<AfterSalesDashboard />)

        await waitFor(() => {
            expect(screen.getByText('CASO-0001')).toBeInTheDocument()
        })

        const completeBtn = screen.getByRole('button', { name: /marcar completado/i })
        fireEvent.click(completeBtn)

        await waitFor(() => {
            expect(screen.getByText(/el retrabajo en taller todavía no fue entregado/i)).toBeInTheDocument()
        })

        const confirmBtn = screen.getByRole('button', { name: /confirmar/i })
        expect(confirmBtn).toBeDisabled()

        const checkbox = screen.getByRole('checkbox')
        fireEvent.click(checkbox)

        expect(confirmBtn).not.toBeDisabled()
    })

    it('blocks rejection if reason is shorter than 5 characters', async () => {
        const openCase = {
            ...mockCase,
            status: 'open',
        }

        global.fetch = createFetchMock([openCase])

        render(<AfterSalesDashboard />)

        await waitFor(() => {
            expect(screen.getByText('CASO-0001')).toBeInTheDocument()
        })

        const rejectBtn = screen.getByRole('button', { name: /rechazar/i })
        fireEvent.click(rejectBtn)

        await waitFor(() => {
            expect(screen.getByLabelText(/motivo del rechazo/i)).toBeInTheDocument()
        })

        const confirmBtn = screen.getByRole('button', { name: /confirmar/i })
        expect(confirmBtn).toBeDisabled()

        const reasonInput = screen.getByLabelText(/motivo del rechazo/i)
        fireEvent.change(reasonInput, { target: { value: 'No' } })
        expect(confirmBtn).toBeDisabled()

        fireEvent.change(reasonInput, { target: { value: 'Fuera de plazo de garantía' } })
        expect(confirmBtn).not.toBeDisabled()
    })
})
