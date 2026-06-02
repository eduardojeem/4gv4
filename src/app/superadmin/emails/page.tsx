import { createAdminSupabase } from '@/lib/supabase/admin'
import { EmailsDashboard, type EmailTemplate, type EmailActivity, type EmailEnvCheck } from '@/components/superadmin/EmailsDashboard'

const SUPABASE_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'invite',
    name: 'Invitación de usuario',
    description: 'Email que recibe un nuevo owner cuando se crea su organización desde el superadmin.',
    category: 'onboarding',
    trigger: 'auth.admin.inviteUserByEmail()',
    subject: 'Te invitaron a {{ .SiteURL }}',
    variables: ['.Email', '.ConfirmationURL', '.SiteURL', '.Token'],
    enabled: true,
    sentFrom: '/superadmin/organizations/create',
  },
  {
    id: 'signup',
    name: 'Confirmación de registro',
    description: 'Email automático al usuario que se registra desde el formulario público para confirmar su dirección.',
    category: 'auth',
    trigger: 'supabase.auth.signUp()',
    subject: 'Confirmá tu cuenta en {{ .SiteURL }}',
    variables: ['.Email', '.ConfirmationURL', '.SiteURL', '.Token'],
    enabled: true,
    sentFrom: '/register',
  },
  {
    id: 'magic_link',
    name: 'Magic link',
    description: 'Link directo de inicio de sesión sin contraseña enviado al solicitar acceso por email.',
    category: 'auth',
    trigger: 'supabase.auth.signInWithOtp()',
    subject: 'Tu link de acceso a {{ .SiteURL }}',
    variables: ['.Email', '.ConfirmationURL', '.SiteURL', '.Token'],
    enabled: true,
    sentFrom: '/login',
  },
  {
    id: 'recovery',
    name: 'Recuperación de contraseña',
    description: 'Email enviado cuando un usuario solicita resetear su contraseña.',
    category: 'auth',
    trigger: 'supabase.auth.resetPasswordForEmail()',
    subject: 'Recuperá tu contraseña en {{ .SiteURL }}',
    variables: ['.Email', '.ConfirmationURL', '.SiteURL', '.Token'],
    enabled: true,
    sentFrom: '/auth/reset-password',
  },
  {
    id: 'email_change',
    name: 'Cambio de email',
    description: 'Confirmación enviada cuando un usuario cambia su email registrado.',
    category: 'security',
    trigger: 'supabase.auth.updateUser({ email })',
    subject: 'Confirmá el cambio de email',
    variables: ['.Email', '.NewEmail', '.ConfirmationURL'],
    enabled: true,
    sentFrom: '/dashboard/profile',
  },
]

async function getEmailsData() {
  const admin = createAdminSupabase()

  // Eventos relacionados con emails desde audit_log
  const { data: invitations } = await admin
    .from('audit_log')
    .select('id, action, created_at, new_values, user_id')
    .in('action', ['create', 'role_change'])
    .eq('resource', 'organizations')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: logins } = await admin
    .from('audit_log')
    .select('id, action, created_at, user_id')
    .in('action', ['login', 'login_failed', 'password_change'])
    .order('created_at', { ascending: false })
    .limit(20)

  // Cruza con profiles
  const userIds = Array.from(new Set([
    ...(invitations ?? []).map((i) => i.user_id).filter(Boolean),
    ...(logins ?? []).map((l) => l.user_id).filter(Boolean),
  ])) as string[]
  let profilesById = new Map<string, { email: string | null; full_name: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, email, full_name').in('id', userIds)
    profilesById = new Map(
      ((profiles ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>)
        .map((p) => [p.id, { email: p.email, full_name: p.full_name }])
    )
  }

  const recentActivity: EmailActivity[] = [
    ...((invitations ?? []) as Array<{ id: string; action: string; created_at: string | null; new_values: unknown; user_id: string | null }>).map((i) => {
      const profile = i.user_id ? profilesById.get(i.user_id) : null
      const newVals = i.new_values as Record<string, unknown> | null
      return {
        id: i.id,
        type: i.action === 'create' ? 'invite' as const : 'role_change' as const,
        action: i.action,
        createdAt: i.created_at,
        actorName: profile?.full_name ?? null,
        actorEmail: profile?.email ?? null,
        target: typeof newVals?.name === 'string' ? newVals.name : null,
      }
    }),
    ...((logins ?? []) as Array<{ id: string; action: string; created_at: string | null; user_id: string | null }>).map((l) => {
      const profile = l.user_id ? profilesById.get(l.user_id) : null
      return {
        id: l.id,
        type: l.action === 'login' ? 'login' as const
          : l.action === 'login_failed' ? 'login_failed' as const
          : 'password_change' as const,
        action: l.action,
        createdAt: l.created_at,
        actorName: profile?.full_name ?? null,
        actorEmail: profile?.email ?? null,
        target: null,
      }
    }),
  ].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 25)

  // Env / config checks
  const envChecks: EmailEnvCheck[] = [
    {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      label: 'Supabase URL',
      configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      description: 'Endpoint usado para construir links de confirmación',
    },
    {
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      label: 'Service role key',
      configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      description: 'Necesaria para invitar usuarios desde el superadmin',
    },
    {
      key: 'NEXT_PUBLIC_SITE_URL',
      label: 'Site URL público',
      configured: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      description: 'URL base usada en plantillas — afecta los redirects de email',
    },
  ]

  // Stats últimas 24h
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const last24h = recentActivity.filter((a) => a.createdAt && new Date(a.createdAt).getTime() >= dayAgo)
  const invitesLast24h = last24h.filter((a) => a.type === 'invite').length
  const loginsLast24h = last24h.filter((a) => a.type === 'login').length
  const failedLogins24h = last24h.filter((a) => a.type === 'login_failed').length

  return {
    templates: SUPABASE_EMAIL_TEMPLATES,
    activity: recentActivity,
    envChecks,
    stats: {
      totalTemplates: SUPABASE_EMAIL_TEMPLATES.length,
      enabledTemplates: SUPABASE_EMAIL_TEMPLATES.filter((t) => t.enabled).length,
      invitesLast24h,
      loginsLast24h,
      failedLogins24h,
    },
  }
}

export default async function SuperAdminEmailsPage() {
  const data = await getEmailsData()
  return <EmailsDashboard data={data} />
}
