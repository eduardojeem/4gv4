import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { siteUrl } from '@/lib/site-url'
import { sendEmail, renderBrandedEmail } from '@/lib/email/resend'
import { canCreateResource } from '@/lib/saas/subscription-service'

export const dynamic = 'force-dynamic'
const inviteSchema = z.object({ professionalId: z.string().uuid(), email: z.string().trim().email().toLowerCase(), sendEmailInvite: z.boolean().default(true) })
export const POST = withTenantAuth({ permission: 'users.manage', module: 'services' }, async (request, { organization, user }) => {
  if (!['owner', 'admin'].includes(organization.role)) return NextResponse.json({ error: 'Solo un administrador puede invitar empleados.' }, { status: 403 })
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisá el profesional y su correo electrónico.' }, { status: 400 })
  const { professionalId, email, sendEmailInvite } = parsed.data
  const admin = createAdminSupabase()
  const { data: target, error: targetError } = await admin.rpc('agenda_invite_target', { p_org: organization.id, p_prof: professionalId, p_email: email, p_actor: user.id })
  if (targetError) return NextResponse.json({ error: 'No se pudo comprobar la invitación. Verificá que la actualización de Agenda esté aplicada.' }, { status: 503 })
  if (!target) return NextResponse.json({ error: 'Profesional no encontrado.' }, { status: 404 })
  if (target.user_id && !target.is_member) return NextResponse.json({ error: 'Esta cuenta ya existe y no es un empleado activo del negocio. Incorporala desde la administración de usuarios.' }, { status: 409 })
  if (target.linked_user_id && target.linked_user_id !== target.user_id) return NextResponse.json({ error: 'El profesional ya está vinculado a otra cuenta. Revisá el vínculo antes de invitar.' }, { status: 409 })
  let userId: string = target.user_id
  let accessUrl = siteUrl('/login?next=/dashboard/agenda')
  const isNewUser = !userId
  const needsActivation = isNewUser || target.needs_activation === true
  if (needsActivation) {
    // Activation links only travel to the account's email, never to the inviter.
    if (!sendEmailInvite) return NextResponse.json({ error: 'Para una cuenta nueva es obligatorio enviar la activación por correo.' }, { status: 422 })
    const quota = isNewUser ? await canCreateResource(organization.id, 'users') : {allowed:true}
    if (!quota.allowed) return NextResponse.json({ error: 'Se alcanzó el límite de usuarios del plan.' }, { status: 403 })
    const { data, error } = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo: siteUrl('/auth/callback?next=/dashboard/agenda'), data: { full_name: target.name } } })
    if (error || !data?.user || !data.properties?.action_link) return NextResponse.json({ error: 'No se pudo crear la invitación. Revisá el correo e intentá nuevamente.' }, { status: 409 })
    userId = data.user.id
    accessUrl = data.properties.action_link
  }
  const { error: linkError } = await admin.rpc('link_agenda_employee_checked', { p_org: organization.id, p_prof: professionalId, p_user: userId, p_email: email, p_actor: user.id, p_new: isNewUser })
  if (linkError) return NextResponse.json({ error: 'No se pudo vincular la cuenta. Revisá el empleado desde la administración de usuarios.' }, { status: 409 })
  let emailSent = false
  if (sendEmailInvite) {
    const delivery = await sendEmail({ to: email, subject: `Acceso al equipo de ${organization.name}`, html: renderBrandedEmail({ title: 'Acceso a tu agenda', intro: `Te sumaron al equipo de ${organization.name}.`, cta: { label: needsActivation ? 'Activar mi cuenta' : 'Entrar', url: accessUrl } }) }).catch(() => ({ ok: false }))
    emailSent = delivery.ok
  }
  const loginUrl = siteUrl('/login?next=/dashboard/agenda')
  const text = `Ya podés acceder a la agenda de ${organization.name}: ${loginUrl}${needsActivation ? '\nRevisá tu correo para activar la cuenta.' : ''}`
  return NextResponse.json({ success: true, userId, email, isNewUser, emailSent, inviteLink: loginUrl, whatsappUrl: `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, message: emailSent ? 'Correo enviado. El enlace compartible abre el inicio de sesión.' : 'Cuenta vinculada. El correo no se envió; revisá el servicio de correo antes de reenviar el acceso.' })
})
