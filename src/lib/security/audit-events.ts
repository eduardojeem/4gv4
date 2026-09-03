/**
 * Catalogo de eventos de auditoria: como se llaman en pantalla y que gravedad
 * tienen.
 *
 * Vivia dentro de la ruta de /admin/security y solo se usaba para mostrar. La
 * columna `severity` de `audit_log` la escribe un unico lugar del proyecto —el
 * registro de superadmin—, asi que para todo lo que genera la aplicacion esta
 * en null. La pantalla deducia la gravedad de este mapa para pintarla, pero el
 * filtro consultaba la columna: un evento se veia ALTA y filtrar por alta no lo
 * encontraba nunca.
 *
 * Al estar aca, el mismo mapa sirve para mostrar y para filtrar, que es lo que
 * hace que las dos cosas no puedan volver a discrepar.
 */

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical'

export type AuditEventDefinition = {
  event: string
  severity: AuditSeverity
}

export const AUDIT_EVENTS: Record<string, AuditEventDefinition> = {
  admin_api_access: { event: 'Acceso administrativo', severity: 'low' },
  unauthorized_admin_access_attempt: { event: 'Intento de acceso admin no autorizado', severity: 'high' },
  create: { event: 'Creacion de registro', severity: 'low' },
  update: { event: 'Actualizacion de registro', severity: 'low' },
  delete: { event: 'Eliminacion de registro', severity: 'medium' },
  login: { event: 'Inicio de sesion exitoso', severity: 'low' },
  login_failed: { event: 'Intento de acceso fallido', severity: 'medium' },
  logout: { event: 'Cierre de sesion', severity: 'low' },
  password_change: { event: 'Cambio de contrasena', severity: 'low' },
  role_change: { event: 'Cambio de rol de usuario', severity: 'high' },
  grant_admin_self_rpc: { event: 'Auto-promocion a administrador', severity: 'critical' },
  grant_admin_migration: { event: 'Promocion a administrador', severity: 'high' },
  permission_denied: { event: 'Acceso denegado', severity: 'medium' },
  suspicious_activity: { event: 'Actividad sospechosa detectada', severity: 'high' },
  data_export: { event: 'Exportacion de datos', severity: 'medium' },
  bulk_operation: { event: 'Operacion masiva', severity: 'medium' },
  update_user_status: { event: 'Cambio de estado de usuario', severity: 'high' },
  assign_role_by_email: { event: 'Asignacion de rol por correo', severity: 'high' },
  update_organization_settings: { event: 'Cambio de ajustes del sistema', severity: 'medium' },
}

/** Gravedad por defecto de un evento que todavia no esta en el catalogo. */
export const DEFAULT_AUDIT_SEVERITY: AuditSeverity = 'low'

export function describeAuditEvent(action: string): AuditEventDefinition {
  return AUDIT_EVENTS[action] ?? { event: `Accion: ${action}`, severity: DEFAULT_AUDIT_SEVERITY }
}

export function isAuditSeverity(value: unknown): value is AuditSeverity {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
}

/**
 * Valores que la columna puede tener para una gravedad dada. `info` es un
 * sinonimo historico de `low` que quedo en filas viejas.
 */
export function severityColumnValues(severity: AuditSeverity): string[] {
  return severity === 'low' ? ['low', 'info'] : [severity]
}

/**
 * Acciones cuya gravedad deducida coincide con la pedida.
 *
 * Es la mitad que faltaba del filtro: para las filas cuya columna esta en null
 * —o sea casi todas— la gravedad solo existe como deduccion, asi que hay que
 * buscarlas por su accion.
 */
export function actionsWithSeverity(severity: AuditSeverity): string[] {
  return Object.entries(AUDIT_EVENTS)
    .filter(([, definition]) => definition.severity === severity)
    .map(([action]) => action)
}
