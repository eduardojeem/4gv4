import { NextResponse } from 'next/server'

export const TEMPLATE_COLUMNS =
  'id, name, subject, content, channel, category, is_active, created_at, updated_at'

export const CAMPAIGN_COLUMNS =
  'id, name, description, template_id, target_segment, channel, status, scheduled_at, sent_at, recipient_count, sent_count, created_at, updated_at'

export const MESSAGE_COLUMNS =
  'id, campaign_id, customer_id, customer_name, to_email, subject, channel, status, provider_id, error, sent_at'

export function organizationRequiredResponse() {
  return NextResponse.json(
    { error: 'No se pudo resolver la organizacion activa.', code: 'ACTIVE_ORGANIZATION_REQUIRED' },
    { status: 403 },
  )
}

// ---- Plantillas ----
export function templateToClient(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    subject: String(row.subject ?? ''),
    content: String(row.content ?? ''),
    type: String(row.channel ?? 'email'),
    category: String(row.category ?? 'marketing'),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  }
}

export function templateToDb(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {}
  if (body.name !== undefined) payload.name = String(body.name).slice(0, 150)
  if (body.subject !== undefined) payload.subject = String(body.subject ?? '').slice(0, 300)
  if (body.content !== undefined) payload.content = String(body.content ?? '')
  if (body.category !== undefined) payload.category = String(body.category)
  if (body.isActive !== undefined) payload.is_active = Boolean(body.isActive)
  // Canal fijo a email por ahora
  payload.channel = 'email'
  return payload
}

// ---- Campañas ----
export function campaignToClient(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    templateId: row.template_id ? String(row.template_id) : '',
    targetSegment: row.target_segment ? String(row.target_segment) : '',
    channel: String(row.channel ?? 'email'),
    status: String(row.status ?? 'draft'),
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    recipientCount: Number(row.recipient_count ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

export function campaignToDb(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {}
  if (body.name !== undefined) payload.name = String(body.name).slice(0, 150)
  if (body.description !== undefined) payload.description = body.description ? String(body.description) : null
  if (body.templateId !== undefined) payload.template_id = body.templateId ? String(body.templateId) : null
  if (body.targetSegment !== undefined) payload.target_segment = body.targetSegment ? String(body.targetSegment) : null
  if (body.scheduledAt !== undefined) payload.scheduled_at = body.scheduledAt ? String(body.scheduledAt) : null
  if (body.status !== undefined) payload.status = String(body.status)
  payload.channel = 'email'
  return payload
}

export function messageToClient(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    customerId: row.customer_id ? String(row.customer_id) : null,
    customerName: String(row.customer_name ?? ''),
    toEmail: String(row.to_email ?? ''),
    subject: String(row.subject ?? ''),
    type: String(row.channel ?? 'email'),
    status: String(row.status ?? 'sent'),
    sentAt: String(row.sent_at ?? new Date().toISOString()),
  }
}
