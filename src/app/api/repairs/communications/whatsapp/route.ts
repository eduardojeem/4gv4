import { NextResponse } from 'next/server'
import { getAuthResponse, requireStaff } from '@/lib/auth/require-auth'
import { formatWhatsAppPhone } from '@/lib/whatsapp'

type WhatsAppSendBody = {
  repairId?: string
  phone?: string
  content?: string
}

function normalizePhone(phone: string): string {
  return formatWhatsAppPhone(phone).replace(/\D/g, '')
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

export async function POST(request: Request) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const body = (await request.json()) as WhatsAppSendBody
    const content = body?.content?.trim() || ''
    const normalizedPhone = body?.phone ? normalizePhone(body.phone) : ''

    if (!content) {
      return NextResponse.json(
        { ok: false, sent: false, reason: 'missing_content' },
        { status: 400 }
      )
    }

    if (!normalizedPhone || normalizedPhone.length < 6) {
      return NextResponse.json(
        { ok: false, sent: false, reason: 'missing_or_invalid_phone' },
        { status: 400 }
      )
    }

    const { token, phoneNumberId, apiVersion } = getCloudApiConfig()
    if (!token || !phoneNumberId) {
      return NextResponse.json({ ok: true, sent: false, reason: 'not_configured' })
    }

    const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
    const providerResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: content,
        },
      }),
    })

    const providerPayload = await providerResponse.json().catch(() => null)

    if (!providerResponse.ok) {
      return NextResponse.json({
        ok: true,
        sent: false,
        reason: 'provider_error',
        statusCode: providerResponse.status,
        details:
          providerPayload &&
          typeof providerPayload === 'object' &&
          'error' in providerPayload
            ? providerPayload.error
            : providerPayload,
      })
    }

    const messageId =
      Array.isArray(providerPayload?.messages) && providerPayload.messages[0]?.id
        ? providerPayload.messages[0].id
        : null

    return NextResponse.json({
      ok: true,
      sent: true,
      provider: 'whatsapp_cloud',
      messageId,
      repairId: body?.repairId || null,
    })
  } catch (error) {
    console.error('WhatsApp Cloud API route error:', error)
    return NextResponse.json(
      { ok: false, sent: false, reason: 'server_error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const { token, phoneNumberId, apiVersion } = getCloudApiConfig()
    const configured = Boolean(token && phoneNumberId)

    return NextResponse.json({
      ok: true,
      configured,
      apiVersion,
      hasToken: Boolean(token),
      hasPhoneNumberId: Boolean(phoneNumberId),
    })
  } catch (error) {
    console.error('WhatsApp Cloud API status route error:', error)
    return NextResponse.json(
      { ok: false, configured: false, reason: 'server_error' },
      { status: 500 }
    )
  }
}
