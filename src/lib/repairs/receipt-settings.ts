import { z } from 'zod'

export interface RepairReceiptSettings {
  paperFormat: '80mm' | '58mm' | 'A4'
  showLogo: boolean
  monochromeLogo: boolean
  logoHeight: number
  showDeliveryControl: boolean
  showFinancialBreakdown: boolean
  showAccessories: boolean
  showImei: boolean
  showHash: boolean
  showCustomerSignature: boolean
  legalText: string
  defaultWarrantyMonths: number
  defaultWarrantyType: 'labor' | 'parts' | 'full'
  defaultWarrantyNotes: string
}

export const DEFAULT_RECEIPT_SETTINGS: RepairReceiptSettings = {
  paperFormat: '80mm',
  showLogo: true,
  monochromeLogo: true,
  logoHeight: 48,
  showDeliveryControl: true,
  showFinancialBreakdown: true,
  showAccessories: true,
  showImei: true,
  showHash: true,
  showCustomerSignature: true,
  legalText: 'Declaro haber leído y aceptado los términos y condiciones del servicio técnico. Autorizo la revisión y/o reparación de los equipos detallados. La empresa no se responsabiliza por pérdida de datos; se recomienda realizar copias de seguridad.',
  defaultWarrantyMonths: 3,
  defaultWarrantyType: 'full',
  defaultWarrantyNotes: 'Garantía sobre piezas sustituidas y mano de obra. No cubre golpes, caídas ni humedad posteriores a la entrega.',
}

export const RepairReceiptSettingsSchema = z.object({
  paperFormat: z.enum(['80mm', '58mm', 'A4']).optional(),
  showLogo: z.boolean().optional(),
  monochromeLogo: z.boolean().optional(),
  logoHeight: z.number().int().min(24).max(96).optional(),
  showDeliveryControl: z.boolean().optional(),
  showFinancialBreakdown: z.boolean().optional(),
  showAccessories: z.boolean().optional(),
  showImei: z.boolean().optional(),
  showHash: z.boolean().optional(),
  showCustomerSignature: z.boolean().optional(),
  legalText: z.string().trim().max(3000).optional(),
  defaultWarrantyMonths: z.number().int().min(0).max(36).optional(),
  defaultWarrantyType: z.enum(['labor', 'parts', 'full']).optional(),
  defaultWarrantyNotes: z.string().trim().max(1000).optional(),
}).strict()

export function normalizeRepairReceiptSettings(value: unknown): RepairReceiptSettings {
  const parsed = RepairReceiptSettingsSchema.safeParse(value)
  return parsed.success ? { ...DEFAULT_RECEIPT_SETTINGS, ...parsed.data } : { ...DEFAULT_RECEIPT_SETTINGS }
}
