import { createClient } from '@/lib/supabase/client'

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AuditLogEntry {
  action: 'update' | 'import' | 'export' | 'system_action'
  fieldName?: string
  oldValue?: any
  newValue?: any
  severity?: AuditSeverity
  details?: Record<string, any>
}

export interface FieldChange {
  field: string
  oldValue: any
  newValue: any
}

/**
 * Registra un evento en el audit log
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createClient()
    
    // Obtener información del cliente
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown'
    
    const { error } = await supabase
      .from('system_settings_audit')
      .insert({
        action: entry.action,
        field_name: entry.fieldName,
        old_value: entry.oldValue !== undefined ? entry.oldValue : null,
        new_value: entry.newValue !== undefined ? entry.newValue : null,
        severity: entry.severity || 'medium',
        user_agent: userAgent,
        details: entry.details || {}
      })
    
    if (error) {
      console.error('Error logging audit event:', error)
    }
  } catch (error) {
    console.error('Failed to log audit event:', error)
  }
}

/**
 * Obtiene los campos que cambiaron entre dos objetos
 */
export function getChangedFields<T extends Record<string, any>>(
  oldObj: T,
  newObj: Partial<T>
): FieldChange[] {
  const changes: FieldChange[] = []
  
  for (const key in newObj) {
    if (newObj[key] !== undefined && oldObj[key] !== newObj[key]) {
      changes.push({
        field: key,
        oldValue: oldObj[key],
        newValue: newObj[key]
      })
    }
  }
  
  return changes
}

/**
 * Determina la severidad de un cambio basado en el campo
 */
export function determineSeverity(fieldName: string): AuditSeverity {
  // Campos críticos
  const criticalFields = [
    'maintenanceMode',
    'allowRegistration',
    'requireTwoFactor'
  ]
  
  // Campos de alta prioridad
  const highFields = [
    'maxLoginAttempts',
    'passwordMinLength',
    'requireEmailVerification',
    'sessionTimeout'
  ]
  
  // Campos de prioridad media
  const mediumFields = [
    'taxRate',
    'currency',
    'lowStockThreshold',
    'autoBackup'
  ]
  
  if (criticalFields.includes(fieldName)) {
    return 'critical'
  } else if (highFields.includes(fieldName)) {
    return 'high'
  } else if (mediumFields.includes(fieldName)) {
    return 'medium'
  } else {
    return 'low'
  }
}

/**
 * Obtiene el historial de cambios de configuración
 */
export async function getSettingsHistory(limit: number = 50) {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('system_settings_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching settings history:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Failed to fetch settings history:', error)
    return []
  }
}

/**
 * Obtiene cambios por campo específico
 */
export async function getFieldHistory(fieldName: string, limit: number = 20) {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('system_settings_audit')
      .select('*')
      .eq('field_name', fieldName)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching field history:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Failed to fetch field history:', error)
    return []
  }
}

/**
 * Obtiene cambios críticos recientes
 */
export async function getCriticalChanges(days: number = 7) {
  try {
    const supabase = createClient()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    const { data, error } = await supabase
      .from('system_settings_audit')
      .select('*')
      .eq('severity', 'critical')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching critical changes:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Failed to fetch critical changes:', error)
    return []
  }
}
