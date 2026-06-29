import { Resend } from 'resend'

/**
 * Transactional email via Resend.
 *
 * Safe by design: if RESEND_API_KEY isn't configured, sendEmail() becomes a
 * logged no-op (returns { skipped: true }) instead of throwing — so wiring it
 * into a flow never breaks that flow before email is set up.
 */

let client: Resend | null = null

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return null
  if (!client) client = new Resend(apiKey)
  return client
}

/** Resend's shared testing sender — works without verifying a domain. */
const DEFAULT_FROM = 'onboarding@resend.dev'

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  /** Overrides EMAIL_FROM, e.g. `Mi Tienda <noreply@midominio.com>`. */
  from?: string
  replyTo?: string
  /**
   * When provided, logs the send attempt to communication_messages.
   * Requires the 20260612 + 20260625 migrations to be applied.
   */
  log?: {
    organizationId?: string
    customerId?: string
    customerName?: string
    campaignId?: string
  }
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  /** true when no API key is configured and the send was skipped. */
  skipped?: boolean
  error?: string
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const resend = getClient()
  const from = params.from || process.env.EMAIL_FROM?.trim() || DEFAULT_FROM
  const replyTo = params.replyTo || process.env.EMAIL_REPLY_TO?.trim()

  if (!resend) {
    console.warn('[email] RESEND_API_KEY no configurada — email omitido', {
      to: params.to,
      subject: params.subject,
    })
    if (params.log) {
      void logEmailMessage({
        ...params.log,
        to: params.to,
        subject: params.subject,
        html: params.html,
        status: 'failed',
        error: 'RESEND_API_KEY no configurada',
      })
    }
    return { ok: false, skipped: true }
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo,
    })

    if (error) {
      console.error('[email] Resend error:', error)
      if (params.log) {
        void logEmailMessage({
          ...params.log,
          to: params.to,
          subject: params.subject,
          html: params.html,
          status: 'failed',
          error: error.message,
        })
      }
      return { ok: false, error: error.message }
    }

    if (params.log) {
      void logEmailMessage({
        ...params.log,
        to: params.to,
        subject: params.subject,
        html: params.html,
        status: 'sent',
        providerId: data?.id,
      })
    }
    return { ok: true, id: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[email] send failed:', err)
    if (params.log) {
      void logEmailMessage({
        ...params.log,
        to: params.to,
        subject: params.subject,
        html: params.html,
        status: 'failed',
        error: message,
      })
    }
    return { ok: false, error: message }
  }
}

/** Fire-and-forget: inserta una fila en communication_messages. */
async function logEmailMessage(opts: {
  organizationId?: string
  customerId?: string
  customerName?: string
  campaignId?: string
  to: string | string[]
  subject: string
  html: string
  status: 'sent' | 'failed'
  error?: string
  providerId?: string
}) {
  try {
    const { createAdminSupabase } = await import('@/lib/supabase/admin')
    const admin = createAdminSupabase()
    const recipients = Array.isArray(opts.to) ? opts.to : [opts.to]
    const { error } = await admin.from('communication_messages').insert(
      recipients.map((email) => ({
        organization_id: opts.organizationId ?? null,
        campaign_id: opts.campaignId ?? null,
        customer_id: opts.customerId ?? null,
        customer_name: opts.customerName ?? null,
        to_email: email,
        subject: opts.subject,
        content: '',
        html_body: opts.html,
        channel: 'email',
        status: opts.status,
        provider_id: opts.providerId ?? null,
        error: opts.error ?? null,
      }))
    )
    if (error) console.error('[email] logEmailMessage insert error:', error.message, error.details)
  } catch (err) {
    console.error('[email] logEmailMessage failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Branded HTML template (inline styles + table layout for email clients)
// ---------------------------------------------------------------------------

export interface BrandedEmailOptions {
  /** Big heading at the top of the card. */
  title: string
  /** Hidden preview text shown in the inbox list. */
  preview?: string
  /** Optional lead paragraph under the title. */
  intro?: string
  /** Trusted HTML for the body (already safe — do not pass user input unescaped). */
  bodyHtml?: string
  /** Optional call-to-action button. */
  cta?: { label: string; url: string }
  brand?: {
    name?: string
    logoUrl?: string
    /** Hex accent color, e.g. '#2563eb'. */
    color?: string
  }
  /** Small grey note under the card. */
  footerNote?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderBrandedEmail(opts: BrandedEmailOptions): string {
  const accent = opts.brand?.color || '#2563eb'
  const brandName = opts.brand?.name || 'Tienda'
  const logo = opts.brand?.logoUrl
    ? `<img src="${escapeHtml(opts.brand.logoUrl)}" alt="${escapeHtml(brandName)}" width="40" height="40" style="border-radius:8px;display:block;" />`
    : ''
  const preview = opts.preview ? escapeHtml(opts.preview) : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:${accent};padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                ${logo ? `<td style="padding-right:10px;">${logo}</td>` : ''}
                <td style="color:#ffffff;font-size:16px;font-weight:700;">${escapeHtml(brandName)}</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(opts.title)}</h1>
              ${opts.intro ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">${escapeHtml(opts.intro)}</p>` : ''}
              ${opts.bodyHtml ? `<div style="font-size:15px;line-height:1.6;color:#334155;">${opts.bodyHtml}</div>` : ''}
              ${opts.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr><td style="border-radius:10px;background:${accent};">
                <a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(opts.cta.label)}</a>
              </td></tr></table>` : ''}
            </td>
          </tr>
          ${opts.footerNote ? `<tr><td style="padding:0 28px 24px;"><p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">${escapeHtml(opts.footerNote)}</p></td></tr>` : ''}
        </table>
        <p style="max-width:520px;margin:16px auto 0;font-size:11px;color:#94a3b8;text-align:center;">
          Enviado por ${escapeHtml(brandName)}.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Maps the app's named brand colors to hex for use in emails. */
export const BRAND_COLOR_HEX: Record<string, string> = {
  blue: '#2563eb', green: '#16a34a', purple: '#9333ea', orange: '#ea580c',
  red: '#dc2626', indigo: '#4f46e5', teal: '#0d9488', rose: '#e11d48',
  amber: '#d97706', emerald: '#059669', cyan: '#0891b2', sky: '#0284c7',
}
