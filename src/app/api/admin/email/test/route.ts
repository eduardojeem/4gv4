import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminAuthContext } from '@/lib/api/withAdminAuth'
import { sendEmail, renderBrandedEmail } from '@/lib/email/resend'

/**
 * POST /api/admin/email/test
 * Sends a branded test email to verify the Resend setup. Admin only.
 * Body: { to: string }
 */
async function handler(request: NextRequest, _ctx: AdminAuthContext) {
  const body = await request.json().catch(() => ({})) as { to?: unknown }
  const to = typeof body.to === 'string' ? body.to.trim() : ''

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: 'Indicá un email válido en "to".' }, { status: 400 })
  }

  const html = renderBrandedEmail({
    title: 'Email de prueba',
    preview: 'Tu integración con Resend funciona.',
    intro: 'Si recibiste este email, el envío transaccional con Resend está configurado correctamente.',
    bodyHtml: '<p>Ya podés cablear eventos reales (reparación lista, pedido confirmado, recibo de venta, etc.).</p>',
    cta: { label: 'Ir al panel', url: process.env.NEXT_PUBLIC_BASE_URL || 'https://4gcelulares.com' },
    footerNote: 'Este es un email de prueba enviado desde la configuración de la plataforma.',
  })

  const result = await sendEmail({ to, subject: 'Prueba de email — Resend', html })

  if (result.skipped) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY no está configurada en el entorno.' },
      { status: 503 }
    )
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'No se pudo enviar el email.' }, { status: 502 })
  }

  return NextResponse.json({ success: true, id: result.id })
}

export function POST(request: NextRequest) {
  return withAdminAuth((req, ctx) => handler(req, ctx))(request)
}
