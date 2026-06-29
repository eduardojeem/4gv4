import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { withAdminAuth, AdminAuthContext } from '@/lib/api/withAdminAuth'
import { logger } from '@/lib/logger'
import { sendEmail, renderBrandedEmail } from '@/lib/email/resend'
import { siteUrl } from '@/lib/site-url'

async function handler(
  request: NextRequest,
  context: AdminAuthContext & { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await context.params
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminSupabase()

    // Retrieve user's email and profile details
    const { data: userAuth, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (authError || !userAuth?.user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    const email = userAuth.user.email
    const fullName = userAuth.user.user_metadata?.full_name || ''

    if (!email) {
      return NextResponse.json({ success: false, error: 'El usuario no tiene un email válido' }, { status: 400 })
    }

    // Verify admin has access to this user
    if (context.organizationId && context.user.role !== 'super_admin') {
      const { count } = await supabaseAdmin
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', context.organizationId)
        .eq('user_id', userId)

      if (!count || count === 0) {
        return NextResponse.json({ success: false, error: 'Acceso denegado a este usuario' }, { status: 403 })
      }
    }

    // Generate recovery link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: siteUrl('/auth/callback?next=/auth/reset-password'),
      },
    })

    if (linkError) {
      logger.error('Failed to generate recovery link', { error: linkError })
      return NextResponse.json({ success: false, error: 'No se pudo generar el enlace' }, { status: 500 })
    }

    const inviteLink = (linkData as any)?.properties?.action_link

    if (!inviteLink) {
      return NextResponse.json({ success: false, error: 'No se obtuvo el enlace de Supabase' }, { status: 500 })
    }

    // Send the email
    const html = renderBrandedEmail({
      title: 'Configura tu acceso',
      intro: `Hola${fullName ? ` ${fullName}` : ''}, se ha solicitado reenviar tu enlace de acceso. Por favor, configurá tu contraseña para poder entrar al sistema.`,
      cta: { label: 'Configurar mi contraseña', url: inviteLink },
      footerNote: 'Este enlace expira en 24 horas. Si no solicitaste este acceso, puedes ignorar este mensaje.',
    })

    const { ok, error } = await sendEmail({
      to: email,
      subject: 'Configura tu acceso al sistema',
      html,
      log: {
        organizationId: context.organizationId ?? undefined,
        customerName: fullName || undefined,
      },
    })

    if (!ok && error) {
      logger.error('Failed to send resend-invite email', { error })
      return NextResponse.json({ success: false, error: 'No se pudo enviar el email' }, { status: 500 })
    }

    logger.info('Resent invite email', { adminId: context.user.id, targetUserId: userId })

    return NextResponse.json({ success: true, invite_link: inviteLink })
  } catch (error: any) {
    logger.error('Error resending invite', { error: error?.message })
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> }
) {
  return withAdminAuth((req, authContext) =>
    handler(req, { ...authContext, params: routeContext.params })
  )(request)
}
