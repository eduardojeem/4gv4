import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  EmailsDashboard,
  type EmailConfigCheck,
  type EmailMessage,
  type EmailTemplate,
} from '@/components/superadmin/EmailsDashboard'

const AUTH_TEMPLATES: EmailTemplate[] = [
  {
    id: 'auth-invite',
    name: 'Invitacion de owner',
    description: 'Invita al owner creado desde Super Admin mediante Supabase Auth.',
    category: 'onboarding',
    source: 'supabase',
    trigger: 'auth.admin.inviteUserByEmail()',
    subject: 'Invitacion para acceder a la plataforma',
    variables: ['.Email', '.ConfirmationURL', '.SiteURL', '.Token'],
    enabled: true,
    sentFrom: '/superadmin/organizations/create',
  },
  {
    id: 'auth-signup',
    name: 'Confirmacion de registro',
    description: 'Confirma la direccion del usuario registrado desde el flujo publico.',
    category: 'auth',
    source: 'supabase',
    trigger: 'supabase.auth.signUp()',
    subject: 'Confirma tu cuenta',
    variables: ['.Email', '.ConfirmationURL', '.SiteURL', '.Token'],
    enabled: true,
    sentFrom: '/register',
  },
  {
    id: 'auth-recovery',
    name: 'Recuperacion de contrasena',
    description: 'Permite recuperar el acceso mediante Supabase Auth.',
    category: 'security',
    source: 'supabase',
    trigger: 'supabase.auth.resetPasswordForEmail()',
    subject: 'Recupera tu contrasena',
    variables: ['.Email', '.ConfirmationURL', '.SiteURL', '.Token'],
    enabled: true,
    sentFrom: '/auth/reset-password',
  },
]

const RESEND_TEMPLATES: EmailTemplate[] = [
  {
    id: 'resend-welcome',
    name: 'Bienvenida de empresa',
    description: 'Se envia al completar el registro y aprovisionamiento de una empresa.',
    category: 'onboarding',
    source: 'resend',
    trigger: 'renderWelcomeEmail()',
    subject: 'Bienvenido a la plataforma',
    variables: ['ownerName', 'companyName', 'plan', 'loginUrl'],
    enabled: true,
    sentFrom: '/api/auth/register-company',
  },
  {
    id: 'resend-order',
    name: 'Confirmacion de pedido',
    description: 'Confirma pedidos realizados desde la tienda publica.',
    category: 'transactional',
    source: 'resend',
    trigger: 'renderOrderConfirmationEmail()',
    subject: 'Pedido confirmado',
    variables: ['customerName', 'orderCode', 'items', 'total'],
    enabled: true,
    sentFrom: '/api/orders',
  },
  {
    id: 'resend-payment-reminder',
    name: 'Recordatorio de pago',
    description: 'Notifica creditos activos o vencidos a clientes.',
    category: 'billing',
    source: 'resend',
    trigger: 'renderPaymentReminderEmail()',
    subject: 'Recordatorio de pago',
    variables: ['customerName', 'amount', 'dueDate', 'daysOverdue'],
    enabled: true,
    sentFrom: '/api/credits/send-reminder',
  },
  {
    id: 'resend-campaign',
    name: 'Campana de clientes',
    description: 'Plantilla dinamica usada en campanas segmentadas por tenant.',
    category: 'marketing',
    source: 'resend',
    trigger: 'communication_campaigns',
    subject: 'Definido por la campana',
    variables: ['{nombre}'],
    enabled: true,
    sentFrom: '/api/communications/campaigns/[id]/send',
  },
]

async function getEmailsData() {
  const admin = createAdminSupabase()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    messagesResult,
    sentResult,
    failedResult,
    sent7dResult,
    failed7dResult,
    organizationsResult,
  ] = await Promise.all([
    admin
      .from('communication_messages')
      .select('id, organization_id, customer_name, to_email, subject, html_body, channel, status, provider_id, error, sent_at, created_at')
      .order('sent_at', { ascending: false })
      .limit(500),
    admin
      .from('communication_messages')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', since24h)
      .in('status', ['sent', 'delivered', 'read']),
    admin
      .from('communication_messages')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', since24h)
      .eq('status', 'failed'),
    admin
      .from('communication_messages')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', since7d)
      .in('status', ['sent', 'delivered', 'read']),
    admin
      .from('communication_messages')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', since7d)
      .eq('status', 'failed'),
    admin.from('organizations').select('id, name').order('name'),
  ])

  const warnings = [
    messagesResult.error?.message,
    sentResult.error?.message,
    failedResult.error?.message,
    sent7dResult.error?.message,
    failed7dResult.error?.message,
    organizationsResult.error?.message,
  ].filter((message): message is string => Boolean(message))

  const organizationNames = new Map(
    (organizationsResult.data ?? []).map((organization) => [organization.id, organization.name])
  )

  const messages: EmailMessage[] = (messagesResult.data ?? []).map((message) => ({
    id: message.id,
    organizationId: message.organization_id,
    organizationName: message.organization_id ? (organizationNames.get(message.organization_id) ?? 'Organizacion desconocida') : 'Sistema',
    recipientName: message.customer_name ?? null,
    recipientEmail: message.to_email ?? '',
    subject: message.subject ?? null,
    htmlBody: message.html_body ?? null,
    channel: message.channel,
    status: message.status,
    providerId: message.provider_id ?? null,
    error: message.error ?? null,
    sentAt: message.sent_at ?? message.created_at,
  }))

  const configChecks: EmailConfigCheck[] = [
    {
      key: 'RESEND_API_KEY',
      label: 'Proveedor Resend',
      configured: Boolean(process.env.RESEND_API_KEY?.trim()),
      critical: true,
      description: 'Habilita los emails transaccionales propios de la aplicacion.',
    },
    {
      key: 'EMAIL_FROM',
      label: 'Remitente verificado',
      configured: Boolean(process.env.EMAIL_FROM?.trim()),
      critical: false,
      description: 'Evita utilizar el remitente de pruebas onboarding@resend.dev.',
    },
    {
      key: 'EMAIL_REPLY_TO',
      label: 'Email de respuesta',
      configured: Boolean(process.env.EMAIL_REPLY_TO?.trim()),
      critical: false,
      description: 'Direccion que recibira las respuestas de clientes.',
    },
    {
      key: 'NEXT_PUBLIC_APP_URL',
      label: 'URL publica de la app',
      configured: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()),
      critical: true,
      description: 'Se usa para generar enlaces validos dentro de los emails.',
    },
    {
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      label: 'Invitaciones Supabase',
      configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      critical: true,
      description: 'Necesaria para invitar owners desde Super Admin.',
    },
  ]

  const sent24h = sentResult.count ?? 0
  const failed24h = failedResult.count ?? 0
  const total24h = sent24h + failed24h
  const sent7d = sent7dResult.count ?? 0
  const failed7d = failed7dResult.count ?? 0
  const total7d = sent7d + failed7d

  const organizations = (organizationsResult.data ?? []).map((org) => ({ id: org.id, name: org.name }))

  return {
    templates: [...AUTH_TEMPLATES, ...RESEND_TEMPLATES].map((template) => ({
      ...template,
      enabled: template.source === 'resend'
        ? Boolean(process.env.RESEND_API_KEY?.trim())
        : Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    })),
    messages,
    configChecks,
    warnings,
    organizations,
    stats: {
      sent24h,
      failed24h,
      successRate: total24h > 0 ? Math.round((sent24h / total24h) * 100) : null,
      sent7d,
      failed7d,
      successRate7d: total7d > 0 ? Math.round((sent7d / total7d) * 100) : null,
      totalMessages: messages.length,
    },
  }
}

export default async function SuperAdminEmailsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseProjectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  return <EmailsDashboard data={await getEmailsData()} supabaseProjectRef={supabaseProjectRef} />
}
