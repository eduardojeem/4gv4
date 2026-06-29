import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { organizationRequiredResponse } from '@/lib/communications/mappers'
import { sendEmail, renderBrandedEmail, isResendConfigured } from '@/lib/email/resend'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_RECIPIENTS = 500

interface Recipient {
  id?: string
  name?: string
  email?: string
}

// Reemplaza tokens {nombre} en el texto. Tolerante a mayúsculas/espacios.
function fillTokens(text: string, name: string): string {
  return text.replace(/\{\s*nombre\s*\}/gi, name || 'cliente')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse
  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)
  if (!organization) return organizationRequiredResponse()

  if (!isResendConfigured()) {
    return NextResponse.json(
      { error: 'El envío de email no está configurado (falta RESEND_API_KEY).' },
      { status: 503 },
    )
  }

  try {
    const { id: campaignId } = await params
    const body = (await request.json()) as { recipients?: Recipient[] }
    const rawRecipients = Array.isArray(body.recipients) ? body.recipients : []

    // Sanitiza y deduplica por email
    const seen = new Set<string>()
    const recipients = rawRecipients
      .map(r => ({ id: r.id, name: (r.name || '').trim(), email: (r.email || '').trim().toLowerCase() }))
      .filter(r => {
        if (!EMAIL_RE.test(r.email) || seen.has(r.email)) return false
        seen.add(r.email)
        return true
      })
      .slice(0, MAX_RECIPIENTS)

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No hay destinatarios con email válido.' }, { status: 400 })
    }

    const supabase = createAdminSupabase()

    // Carga la campaña (validando organización) y su plantilla
    const { data: campaign, error: campaignError } = await supabase
      .from('communication_campaigns')
      .select('id, name, template_id, organization_id')
      .eq('id', campaignId)
      .eq('organization_id', organization.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
    }

    let subjectTpl = campaign.name as string
    let contentTpl = ''
    if (campaign.template_id) {
      const { data: template } = await supabase
        .from('communication_templates')
        .select('subject, content')
        .eq('id', campaign.template_id)
        .eq('organization_id', organization.id)
        .single()
      if (template) {
        subjectTpl = (template.subject as string) || subjectTpl
        contentTpl = (template.content as string) || ''
      }
    }

    // Marca la campaña como "enviando"
    await supabase
      .from('communication_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId)
      .eq('organization_id', organization.id)

    const brandName = (organization as { name?: string }).name || 'Servix360'
    let sentCount = 0
    const messageRows: Record<string, unknown>[] = []

    for (const r of recipients) {
      const subject = fillTokens(subjectTpl, r.name)
      const bodyText = fillTokens(contentTpl, r.name)
      const html = renderBrandedEmail({
        title: subject,
        bodyHtml: bodyText
          ? bodyText.split('\n').map(l => `<p style="margin:0 0 12px;">${l}</p>`).join('')
          : '',
        brand: { name: brandName },
        footerNote: 'Recibís este mensaje porque sos cliente de ' + brandName + '.',
      })

      const result = await sendEmail({ to: r.email, subject, html })
      const ok = result.ok
      if (ok) sentCount++

      messageRows.push({
        organization_id: organization.id,
        campaign_id: campaignId,
        customer_id: r.id || null,
        customer_name: r.name || null,
        to_email: r.email,
        subject,
        html_body: html,
        channel: 'email',
        status: ok ? 'sent' : 'failed',
        provider_id: result.id || null,
        error: ok ? null : result.error || 'Error de envío',
      })
    }

    // Registra el historial
    if (messageRows.length > 0) {
      await supabase.from('communication_messages').insert(messageRows)
    }

    // Estado final de la campaña
    const finalStatus = sentCount === 0 ? 'failed' : 'sent'
    await supabase
      .from('communication_campaigns')
      .update({
        status: finalStatus,
        sent_at: new Date().toISOString(),
        recipient_count: recipients.length,
        sent_count: sentCount,
      })
      .eq('id', campaignId)
      .eq('organization_id', organization.id)

    return NextResponse.json({
      success: sentCount > 0,
      sent: sentCount,
      failed: recipients.length - sentCount,
      total: recipients.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
