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
  /** Imprime la dirección de la tienda online (`/{slug}/inicio`) al pie. */
  showStoreWebsite: boolean
  showCustomerSignature: boolean
  legalText: string
  /** Días tras la notificación para considerar abandonado el equipo. 0 = no se imprime. */
  abandonmentDays: number
  defaultWarrantyMonths: number
  defaultWarrantyType: WarrantyType
  defaultWarrantyNotes: string
}

export const RECEIPT_LEGAL_TEXT_MAX = 3000
export const RECEIPT_LOGO_HEIGHT_MIN = 24
export const RECEIPT_LOGO_HEIGHT_MAX = 96
export const RECEIPT_ABANDONMENT_DAYS_MAX = 365

/**
 * Cláusulas que el comprobante agrega solas. Viven acá para que los botones de
 * «insertar cláusula» del diálogo y el comprobante usen el mismo texto: antes
 * tenían redacciones distintas y, si se insertaba una, salía impresa dos veces.
 */
export const abandonmentClause = (days: number) =>
  `Pasados ${days} días de la notificación de retiro, el equipo se considerará abandonado.`
export const PICKUP_CLAUSE = 'Es indispensable presentar este comprobante para retirar el equipo y para reclamar la garantía.'
export const DAMAGE_EXCLUSION_CLAUSE = 'La garantía no cubre golpes, caídas ni daños por líquidos posteriores a la entrega.'
export const DATA_LOSS_CLAUSE = 'El taller no se responsabiliza por la pérdida de datos: se recomienda hacer una copia de seguridad antes de dejar el equipo.'

/**
 * Si un texto ya trata el tema de una cláusula, aunque con otras palabras. La
 * comparación exacta no alcanzaba: «humedad» y «líquidos» decían lo mismo y se
 * imprimían las dos.
 */
export const CLAUSE_TOPICS = {
  abandonment: /abandon/i,
  pickup: /presentar (este|el) comprobante/i,
  damage: /humedad|l[ií]quido|golpe|ca[ií]da/i,
  dataLoss: /p[eé]rdida (de|o da[nñ]o de) (datos|informaci[oó]n)/i,
} as const

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
  showStoreWebsite: false,
  showCustomerSignature: true,
  // Antes decía «declaro haber leído los términos y condiciones», pero esos
  // términos no estaban en el papel: ahora el texto es la condición misma.
  legalText: `Autorizo la revisión y reparación de los equipos detallados y acepto las condiciones de este comprobante. ${DATA_LOSS_CLAUSE}`,
  abandonmentDays: 90,
  defaultWarrantyMonths: 3,
  defaultWarrantyType: 'full',
  // Lo que cubre ya lo dice el tipo de garantía; la nota de fábrica decía
  // «piezas y mano de obra» aunque se eligiera «solo mano de obra».
  defaultWarrantyNotes: DAMAGE_EXCLUSION_CLAUSE,
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
  showStoreWebsite: z.boolean(),
  showCustomerSignature: z.boolean(),
  legalText: z.string().trim()
    .max(RECEIPT_LEGAL_TEXT_MAX, `El texto legal admite hasta ${RECEIPT_LEGAL_TEXT_MAX} caracteres.`),
  abandonmentDays: z.number().int('El plazo de abandono va en días enteros.')
    .min(0, `El plazo de abandono va de 0 a ${RECEIPT_ABANDONMENT_DAYS_MAX} días.`)
    .max(RECEIPT_ABANDONMENT_DAYS_MAX, `El plazo de abandono va de 0 a ${RECEIPT_ABANDONMENT_DAYS_MAX} días.`),
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
  showStoreWebsite: fields.showStoreWebsite.optional(),
  showCustomerSignature: fields.showCustomerSignature.optional(),
  legalText: fields.legalText.optional(),
  abandonmentDays: fields.abandonmentDays.optional(),
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
