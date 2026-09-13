import { z } from 'zod'
import {
  WARRANTY_MONTHS_MAX,
  WARRANTY_MONTHS_MIN,
  WARRANTY_NOTES_MAX,
  type WarrantyType,
} from '@/lib/repairs/warranty'

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
  defaultWarrantyType: WarrantyType
  defaultWarrantyNotes: string
}

export const RECEIPT_LEGAL_TEXT_MAX = 3000
export const RECEIPT_LOGO_HEIGHT_MIN = 24
export const RECEIPT_LOGO_HEIGHT_MAX = 96

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

const fields = {
  paperFormat: z.enum(['80mm', '58mm', 'A4']),
  showLogo: z.boolean(),
  monochromeLogo: z.boolean(),
  logoHeight: z.number().int()
    .min(RECEIPT_LOGO_HEIGHT_MIN, `La altura del logo va de ${RECEIPT_LOGO_HEIGHT_MIN} a ${RECEIPT_LOGO_HEIGHT_MAX} px.`)
    .max(RECEIPT_LOGO_HEIGHT_MAX, `La altura del logo va de ${RECEIPT_LOGO_HEIGHT_MIN} a ${RECEIPT_LOGO_HEIGHT_MAX} px.`),
  showDeliveryControl: z.boolean(),
  showFinancialBreakdown: z.boolean(),
  showAccessories: z.boolean(),
  showImei: z.boolean(),
  showHash: z.boolean(),
  showCustomerSignature: z.boolean(),
  legalText: z.string().trim()
    .max(RECEIPT_LEGAL_TEXT_MAX, `El texto legal admite hasta ${RECEIPT_LEGAL_TEXT_MAX} caracteres.`),
  defaultWarrantyMonths: z.number({ message: 'La duración de la garantía debe ser un número de meses.' }).int('La duración de la garantía va en meses enteros.')
    .min(WARRANTY_MONTHS_MIN, `La garantía va de ${WARRANTY_MONTHS_MIN} a ${WARRANTY_MONTHS_MAX} meses.`)
    .max(WARRANTY_MONTHS_MAX, `La garantía va de ${WARRANTY_MONTHS_MIN} a ${WARRANTY_MONTHS_MAX} meses.`),
  defaultWarrantyType: z.enum(['labor', 'parts', 'full'], { message: 'Elegí un tipo de cobertura válido.' }),
  defaultWarrantyNotes: z.string().trim()
    .max(WARRANTY_NOTES_MAX, `Las notas de garantía admiten hasta ${WARRANTY_NOTES_MAX} caracteres.`),
}

type FieldKey = keyof typeof fields

/**
 * Esquema de lo que se puede enviar a guardar: cualquier subconjunto de campos.
 * Estricto, para que un campo desconocido sea un error y no se ignore callado.
 */
export const RepairReceiptSettingsSchema = z.object({
  paperFormat: fields.paperFormat.optional(),
  showLogo: fields.showLogo.optional(),
  monochromeLogo: fields.monochromeLogo.optional(),
  logoHeight: fields.logoHeight.optional(),
  showDeliveryControl: fields.showDeliveryControl.optional(),
  showFinancialBreakdown: fields.showFinancialBreakdown.optional(),
  showAccessories: fields.showAccessories.optional(),
  showImei: fields.showImei.optional(),
  showHash: fields.showHash.optional(),
  showCustomerSignature: fields.showCustomerSignature.optional(),
  legalText: fields.legalText.optional(),
  defaultWarrantyMonths: fields.defaultWarrantyMonths.optional(),
  defaultWarrantyType: fields.defaultWarrantyType.optional(),
  defaultWarrantyNotes: fields.defaultWarrantyNotes.optional(),
}).strict()

export type RepairReceiptSettingsPatch = z.infer<typeof RepairReceiptSettingsSchema>

/**
 * Lo guardado, campo por campo.
 *
 * Antes se validaba el objeto entero: si un solo valor no pasaba —una nota de
 * garantía de un límite viejo, una altura de logo fuera de rango— se descartaba
 * todo y la empresa volvía a la configuración de fábrica sin aviso. Ahora cada
 * campo inválido cae a su valor por defecto y el resto se conserva.
 */
export function normalizeRepairReceiptSettings(value: unknown): RepairReceiptSettings {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const result = { ...DEFAULT_RECEIPT_SETTINGS } as Record<FieldKey, unknown>

  for (const key of Object.keys(fields) as FieldKey[]) {
    if (!(key in source)) continue
    const parsed = fields[key].safeParse(source[key])
    if (parsed.success) result[key] = parsed.data
  }

  return result as unknown as RepairReceiptSettings
}

/** Aplica un cambio parcial sobre lo guardado. */
export function mergeRepairReceiptSettings(
  current: unknown,
  patch: RepairReceiptSettingsPatch
): RepairReceiptSettings {
  return normalizeRepairReceiptSettings({ ...normalizeRepairReceiptSettings(current), ...patch })
}

/** Solo los campos que cambiaron entre dos configuraciones. */
export function diffRepairReceiptSettings(
  before: RepairReceiptSettings,
  after: RepairReceiptSettings
): RepairReceiptSettingsPatch {
  const patch: Record<string, unknown> = {}
  for (const key of Object.keys(fields) as FieldKey[]) {
    if (before[key] !== after[key]) patch[key] = after[key]
  }
  return patch as RepairReceiptSettingsPatch
}
