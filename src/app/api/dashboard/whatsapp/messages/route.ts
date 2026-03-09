import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthResponse, requireStaff } from '@/lib/auth/require-auth'
import { formatWhatsAppPhone } from '@/lib/whatsapp'

type MessageSource = 'manual' | 'bulk' | 'auto'
type MessageTransport = 'cloud' | 'manual'
type MessageStatus = 'pending' | 'sent' | 'failed'

interface SendMessageBody {
  phone?: string
  message?: string
  source?: MessageSource
  transport?: MessageTransport
  customerId?: string | null
  recipientName?: string | null
  metadata?: Record<string, unknown>
}

const SOURCES: MessageSource[] = ['manual', 'bulk', 'auto']
const TRANSPORTS: MessageTransport[] = ['cloud', 'manual']
const STATUSES: MessageStatus[] = ['pending', 'sent', 'failed']

function normalizePhone(phone: string): string {
  return formatWhatsAppPhone(phone).replace(/\D/g, '')
}

function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,%]/g, '').trim()
}

function getCloudApiConfig() {
  const token =
    process.env.WHATSAPP_CLOUD_API_TOKEN ||
    process.env.WHATSAPP_ACCESS_TOKEN ||
    process.env.META_WHATSAPP_ACCESS_TOKEN ||
    ''

  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID ||
    ''

  const apiVersion = process.env.WHATSAPP_CLOUD_API_VERSION || 'v21.0'

  return { token, phoneNumberId, apiVersion }
}

async function sendViaCloud(phone: string, content: string) {
  const { token, phoneNumberId, apiVersion } = getCloudApiConfig()

  if (!token || !phoneNumberId) {
    return { sent: false, reason: 'not_configured', provider: 'whatsapp_cloud' as const }
  }

  const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`

  try {
    const providerResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: {
          preview_url: false,
          body: content,
        },
      }),
    })

    const providerPayload = await providerResponse.json().catch(() => null)

    if (!providerResponse.ok) {
      return {
        sent: false,
        reason: 'provider_error',
        provider: 'whatsapp_cloud' as const,
        providerDetails:
          providerPayload &&
          typeof providerPayload === 'object' &&
          'error' in providerPayload
            ? providerPayload.error
            : providerPayload,
      }
    }

    const messageId =
      Array.isArray(providerPayload?.messages) && providerPayload.messages[0]?.id
        ? providerPayload.messages[0].id
        : null

    return {
      sent: true,
      reason: null,
      provider: 'whatsapp_cloud' as const,
      providerMessageId: messageId,
    }
  } catch {
    return { sent: false, reason: 'network_error', provider: 'whatsapp_cloud' as const }
  }
}

function parseSource(value: string | null | undefined): MessageSource | null {
  if (!value) return null
  return SOURCES.includes(value as MessageSource) ? (value as MessageSource) : null
}

function parseStatus(value: string | null | undefined): MessageStatus | null {
  if (!value) return null
  return STATUSES.includes(value as MessageStatus) ? (value as MessageStatus) : null
}

function parseTransport(value: unknown): MessageTransport {
  if (typeof value !== 'string') return 'cloud'
  return TRANSPORTS.includes(value as MessageTransport) ? (value as MessageTransport) : 'cloud'
}

export async function GET(request: Request) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const { searchParams } = new URL(request.url)
    const search = sanitizeSearchTerm(searchParams.get('search') || '')
    const source = parseSource(searchParams.get('source'))
    const status = parseStatus(searchParams.get('status'))
    const limitRaw = Number(searchParams.get('limit') || '200')
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 1000)) : 200

    const supabase = await createClient()

    let query = supabase
      .from('whatsapp_messages')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (source) {
      query = query.eq('source', source)
    }
    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`phone.ilike.%${search}%,message.ilike.%${search}%,recipient_name.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('WhatsApp messages GET error:', error)
      return NextResponse.json({ ok: false, error: 'No se pudo cargar el historial' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, messages: data || [] })
  } catch (error) {
    console.error('WhatsApp messages GET route error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const userId = auth.authenticated ? auth.user.id : ''

    const body = (await request.json()) as SendMessageBody

    const content = body?.message?.trim() || ''
    if (!content) {
      return NextResponse.json({ ok: false, error: 'missing_content' }, { status: 400 })
    }

    const normalizedPhone = body?.phone ? normalizePhone(body.phone) : ''
    if (!normalizedPhone || normalizedPhone.length < 6) {
      return NextResponse.json({ ok: false, error: 'missing_or_invalid_phone' }, { status: 400 })
    }

    const source = SOURCES.includes(body?.source as MessageSource)
      ? (body?.source as MessageSource)
      : 'manual'

    const transport = parseTransport(body?.transport)

    let sent = false
    let provider: string | null = null
    let providerMessageId: string | null = null
    let reason: string | null = null
    let providerDetails: unknown = null

    if (transport === 'manual') {
      sent = true
      provider = 'wa.me'
      reason = 'manual_opened'
    } else {
      const cloudResult = await sendViaCloud(normalizedPhone, content)
      sent = cloudResult.sent
      provider = cloudResult.provider
      providerMessageId = 'providerMessageId' in cloudResult ? cloudResult.providerMessageId || null : null
      reason = cloudResult.reason
      providerDetails = 'providerDetails' in cloudResult ? cloudResult.providerDetails : null
    }

    const supabase = await createClient()

    const payload = {
      created_by: userId,
      customer_id: body?.customerId || null,
      phone: normalizedPhone,
      recipient_name: body?.recipientName || null,
      message: content,
      source,
      status: sent ? 'sent' : 'failed',
      provider,
      provider_message_id: providerMessageId,
      provider_reason: reason,
      metadata: {
        transport,
        ...(body?.metadata || {}),
        ...(providerDetails ? { providerDetails } : {}),
      },
      sent_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      console.error('WhatsApp messages POST insert error:', error)
      return NextResponse.json({ ok: false, error: 'No se pudo guardar el historial' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      sent,
      reason,
      message: data,
    })
  } catch (error) {
    console.error('WhatsApp messages POST route error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const body = (await request.json()) as {
      id?: string
      status?: 'pending' | 'sent' | 'failed'
      provider?: string | null
      providerReason?: string | null
      metadata?: Record<string, unknown>
    }

    if (!body?.id) {
      return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (body.status && ['pending', 'sent', 'failed'].includes(body.status)) {
      updates.status = body.status
    }
    if (body.provider !== undefined) {
      updates.provider = body.provider
    }
    if (body.providerReason !== undefined) {
      updates.provider_reason = body.providerReason
    }
    if (body.metadata && typeof body.metadata === 'object') {
      updates.metadata = body.metadata
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'no_updates' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('whatsapp_messages')
      .update(updates)
      .eq('id', body.id)
      .select('*')
      .single()

    if (error) {
      console.error('WhatsApp messages PATCH error:', error)
      return NextResponse.json({ ok: false, error: 'No se pudo actualizar el mensaje' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: data })
  } catch (error) {
    console.error('WhatsApp messages PATCH route error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const userId = auth.authenticated ? auth.user.id : ''

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const clearAll = searchParams.get('all') === 'true'

    const supabase = await createClient()

    if (clearAll) {
      const { error } = await supabase
        .from('whatsapp_messages')
        .delete()
        .eq('created_by', userId)

      if (error) {
        console.error('WhatsApp messages DELETE all error:', error)
        return NextResponse.json({ ok: false, error: 'No se pudo limpiar el historial' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    if (!id) {
      return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
    }

    const { error } = await supabase
      .from('whatsapp_messages')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('WhatsApp messages DELETE error:', error)
      return NextResponse.json({ ok: false, error: 'No se pudo eliminar el mensaje' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp messages DELETE route error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
