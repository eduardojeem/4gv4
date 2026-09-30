import { createAdminSupabase } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'

/**
 * Datos de /superadmin/communications (antes /superadmin/notifications y
 * /superadmin/emails). Todo se lee en el servidor con la service role.
 */

export type AnnouncementType = 'info' | 'warning' | 'success' | 'danger'
export type AnnouncementStatus = 'draft' | 'scheduled' | 'sent'

export interface Announcement {
  id: string
  title: string
  body: string
  type: AnnouncementType
  target: 'all' | 'specific'
  targetOrgIds: string[]
  status: AnnouncementStatus
  scheduledAt: string | null
  sentAt: string | null
  createdAt: string
  /** Usuarios que la abrieron / la descartaron (global_notification_reads). */
  readCount: number
  dismissedCount: number
}

export interface MessageLogEntry {
  id: string
  organizationName: string
  recipientName: string | null
  recipient: string
  subject: string | null
  channel: string
  status: string
  error: string | null
  sentAt: string
}

export interface ChannelStats {
  channel: string
  sent: number
  failed: number
}

export interface EmailConfigCheck {
  key: string
  label: string
  configured: boolean
  critical: boolean
  description: string
}

export interface EmailTemplateInfo {
  id: string
  name: string
  description: string
  provider: 'supabase' | 'resend'
  trigger: string
  sentFrom: string
  /** Si el proveedor que la envía está configurado en este entorno. */
  available: boolean
}

export interface CommunicationsData {
  announcements: Announcement[]
  organizations: Array<{ id: string; name: string }>
  messages: MessageLogEntry[]
  channelStats: ChannelStats[]
  failedLast7Days: number
  emailChecks: EmailConfigCheck[]
  templates: EmailTemplateInfo[]
  supabaseProjectRef: string | null
  loadErrors: string[]
}

/**
 * Plantillas que la app envía hoy. Las de Supabase se editan en el dashboard
 * de Supabase (Auth → Email Templates); las de Resend están en src/lib/email.
 */
const TEMPLATE_REGISTRY: Array<Omit<EmailTemplateInfo, 'available'>> = [
  { id: 'auth-invite', name: 'Invitación de owner', description: 'Invita al dueño de una empresa creada desde SuperAdmin.', provider: 'supabase', trigger: 'auth.admin.inviteUserByEmail()', sentFrom: '/superadmin/organizations/create' },
  { id: 'auth-signup', name: 'Confirmación de registro', description: 'Confirma el email de quien se registra en /register.', provider: 'supabase', trigger: 'supabase.auth.signUp()', sentFrom: '/register' },
  { id: 'auth-recovery', name: 'Recuperación de contraseña', description: 'Enlace para restablecer la contraseña.', provider: 'supabase', trigger: 'resetPasswordForEmail()', sentFrom: '/auth/reset-password' },
  { id: 'resend-welcome', name: 'Bienvenida de empresa', description: 'Se envía al terminar el alta de una empresa.', provider: 'resend', trigger: 'renderWelcomeEmail()', sentFrom: '/api/auth/register-company' },
  { id: 'resend-order', name: 'Confirmación de pedido', description: 'Confirma pedidos de la tienda online.', provider: 'resend', trigger: 'renderOrderConfirmationEmail()', sentFrom: '/api/orders' },
  { id: 'resend-payment-reminder', name: 'Recordatorio de pago', description: 'Avisa a clientes con cuotas de crédito pendientes.', provider: 'resend', trigger: 'renderPaymentReminderEmail()', sentFrom: '/api/credits/send-reminder' },
  { id: 'resend-campaign', name: 'Campañas de las tiendas', description: 'Mensajes que cada tienda envía a sus clientes.', provider: 'resend', trigger: 'communication_campaigns', sentFrom: '/api/communications/campaigns/[id]/send' },
]

const configured = (key: string) => Boolean(process.env[key]?.trim())

export async function getCommunicationsData(): Promise<CommunicationsData> {
  const admin = createAdminSupabase()
  const loadErrors: string[] = []

  // Mismo paso que hace la bandeja de las tiendas (/api/notifications): publica
  // las programadas cuya hora ya llegó, para que acá se vea el estado real.
  const dispatch = await admin.rpc('dispatch_due_global_notifications')
  if (dispatch.error) loadErrors.push(`No se pudieron publicar las programadas vencidas: ${dispatch.error.message}`)

  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const [announcementsResult, organizationsResult, messagesResult, failedResult, reads] = await Promise.all([
    admin
      .from('global_notifications')
      .select('id, title, body, type, target, target_org_ids, status, scheduled_at, sent_at, created_at')
      .order('created_at', { ascending: false })
      .limit(300),
    admin.from('organizations').select('id, name').order('name'),
    admin
      .from('communication_messages')
      .select('id, organization_id, customer_name, to_email, subject, channel, status, error, sent_at, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('communication_messages')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', since7d),
    fetchAllRows<{ notification_id: string; dismissed: boolean }>((from, to) =>
      admin.from('global_notification_reads').select('notification_id, dismissed').range(from, to) as never,
    ).catch((error: Error) => {
      loadErrors.push(`Lecturas: ${error.message}`)
      return []
    }),
  ])

  for (const [label, result] of [
    ['Avisos', announcementsResult],
    ['Organizaciones', organizationsResult],
    ['Mensajes', messagesResult],
  ] as const) {
    if (result.error) loadErrors.push(`${label}: ${result.error.message}`)
  }

  const readStats = new Map<string, { read: number; dismissed: number }>()
  for (const r of reads) {
    const stat = readStats.get(r.notification_id) ?? { read: 0, dismissed: 0 }
    stat.read += 1
    if (r.dismissed) stat.dismissed += 1
    readStats.set(r.notification_id, stat)
  }

  const organizations = ((organizationsResult.data ?? []) as Array<{ id: string; name: string }>)
  const orgNames = new Map(organizations.map((o) => [o.id, o.name]))

  const announcements: Announcement[] = ((announcementsResult.data ?? []) as Array<Record<string, unknown>>).map((n) => {
    const id = String(n.id)
    return {
      id,
      title: String(n.title ?? ''),
      body: String(n.body ?? ''),
      type: (n.type ?? 'info') as AnnouncementType,
      target: n.target === 'specific' ? 'specific' : 'all',
      targetOrgIds: Array.isArray(n.target_org_ids) ? (n.target_org_ids as string[]) : [],
      status: (n.status ?? 'draft') as AnnouncementStatus,
      scheduledAt: (n.scheduled_at as string | null) ?? null,
      sentAt: (n.sent_at as string | null) ?? null,
      createdAt: String(n.created_at ?? ''),
      readCount: readStats.get(id)?.read ?? 0,
      dismissedCount: readStats.get(id)?.dismissed ?? 0,
    }
  })

  const messageRows = (messagesResult.data ?? []) as Array<{
    id: string; organization_id: string | null; customer_name: string | null; to_email: string | null
    subject: string | null; channel: string; status: string; error: string | null; sent_at: string | null; created_at: string
  }>
  const messages: MessageLogEntry[] = messageRows.map((m) => ({
    id: m.id,
    organizationName: m.organization_id ? orgNames.get(m.organization_id) ?? 'Empresa eliminada' : 'Plataforma',
    recipientName: m.customer_name,
    recipient: m.to_email ?? '—',
    subject: m.subject,
    channel: m.channel,
    status: m.status,
    error: m.error,
    sentAt: m.sent_at ?? m.created_at,
  }))

  const statsMap = new Map<string, ChannelStats>()
  for (const m of messages) {
    const stat = statsMap.get(m.channel) ?? { channel: m.channel, sent: 0, failed: 0 }
    if (m.status === 'failed') stat.failed += 1
    else stat.sent += 1
    statsMap.set(m.channel, stat)
  }

  const resendReady = configured('RESEND_API_KEY')
  const supabaseReady = configured('NEXT_PUBLIC_SUPABASE_URL') && configured('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return {
    announcements,
    organizations,
    messages,
    channelStats: [...statsMap.values()].sort((a, b) => b.sent + b.failed - (a.sent + a.failed)),
    failedLast7Days: failedResult.count ?? 0,
    emailChecks: [
      { key: 'RESEND_API_KEY', label: 'Proveedor de email (Resend)', configured: resendReady, critical: true, description: 'Sin esto no salen los emails propios: bienvenida, pedidos, recordatorios y campañas.' },
      { key: 'EMAIL_FROM', label: 'Remitente verificado', configured: configured('EMAIL_FROM'), critical: false, description: 'Sin esto se usa el remitente de pruebas de Resend, que suele caer en spam.' },
      { key: 'EMAIL_REPLY_TO', label: 'Dirección de respuesta', configured: configured('EMAIL_REPLY_TO'), critical: false, description: 'A dónde llegan las respuestas de los clientes.' },
      { key: 'NEXT_PUBLIC_APP_URL', label: 'URL pública de la app', configured: configured('NEXT_PUBLIC_APP_URL') || configured('APP_URL'), critical: true, description: 'Se usa para armar los enlaces dentro de los emails.' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Invitaciones de Supabase', configured: supabaseReady, critical: true, description: 'Necesaria para invitar dueños de empresa desde SuperAdmin.' },
    ],
    templates: TEMPLATE_REGISTRY.map((t) => ({ ...t, available: t.provider === 'resend' ? resendReady : supabaseReady })),
    supabaseProjectRef: supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null,
    loadErrors,
  }
}

/** Contenido completo de un mensaje (se pide al abrirlo, no en el listado). */
export async function getMessageContent(id: string): Promise<{ html: string | null; providerId: string | null } | null> {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('communication_messages')
    .select('html_body, provider_id')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  const row = data as { html_body: string | null; provider_id: string | null }
  return { html: row.html_body, providerId: row.provider_id }
}
