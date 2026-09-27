import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SourceDetailDialog } from '../SourcesBrowser'

describe('SourceDetailDialog', () => {
    it('renders sale detail modal (POS-...) with customer, items, and action buttons', () => {
        const onReprint = vi.fn()
        const onClaim = vi.fn()
        const onClose = vi.fn()

        const saleDetail = {
            type: 'sale' as const,
            paymentStatus: 'paid',
            sale: {
                id: 'sale-1',
                code: 'POS-1788315099099-632A8733',
                total: 250000,
                subtotal: 250000,
                tax: 0,
                discount: 0,
                paymentMethod: 'cash',
                paymentStatus: 'paid',
                createdAt: '2026-09-10T12:00:00Z',
                createdByName: 'Cajero Juan',
                customer: {
                    name: 'Carlos Benítez',
                    phone: '0981 123 456',
                    email: 'carlos@example.com',
                },
                items: [
                    {
                        id: 'item-1',
                        name: 'Funda Silicona iPhone 13',
                        sku: 'SKU-FUND-13',
                        quantity: 2,
                        unitPrice: 50000,
                        discount: 0,
                        total: 100000,
                    },
                    {
                        id: 'item-2',
                        name: 'Cargador Rápido 20W',
                        sku: 'SKU-CARG-20W',
                        quantity: 1,
                        unitPrice: 150000,
                        discount: 0,
                        total: 150000,
                    },
                ],
                payments: [
                    { method: 'cash', amount: 250000 },
                ],
            },
        }

        render(
            <SourceDetailDialog
                detail={saleDetail}
                onClose={onClose}
                onReprint={onReprint}
                onClaim={onClaim}
            />
        )

        expect(screen.getByText(/POS-1788315099099-632A8733/)).toBeInTheDocument()
        expect(screen.getAllByText(/Carlos Benítez/).length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText(/0981 123 456/).length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('Funda Silicona iPhone 13')).toBeInTheDocument()
        expect(screen.getByText('Cargador Rápido 20W')).toBeInTheDocument()

        const reprintBtn = screen.getByRole('button', { name: /reimprimir comprobante/i })
        expect(reprintBtn).toBeInTheDocument()
        fireEvent.click(reprintBtn)
        expect(onReprint).toHaveBeenCalledTimes(1)

        const claimBtn = screen.getByRole('button', { name: /iniciar devolución \/ cambio/i })
        expect(claimBtn).toBeInTheDocument()
        fireEvent.click(claimBtn)
        expect(onClaim).toHaveBeenCalledTimes(1)
    })

    it('renders repair detail modal (REP-...) with device, problem, warranty status, and claim action', () => {
        const onClaim = vi.fn()
        const onClose = vi.fn()

        const repairDetail = {
            type: 'repair' as const,
            id: 'rep-83',
            label: 'REP-000083',
            status: 'entregado',
            device: 'Samsung Galaxy A54',
            problem: 'Cambio de módulo táctil por rotura',
            total: 380000,
            paidAmount: 380000,
            warrantyMonths: 3,
            warrantyType: 'completa',
            warrantyExpiresAt: '2026-12-31T23:59:59Z',
            deliveredAt: '2026-09-01T15:00:00Z',
            createdAt: '2026-08-28T10:00:00Z',
            customer: {
                name: 'María Gómez',
                phone: '0971 999 888',
                email: 'maria@example.com',
            },
        }

        render(
            <SourceDetailDialog
                detail={repairDetail}
                onClose={onClose}
                onClaim={onClaim}
            />
        )

        expect(screen.getByText(/REP-000083/)).toBeInTheDocument()
        expect(screen.getByText('Samsung Galaxy A54')).toBeInTheDocument()
        expect(screen.getByText('Cambio de módulo táctil por rotura')).toBeInTheDocument()
        expect(screen.getAllByText(/María Gómez/).length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText(/3 meses/i)).toBeInTheDocument()

        const claimBtn = screen.getByRole('button', { name: /iniciar reclamo de garantía/i })
        expect(claimBtn).toBeInTheDocument()
        fireEvent.click(claimBtn)
        expect(onClaim).toHaveBeenCalledTimes(1)
    })
})
