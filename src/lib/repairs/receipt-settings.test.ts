import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RECEIPT_SETTINGS,
  diffRepairReceiptSettings,
  mergeRepairReceiptSettings,
  normalizeRepairReceiptSettings,
  RepairReceiptSettingsSchema,
} from './receipt-settings'
import { WARRANTY_NOTES_MAX } from './warranty'
import { WarrantySchema } from '@/schemas/repair.schema'

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

  it('explica el error en castellano', () => {
    const result = RepairReceiptSettingsSchema.safeParse({ defaultWarrantyMonths: 50 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('La garantía va de 0 a 36 meses.')
  })
})

describe('lo guardado, campo por campo', () => {
  /**
   * Un solo valor inválido descartaba todo: la empresa volvía a la
   * configuración de fábrica —papel, logo, texto legal— sin aviso.
   */
  it('un campo inválido no borra los demás', () => {
    const result = normalizeRepairReceiptSettings({
      paperFormat: 'A4',
      legalText: 'Nuestro texto legal.',
      logoHeight: 500,
      defaultWarrantyMonths: 6,
    })

    expect(result.paperFormat).toBe('A4')
    expect(result.legalText).toBe('Nuestro texto legal.')
    expect(result.defaultWarrantyMonths).toBe(6)
    expect(result.logoHeight).toBe(DEFAULT_RECEIPT_SETTINGS.logoHeight)
  })

  it('ignora lo que no es un objeto', () => {
    expect(normalizeRepairReceiptSettings(null)).toEqual(DEFAULT_RECEIPT_SETTINGS)
    expect(normalizeRepairReceiptSettings('basura')).toEqual(DEFAULT_RECEIPT_SETTINGS)
    expect(normalizeRepairReceiptSettings([1, 2])).toEqual(DEFAULT_RECEIPT_SETTINGS)
  })

  it('un cambio parcial conserva el resto de lo guardado', () => {
    const guardado = { ...DEFAULT_RECEIPT_SETTINGS, paperFormat: '58mm', legalText: 'Propio.' }
    const result = mergeRepairReceiptSettings(guardado, { defaultWarrantyMonths: 12 })

    expect(result.defaultWarrantyMonths).toBe(12)
    expect(result.paperFormat).toBe('58mm')
    expect(result.legalText).toBe('Propio.')
  })

  it('el diff lleva solo lo que cambió', () => {
    const antes = { ...DEFAULT_RECEIPT_SETTINGS }
    const despues = { ...antes, paperFormat: 'A4' as const, showHash: false }
    expect(diffRepairReceiptSettings(antes, despues)).toEqual({ paperFormat: 'A4', showHash: false })
    expect(diffRepairReceiptSettings(antes, antes)).toEqual({})
  })
})

describe('los límites coinciden con el formulario de reparación', () => {
  /**
   * La nota del taller admitía 1000 caracteres y el formulario validaba 500:
   * una nota larga se aplicaba a cada orden nueva y bloqueaba el alta.
   */
  it('una nota que el taller puede guardar, la acepta el formulario', () => {
    const nota = 'x'.repeat(WARRANTY_NOTES_MAX)
    expect(RepairReceiptSettingsSchema.safeParse({ defaultWarrantyNotes: nota }).success).toBe(true)
    expect(WarrantySchema.safeParse({ warrantyMonths: 3, warrantyType: 'full', warrantyNotes: nota }).success).toBe(true)
  })

  it('y los meses tienen el mismo tope', () => {
    expect(RepairReceiptSettingsSchema.safeParse({ defaultWarrantyMonths: 36 }).success).toBe(true)
    expect(WarrantySchema.safeParse({ warrantyMonths: 36, warrantyType: 'full', warrantyNotes: '' }).success).toBe(true)
    expect(WarrantySchema.safeParse({ warrantyMonths: 37, warrantyType: 'full', warrantyNotes: '' }).success).toBe(false)
  })
})
