import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { CreateAfterSalesCaseDialog, evaluateDeadline, type AfterSalesSaleItem } from '../CreateAfterSalesCaseDialog'

let mockSubscription = {
    effectiveModules: ['repairs'],
    tieneTaller: true,
}

vi.mock('@/contexts/SubscriptionStatusContext', () => ({
    useSubscriptionStatus: () => mockSubscription,
}))

describe('evaluateDeadline calculations', () => {
    const saleDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
    const item: AfterSalesSaleItem = {
        id: 'item-1',
        product_id: 'prod-1',
        name: 'Teclado Mecánico',
        quantity: 1,
        unitPrice: 250000,
        warrantyMonths: 3,
        returnWindowDays: 7,
        exchangeWindowDays: 7,
    }

    it('evaluates product warranty as valid within months limit', () => {
        const result = evaluateDeadline(saleDate, 'product_warranty', item)
        expect(result.isExpired).toBe(false)
        expect(result.badgeVariant).toBe('valid')
        expect(result.label).toContain('vigente')
    })

    it('evaluates product warranty as expired when past warranty months', () => {
        const oldSaleDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() // 4 months ago
        const result = evaluateDeadline(oldSaleDate, 'product_warranty', item)
        expect(result.isExpired).toBe(true)
        expect(result.badgeVariant).toBe('expired')
        expect(result.label).toContain('vencida')
    })

    it('evaluates return window as expired when past 7 days', () => {
        const result = evaluateDeadline(saleDate, 'return', item) // 30 days ago > 7 days
        expect(result.isExpired).toBe(true)
        expect(result.badgeVariant).toBe('expired')
        expect(result.label).toContain('vencido')
    })

    it('evaluates return window as valid when within 7 days', () => {
        const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
        const result = evaluateDeadline(recentDate, 'return', item)
        expect(result.isExpired).toBe(false)
        expect(result.badgeVariant).toBe('valid')
    })

    it('evaluates exchange window as expired when past 7 days', () => {
        const result = evaluateDeadline(saleDate, 'exchange', item)
        expect(result.isExpired).toBe(true)
        expect(result.badgeVariant).toBe('expired')
    })
})

describe('CreateAfterSalesCaseDialog warranty validations & workshop gating', () => {
    beforeEach(() => {
        mockSubscription = {
            effectiveModules: ['repairs'],
            tieneTaller: true,
        }
    })

    afterEach(() => {
        cleanup()
    })

    const sampleItems: AfterSalesSaleItem[] = [
        {
            id: 'item-100',
            product_id: 'prod-100',
            name: 'Auriculares Gamer',
            quantity: 1,
            unitPrice: 150000,
            warrantyMonths: 1,
            returnWindowDays: 7,
            exchangeWindowDays: 7,
        },
    ]

    it('hides repair options when organization does not have workshop active (!tieneTaller)', () => {
        mockSubscription = {
            effectiveModules: [],
            tieneTaller: false,
        }

        render(
            <CreateAfterSalesCaseDialog
                open={true}
                onOpenChange={() => {}}
                sourceType="sale"
                allowedRequestTypes={['product_warranty', 'repair_warranty', 'return', 'exchange']}
                saleItems={sampleItems}
                saleId="sale-123"
                reference="POS-999"
            />
        )

        // 'Garantía de reparación' should NOT be present
        expect(screen.queryByText('Garantía de reparación')).toBeNull()
        // 'Garantía de producto' should be present
        expect(screen.getByText('Garantía de producto')).toBeTruthy()
    })

    it('requires explicit consent checkbox when product warranty is expired', async () => {
        // Sale date from 60 days ago, warranty is 1 month (30 days) -> expired!
        const expiredSaleDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

        render(
            <CreateAfterSalesCaseDialog
                open={true}
                onOpenChange={() => {}}
                sourceType="sale"
                saleId="sale-123"
                saleDate={expiredSaleDate}
                reference="POS-999"
                allowedRequestTypes={['product_warranty']}
                saleItems={sampleItems}
            />
        )

        // Should display expired deadline warning
        expect(screen.getByText(/Plazo de garantía \/ devolución vencido/i)).toBeTruthy()

        // Reason input
        const reasonInput = screen.getByLabelText(/Motivo manifestado por el cliente/i)
        fireEvent.change(reasonInput, { target: { value: 'No funciona el auricular izquierdo' } })

        // Submit button should be disabled because warrantyConsent is not checked yet
        const submitButton = screen.getByRole('button', { name: /Registrar Reclamo/i })
        expect(submitButton).toBeDisabled()

        // Check the exception authorization checkbox
        const consentCheckbox = screen.getByRole('checkbox', { name: /Autorizar excepción comercial fuera de plazo/i })
        fireEvent.click(consentCheckbox)

        // Now submit button should be enabled!
        await waitFor(() => {
            expect(submitButton).not.toBeDisabled()
        })
    })
})
