import { NextResponse } from 'next/server'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { renderBrandedEmail, sendEmail } from '@/lib/email/resend'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { to?: unknown }
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: 'Ingresa un email valido.' }, { status: 400 })
  }

  const result = await sendEmail({
    to,
    subject: 'Prueba de email - Servix 360',
    html: renderBrandedEmail({
      title: 'Canal de email operativo',
      preview: 'La integracion de email de Servix 360 funciona correctamente.',
      intro: 'Este mensaje confirma que el proveedor Resend esta disponible.',
      bodyHtml: '<p>Los emails transaccionales de la plataforma ya pueden enviarse desde este entorno.</p>',
      brand: { name: 'Servix 360', color: '#4f46e5' },
      footerNote: 'Prueba enviada desde Super Admin.',
    }),
    log: { customerName: `Prueba (${superAdmin.email})` },
  })

  await logSuperAdminAction({
    actorId: superAdmin.id,
    actorEmail: superAdmin.email,
    action: 'send_test_email',
    resource: 'email',
    newValues: { recipient: to, success: result.ok, provider_id: result.id ?? null },
    request,
  })

  if (result.skipped) return NextResponse.json({ error: 'RESEND_API_KEY no esta configurada.' }, { status: 503 })
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'No se pudo enviar el email.' }, { status: 502 })

  return NextResponse.json({ success: true, id: result.id })
}
