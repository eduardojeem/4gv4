import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

const VALID_CHANNELS = new Set(['whatsapp', 'email', 'sms', 'in_app'])
const VALID_STATUSES = new Set(['pending', 'sent', 'failed'])

type CommunicationBody = {
  repairId?: string
  channel?: string
  content?: string
  templateId?: string | null
  status?: string
  toEmail?: string | null
}

// Registra un mensaje de comunicación de una reparación.
// A diferencia del insert directo por cliente, aquí seteamos organization_id
// desde la reparación, de modo que el mensaje sea visible en las analíticas
// de comunicaciones a nivel organización (no queda huérfano de org).
export const POST = withTenantAuth({}, async (req, { organization }) => {
  try {
    const body = (await req.json().catch(() => ({}))) as CommunicationBody
    const { repairId, channel, content, templateId, status, toEmail } = body

    if (!repairId || !channel || !content?.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }
    if (!VALID_CHANNELS.has(channel)) {
      return NextResponse.json({ ok: false, error: 'Invalid channel' }, { status: 400 })
    }

    const admin = createAdminSupabase()

    // La reparación debe pertenecer a la organización del usuario.
    const { data: repair, error: repairError } = await admin
      .from('repairs')
      .select('id, customer_id')
      .eq('id', repairId)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (repairError) throw repairError
    if (!repair) {
      return NextResponse.json({ ok: false, error: 'Repair not found' }, { status: 404 })
    }

    const safeStatus = VALID_STATUSES.has(status ?? '') ? status : 'sent'

    const { data, error } = await admin
      .from('communication_messages')
      .insert({
        repair_id: repairId,
        organization_id: organization.id,
        customer_id: repair.customer_id ?? null,
        channel,
        content: content.trim(),
        template_id: templateId ?? null,
        // to_email solo aplica al canal email; en WhatsApp/SMS queda null.
        to_email: channel === 'email' ? (toEmail?.trim() || null) : null,
        status: safeStatus,
        direction: 'outbound',
        sent_at: new Date().toISOString(),
      })
      .select('id, status, sent_at')
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, message: data })
  } catch (error) {
    logger.error('repairs/communications insert error', { error })
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
})

// Historial de mensajes de la organización (opcionalmente filtrado por reparación).
export const GET = withTenantAuth({}, async (req, { organization }) => {
  try {
    const { searchParams } = new URL(req.url)
    const repairId = searchParams.get('repairId')

    const admin = createAdminSupabase()
    let query = admin
      .from('communication_messages')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })

    if (repairId) {
      query = query.eq('repair_id', repairId)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ ok: true, messages: data ?? [] })
  } catch (error) {
    logger.error('repairs/communications list error', { error })
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
})

// Actualiza el estado de un mensaje (p.ej. confirmar que se envió manualmente).
export const PATCH = withTenantAuth({}, async (req, { organization }) => {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string }
    if (!body.id || !VALID_STATUSES.has(body.status ?? '')) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }

    const admin = createAdminSupabase()
    const { error } = await admin
      .from('communication_messages')
      .update({ status: body.status })
      .eq('id', body.id)
      .eq('organization_id', organization.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('repairs/communications update error', { error })
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
})
