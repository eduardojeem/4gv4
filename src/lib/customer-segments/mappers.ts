import { NextResponse } from 'next/server'

// Columnas que se leen/escriben. `rules` guarda el array SegmentRule[] del frontend.
export const SEGMENT_COLUMNS =
  'id, name, description, color, icon, rules, is_active, auto_update, priority, tags, ai_suggested, created_at, updated_at'

export function organizationRequiredResponse() {
  return NextResponse.json(
    { error: 'No se pudo resolver la organizacion activa.', code: 'ACTIVE_ORGANIZATION_REQUIRED' },
    { status: 403 },
  )
}

// Mapea una fila de la DB (snake_case) al formato del frontend (camelCase).
export function toClient(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    color: String(row.color ?? '#45B7D1'),
    icon: row.icon ? String(row.icon) : undefined,
    rules: Array.isArray(row.rules) ? row.rules : [],
    isActive: Boolean(row.is_active),
    autoUpdate: Boolean(row.auto_update),
    priority: Number(row.priority ?? 1),
    tags: Array.isArray(row.tags) ? row.tags : [],
    aiSuggested: Boolean(row.ai_suggested),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  }
}

// Mapea el payload del frontend (camelCase) a columnas de la DB (snake_case).
export function toDbPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {}
  if (body.name !== undefined) payload.name = String(body.name).slice(0, 100)
  if (body.description !== undefined) payload.description = body.description ? String(body.description) : null
  if (body.color !== undefined) payload.color = String(body.color)
  if (body.icon !== undefined) payload.icon = body.icon ? String(body.icon) : null
  if (body.rules !== undefined) payload.rules = Array.isArray(body.rules) ? body.rules : []
  if (body.isActive !== undefined) payload.is_active = Boolean(body.isActive)
  if (body.autoUpdate !== undefined) payload.auto_update = Boolean(body.autoUpdate)
  if (body.priority !== undefined) {
    const p = Number(body.priority)
    payload.priority = Number.isFinite(p) ? Math.min(10, Math.max(1, Math.round(p))) : 1
  }
  if (body.tags !== undefined) payload.tags = Array.isArray(body.tags) ? body.tags : []
  if (body.aiSuggested !== undefined) payload.ai_suggested = Boolean(body.aiSuggested)
  return payload
}
