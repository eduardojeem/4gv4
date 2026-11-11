import { NextResponse } from 'next/server'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { platformEmailLogoUrl, renderBrandedEmail, sendEmail } from '@/lib/email/resend'
import { getPlatformBranding } from '@/lib/platform/branding'
import { rateLimiter } from '@/lib/rate-limiter'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Cada prueba es un envío real de Resend: tope por superadmin para no gastar cupo por error.
const TEST_EMAIL_LIMIT = 5
const TEST_EMAIL_WINDOW_MS = 10 * 60 * 1000

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

  const limitKey = `superadmin-test-email:${superAdmin.id}`
  if (!(await rateLimiter.check(limitKey, TEST_EMAIL_LIMIT, TEST_EMAIL_WINDOW_MS))) {
    const retryAfter = Math.max(rateLimiter.getResetTime(limitKey), 60)
    return NextResponse.json(
      { error: `Ya enviaste ${TEST_EMAIL_LIMIT} pruebas seguidas. Espera unos minutos antes de mandar otra.`, retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  const branding = await getPlatformBranding()
  const result = await sendEmail({
    to,
    subject: `Prueba de email - ${branding.platformName}`,
    html: renderBrandedEmail({
      title: 'Canal de email operativo',
      preview: `La integracion de email de ${branding.platformName} funciona correctamente.`,
      intro: 'Este mensaje confirma que el proveedor Resend esta disponible.',
      bodyHtml: '<p>Los emails transaccionales de la plataforma ya pueden enviarse desde este entorno.</p>',
      brand: { name: branding.platformName, color: '#0284c7', logoUrl: platformEmailLogoUrl() },
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
