import 'server-only'

export function serviceCreationFailure(error: { code?: string; message?: string }) {
  if (error.code === '55P03') return { status: 409, code: 'SERVICE_BUSY', error: 'Hay otra operación en curso. Reintentá en unos segundos.' }
  if (error.code === 'PGRST202' || error.code === '42883') {
    return { status: 503, code: 'SERVICE_MIGRATION_REQUIRED', error: 'Falta aplicar la migración de alta segura de servicios.' }
  }
  const messages: Record<string, string> = {
    SERVICE_BUSY: 'Hay otra operación en curso. Reintentá en unos segundos.',
    IDEMPOTENCY_CONFLICT: 'Este intento ya se usó con otros datos. Revisá el servicio antes de iniciar otra alta.',
    SERVICE_LIMIT_REACHED: 'Alcanzaste el límite de servicios de tu plan.',
    SERVICE_POLICY_CHANGED: 'Tu plan cambió durante el alta. Reintentá con los mismos datos.',
    INVALID_SERVICE: 'Revisá el nombre, precio y duración del servicio.',
    ACTOR_NOT_AUTHORIZED: 'No tenés permiso para crear servicios en esta organización.',
  }
  const code = Object.keys(messages).find(key => error.message?.includes(key))
  if (code) return { status: code === 'ACTOR_NOT_AUTHORIZED' ? 403 : code === 'INVALID_SERVICE' ? 422 : 409, code, error: messages[code] }
  return { status: 503, code: 'SERVICE_CREATE_FAILED', error: 'No se pudo confirmar el alta. Reintentá con los mismos datos.' }
}
