/**
 * Nombres en castellano de las acciones de auditoría. Módulo puro: lo usan la
 * pantalla de auditoría y el detalle de cada organización.
 */
const ACTION_LABELS: Record<string, string> = {
  login: 'Inicio de sesión',
  login_failed: 'Login fallido',
  logout: 'Cierre de sesión',
  create: 'Creación',
  insert: 'Alta',
  update: 'Actualización',
  delete: 'Eliminación',
  role_change: 'Cambio de rol',
  admin_api_access: 'Acceso a API de administración',
  unauthorized_admin_access_attempt: 'Intento de acceso admin no autorizado',
  permission_denied: 'Permiso denegado',
  password_change: 'Cambio de contraseña',
  grant_admin_self_rpc: 'Auto-promoción a admin',
  grant_admin_migration: 'Promoción a admin',
  update_user_status: 'Cambio de estado de usuario',
  update_admin_user: 'Edición de usuario',
  suspicious_activity: 'Actividad sospechosa',
  data_export: 'Exportación de datos',
  bulk_operation: 'Operación masiva',
  'support.started': 'Soporte iniciado',
  'support.ended': 'Soporte finalizado',
  invite_owner: 'Invitación de dueño',
  'subscription.updated': 'Suscripción actualizada',
  'subscription_plan.created': 'Plan creado',
  'subscription_plan.updated': 'Plan actualizado',
  update_platform_branding: 'Branding de la plataforma',
  update_system_settings: 'Configuración de la plataforma',
  update_organization_settings: 'Configuración de tienda',
  update_website_setting: 'Sitio web de tienda',
  update_website_settings_batch: 'Sitio web de tienda (varios)',
  update_marketplace_announcement: 'Aviso del marketplace',
  send_test_email: 'Email de prueba',
  'notification.created': 'Aviso creado',
  'notification.updated': 'Aviso editado',
  'notification.deleted': 'Aviso eliminado',
  'maintenance.rotate_audit_log': 'Rotación de auditoría',
  'maintenance.reset_db_stats': 'Reinicio de estadísticas de la base',
  'maintenance.delete_orphan_images': 'Borrado de imágenes sin uso',
  publish: 'Publicación',
}

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}
