import { z } from 'zod'

/**
 * Esquema de validación para System Settings
 * Asegura que todos los valores sean válidos antes de guardar
 */

export const SystemSettingsSchema = z.object({
  // Información de la empresa
  companyName: z.string()
    .min(1, 'El nombre de la empresa es obligatorio')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  
  companyEmail: z.string()
    .email('Formato de email inválido')
    .min(1, 'El email es obligatorio'),
  
  companyPhone: z.string()
    .min(1, 'El teléfono es obligatorio')
    .max(50, 'El teléfono no puede exceder 50 caracteres')
    .trim(),
  
  companyAddress: z.string()
    .max(500, 'La dirección no puede exceder 500 caracteres')
    .optional()
    .default(''),
  
  city: z.string()
    .max(100, 'La ciudad no puede exceder 100 caracteres')
    .optional()
    .default(''),
  
  // Configuración general
  currency: z.enum(['PYG', 'USD', 'EUR', 'MXN'], {
    errorMap: () => ({ message: 'Moneda no válida' })
  }),
  
  taxRate: z.number()
    .min(0, 'La tasa de impuesto no puede ser negativa')
    .max(100, 'La tasa de impuesto no puede exceder 100%')
    .finite('La tasa debe ser un número válido'),
  
  lowStockThreshold: z.number()
    .int('Debe ser un número entero')
    .min(1, 'El umbral debe ser al menos 1')
    .max(1000, 'El umbral no puede exceder 1000'),
  
  sessionTimeout: z.number()
    .int('Debe ser un número entero')
    .min(5, 'El timeout debe ser al menos 5 minutos')
    .max(480, 'El timeout no puede exceder 480 minutos (8 horas)'),
  
  // Opciones del sistema
  autoBackup: z.boolean(),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  maintenanceMode: z.boolean(),
  
  // Seguridad
  allowRegistration: z.boolean(),
  requireEmailVerification: z.boolean(),
  
  maxLoginAttempts: z.number()
    .int('Debe ser un número entero')
    .min(1, 'Debe permitir al menos 1 intento')
    .max(10, 'No puede exceder 10 intentos'),
  
  passwordMinLength: z.number()
    .int('Debe ser un número entero')
    .min(6, 'La longitud mínima debe ser al menos 6')
    .max(32, 'La longitud mínima no puede exceder 32'),
  
  requireTwoFactor: z.boolean()
})

export type SystemSettings = z.infer<typeof SystemSettingsSchema>

/**
 * Esquema para actualizaciones parciales
 */
export const SystemSettingsPartialSchema = SystemSettingsSchema.partial()

export type SystemSettingsPartial = z.infer<typeof SystemSettingsPartialSchema>

/**
 * Esquema para mapear de DB a frontend
 */
export const SystemSettingsDBSchema = z.object({
  id: z.string(),
  company_name: z.string(),
  company_email: z.string(),
  company_phone: z.string(),
  company_address: z.string().nullable(),
  city: z.string().nullable(),
  currency: z.string(),
  tax_rate: z.union([z.string(), z.number()]),
  low_stock_threshold: z.number(),
  session_timeout: z.number(),
  auto_backup: z.boolean(),
  email_notifications: z.boolean(),
  sms_notifications: z.boolean(),
  maintenance_mode: z.boolean(),
  allow_registration: z.boolean(),
  require_email_verification: z.boolean(),
  max_login_attempts: z.number(),
  password_min_length: z.number(),
  require_two_factor: z.boolean(),
  updated_at: z.string().optional(),
  updated_by: z.string().optional()
})

/**
 * Convierte datos de DB a formato frontend
 */
export function mapDBToSettings(dbData: z.infer<typeof SystemSettingsDBSchema>): SystemSettings {
  return {
    companyName: dbData.company_name,
    companyEmail: dbData.company_email,
    companyPhone: dbData.company_phone,
    companyAddress: dbData.company_address || '',
    city: dbData.city || '',
    currency: dbData.currency as 'PYG' | 'USD' | 'EUR' | 'MXN',
    taxRate: typeof dbData.tax_rate === 'string' ? parseFloat(dbData.tax_rate) : dbData.tax_rate,
    lowStockThreshold: dbData.low_stock_threshold,
    sessionTimeout: dbData.session_timeout,
    autoBackup: dbData.auto_backup,
    emailNotifications: dbData.email_notifications,
    smsNotifications: dbData.sms_notifications,
    maintenanceMode: dbData.maintenance_mode,
    allowRegistration: dbData.allow_registration,
    requireEmailVerification: dbData.require_email_verification,
    maxLoginAttempts: dbData.max_login_attempts,
    passwordMinLength: dbData.password_min_length,
    requireTwoFactor: dbData.require_two_factor
  }
}

/**
 * Convierte datos de frontend a formato DB
 */
export function mapSettingsToDB(settings: SystemSettingsPartial): Record<string, any> {
  const dbData: Record<string, any> = {}
  
  if (settings.companyName !== undefined) dbData.company_name = settings.companyName
  if (settings.companyEmail !== undefined) dbData.company_email = settings.companyEmail
  if (settings.companyPhone !== undefined) dbData.company_phone = settings.companyPhone
  if (settings.companyAddress !== undefined) dbData.company_address = settings.companyAddress
  if (settings.city !== undefined) dbData.city = settings.city
  if (settings.currency !== undefined) dbData.currency = settings.currency
  if (settings.taxRate !== undefined) dbData.tax_rate = settings.taxRate
  if (settings.lowStockThreshold !== undefined) dbData.low_stock_threshold = settings.lowStockThreshold
  if (settings.sessionTimeout !== undefined) dbData.session_timeout = settings.sessionTimeout
  if (settings.autoBackup !== undefined) dbData.auto_backup = settings.autoBackup
  if (settings.emailNotifications !== undefined) dbData.email_notifications = settings.emailNotifications
  if (settings.smsNotifications !== undefined) dbData.sms_notifications = settings.smsNotifications
  if (settings.maintenanceMode !== undefined) dbData.maintenance_mode = settings.maintenanceMode
  if (settings.allowRegistration !== undefined) dbData.allow_registration = settings.allowRegistration
  if (settings.requireEmailVerification !== undefined) dbData.require_email_verification = settings.requireEmailVerification
  if (settings.maxLoginAttempts !== undefined) dbData.max_login_attempts = settings.maxLoginAttempts
  if (settings.passwordMinLength !== undefined) dbData.password_min_length = settings.passwordMinLength
  if (settings.requireTwoFactor !== undefined) dbData.require_two_factor = settings.requireTwoFactor
  
  return dbData
}

/**
 * Esquema para acciones del sistema
 */
export const SystemActionSchema = z.enum([
  'backup',
  'clearCache',
  'checkIntegrity',
  'testEmail'
], {
  errorMap: () => ({ message: 'Acción no válida' })
})

export type SystemAction = z.infer<typeof SystemActionSchema>

/**
 * Validar y sanitizar configuración importada
 */
export function validateImportedSettings(data: unknown): SystemSettings {
  try {
    // Validar esquema
    const validated = SystemSettingsSchema.parse(data)
    
    // Sanitizar strings (remover HTML, scripts, etc.)
    return {
      ...validated,
      companyName: sanitizeString(validated.companyName),
      companyEmail: sanitizeString(validated.companyEmail),
      companyPhone: sanitizeString(validated.companyPhone),
      companyAddress: sanitizeString(validated.companyAddress || ''),
      city: sanitizeString(validated.city || '')
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      throw new Error(`Validación fallida: ${firstError.path.join('.')}: ${firstError.message}`)
    }
    throw error
  }
}

/**
 * Sanitizar string (remover HTML, scripts, etc.)
 */
function sanitizeString(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}
