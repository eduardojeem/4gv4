import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_RECEIPT_SETTINGS } from '@/lib/repairs/receipt-settings'

const receiptMocks = vi.hoisted(() => ({
  refreshReceiptSettings: vi.fn(),
  patchReceiptSettings: vi.fn(),
  subscribeReceiptSettings: vi.fn(() => () => {}),
}))

vi.mock('@/lib/repair-receipt', () => receiptMocks)

import { useRepairWarrantyPolicy } from './use-repair-warranty-policy'

describe('useRepairWarrantyPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    receiptMocks.subscribeReceiptSettings.mockReturnValue(() => {})
  })

  it('permanece cargando al abrir y no expone 3 meses antes de recibir la política guardada', async () => {
    let resolveSettings: (value: unknown) => void = () => {}
    receiptMocks.refreshReceiptSettings.mockReturnValue(new Promise((resolve) => {
      resolveSettings = resolve
    }))

    const { result, rerender } = renderHook(
      ({ enabled }) => useRepairWarrantyPolicy(enabled),
      { initialProps: { enabled: false } }
    )

    expect(result.current.loading).toBe(true)

    rerender({ enabled: true })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveSettings({
        settings: { ...DEFAULT_RECEIPT_SETTINGS, defaultWarrantyMonths: 1 },
        organizationId: 'org-1',
        persisted: true,
        canEdit: true,
      })
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.policy.months).toBe(1)
  })
})
