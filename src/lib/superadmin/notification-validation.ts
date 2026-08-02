const NOTIFICATION_TYPES = new Set(['info', 'warning', 'success', 'danger'])
const NOTIFICATION_TARGETS = new Set(['all', 'specific'])
const NOTIFICATION_STATUSES = new Set(['draft', 'scheduled', 'sent'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type GlobalNotificationInput = {
  title?: unknown
  body?: unknown
  type?: unknown
  target?: unknown
  target_org_ids?: unknown
  status?: unknown
  scheduled_at?: unknown
}

export type ValidGlobalNotification = {
  title: string
  body: string
  type: 'info' | 'warning' | 'success' | 'danger'
  target: 'all' | 'specific'
  target_org_ids: string[] | null
  status: 'draft' | 'scheduled' | 'sent'
  scheduled_at: string | null
}

export function validateGlobalNotification(
  input: GlobalNotificationInput
): { data: ValidGlobalNotification; error: null } | { data: null; error: string } {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  const type = typeof input.type === 'string' ? input.type : ''
  const target = typeof input.target === 'string' ? input.target : ''
  const status = typeof input.status === 'string' ? input.status : ''

  if (!title || !body) return { data: null, error: 'Titulo y cuerpo son obligatorios.' }
  if (title.length > 160) return { data: null, error: 'El titulo no puede superar 160 caracteres.' }
  if (body.length > 5000) return { data: null, error: 'El cuerpo no puede superar 5000 caracteres.' }
  if (!NOTIFICATION_TYPES.has(type)) return { data: null, error: 'Tipo invalido.' }
  if (!NOTIFICATION_TARGETS.has(target)) return { data: null, error: 'Destino invalido.' }
  if (!NOTIFICATION_STATUSES.has(status)) return { data: null, error: 'Estado invalido.' }

  const targetIds = Array.isArray(input.target_org_ids)
    ? Array.from(new Set(input.target_org_ids.filter((value): value is string => typeof value === 'string')))
    : []

  if (target === 'specific' && targetIds.length === 0) {
    return { data: null, error: 'Selecciona al menos una organizacion.' }
  }
  if (targetIds.some((id) => !UUID_PATTERN.test(id))) {
    return { data: null, error: 'La lista de organizaciones contiene un identificador invalido.' }
  }

  let scheduledAt: string | null = null
  if (status === 'scheduled') {
    if (typeof input.scheduled_at !== 'string' || !input.scheduled_at.trim()) {
      return { data: null, error: 'La fecha de programacion es obligatoria.' }
    }
    const date = new Date(input.scheduled_at)
    if (Number.isNaN(date.getTime())) {
      return { data: null, error: 'La fecha de programacion es invalida.' }
    }
    scheduledAt = date.toISOString()
  }

  return {
    data: {
      title,
      body,
      type: type as ValidGlobalNotification['type'],
      target: target as ValidGlobalNotification['target'],
      target_org_ids: target === 'specific' ? targetIds : null,
      status: status as ValidGlobalNotification['status'],
      scheduled_at: scheduledAt,
    },
    error: null,
  }
}
