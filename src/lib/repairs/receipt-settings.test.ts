import { describe, expect, it } from 'vitest'
import { normalizeRepairReceiptSettings, RepairReceiptSettingsSchema } from './receipt-settings'

describe('repair receipt settings', () => {
  it('fills missing legacy fields with safe defaults', () => {
    const result = normalizeRepairReceiptSettings({ paperFormat: '58mm', showLogo: false })
    expect(result.paperFormat).toBe('58mm')
    expect(result.showLogo).toBe(false)
    expect(result.showFinancialBreakdown).toBe(true)
  })

  it('rejects invalid warranty, logo size and oversized text', () => {
    expect(RepairReceiptSettingsSchema.safeParse({ defaultWarrantyMonths: 50 }).success).toBe(false)
    expect(RepairReceiptSettingsSchema.safeParse({ logoHeight: 500 }).success).toBe(false)
    expect(RepairReceiptSettingsSchema.safeParse({ legalText: 'x'.repeat(3001) }).success).toBe(false)
  })
})
