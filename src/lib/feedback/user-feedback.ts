import 'server-only'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { escapeHtml } from '@/lib/html-escape'
import { accountSupportEmail } from '@/lib/account/account-deletion'

/** «Enviar comentarios»: errores, ideas o algo que funciona bien, desde la web y la app. */

export const FEEDBACK_KINDS = ['bug', 'idea', 'praise'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

const KIND_LABELS: Record<FeedbackKind, string> = { bug: 'Error', idea: 'Idea', praise: 'Funciona bien' }
/** Tope por usuario para que un formulario no se use como canal de spam. */
export const FEEDBACK_HOURLY_LIMIT = 10

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(3, 'Contanos un poco más.').max(2000, 'El mensaje es muy largo (máximo 2000 caracteres).'),
  pagePath: z.string().trim().max(300).optional(),
  source: z.enum(['web', 'app']).default('web'),
  appVersion: z.string().trim().max(40).optional(),
}).strict()

export type FeedbackInput = z.infer<typeof feedbackSchema>

export class FeedbackError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function submitUserFeedback(params: FeedbackInput & {
  userId: string
  email: string | null
  organizationId: string | null
  organizationName: string | null
  userAgent: string | null
}) {
  const admin = createAdminSupabase()
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await admin
    .from('user_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', params.userId)
    .gte('created_at', since)
  if (countError) throw new FeedbackError('No se pudo enviar el comentario. Probá de nuevo.', 500)
  if ((count ?? 0) >= FEEDBACK_HOURLY_LIMIT) {
    throw new FeedbackError('Ya mandaste varios comentarios en la última hora. Probá más tarde.', 429)
  }

  const { data, error } = await admin
    .from('user_feedback')
    .insert({
      user_id: params.userId,
      organization_id: params.organizationId,
      kind: params.kind,
      message: params.message,
      page_path: params.pagePath || null,
      source: params.source,
      app_version: params.appVersion || null,
      user_agent: params.userAgent?.slice(0, 300) || null,
    })
    .select('id')
    .single()
  if (error || !data) throw new FeedbackError('No se pudo enviar el comentario. Probá de nuevo.', 500)

  // Aviso a soporte: el comentario ya quedó guardado, si el correo falla no es un error.
  try {
    await sendEmail({
      to: accountSupportEmail(),
      ...(params.email ? { replyTo: params.email } : {}),
      subject: `[Comentario · ${KIND_LABELS[params.kind]}] ${params.organizationName ?? 'Sin comercio'}`,
      html: [
        `<p><strong>${escapeHtml(KIND_LABELS[params.kind])}</strong> desde ${params.source === 'app' ? 'la app' : 'la web'}${params.appVersion ? ` (v${escapeHtml(params.appVersion)})` : ''}</p>`,
        `<p style="white-space:pre-wrap">${escapeHtml(params.message)}</p>`,
        `<p>Usuario: ${escapeHtml(params.email ?? params.userId)}<br>Comercio: ${escapeHtml(params.organizationName ?? '—')}${params.pagePath ? `<br>Pantalla: ${escapeHtml(params.pagePath)}` : ''}</p>`,
      ].join(''),
    })
  } catch (sendError) {
    console.error('[feedback] No se pudo avisar a soporte', { feedbackId: data.id, sendError })
  }

  return { id: data.id as string }
}

// ─── Bandeja de Super Admin ──────────────────────────────────────────────────

export const FEEDBACK_STATUSES = ['new', 'reviewed', 'done'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export type FeedbackFilters = { kind: FeedbackKind | 'all'; status: FeedbackStatus | 'all'; page: number }
export const FEEDBACK_PAGE_SIZE = 25

export type FeedbackEntry = {
  id: string
  kind: FeedbackKind
  status: FeedbackStatus
  message: string
  source: 'web' | 'app'
  pagePath: string | null
  appVersion: string | null
  createdAt: string
  user: { id: string | null; name: string | null; email: string | null }
  organization: { id: string | null; name: string | null }
}

export function parseFeedbackFilters(params: Record<string, string | undefined>): FeedbackFilters {
  const kind = (FEEDBACK_KINDS as readonly string[]).includes(params.tipo ?? '') ? params.tipo as FeedbackKind : 'all'
  const status = (FEEDBACK_STATUSES as readonly string[]).includes(params.estado ?? '') ? params.estado as FeedbackStatus
    : params.estado === 'all' ? 'all' : 'new'
  const page = Math.max(1, Math.min(1000, Number.parseInt(params.pagina ?? '1', 10) || 1))
  return { kind, status, page }
}

type FeedbackRow = {
  id: string; kind: FeedbackKind; status: FeedbackStatus; message: string; source: 'web' | 'app'
  page_path: string | null; app_version: string | null; created_at: string; user_id: string | null; organization_id: string | null
}

export async function getFeedbackInbox(filters: FeedbackFilters) {
  const admin = createAdminSupabase()
  let query = admin
    .from('user_feedback')
    .select('id, kind, status, message, source, page_path, app_version, created_at, user_id, organization_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((filters.page - 1) * FEEDBACK_PAGE_SIZE, filters.page * FEEDBACK_PAGE_SIZE - 1)
  if (filters.kind !== 'all') query = query.eq('kind', filters.kind)
  if (filters.status !== 'all') query = query.eq('status', filters.status)

  const [{ data, count, error }, { data: newRows }] = await Promise.all([
    query,
    admin.from('user_feedback').select('kind').eq('status', 'new').limit(1000),
  ])
  if (error) throw new Error(`No se pudieron leer los comentarios: ${error.message}`)
  const rows = (data ?? []) as FeedbackRow[]

  const userIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))]
  const orgIds = [...new Set(rows.map((row) => row.organization_id).filter((id): id is string => Boolean(id)))]
  const [{ data: profiles }, { data: orgs }] = await Promise.all([
    userIds.length ? admin.from('profiles').select('id, full_name, email').in('id', userIds) : Promise.resolve({ data: [] }),
    orgIds.length ? admin.from('organizations').select('id, name').in('id', orgIds) : Promise.resolve({ data: [] }),
  ])
  const profileById = new Map(((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [p.id, p]))
  const orgById = new Map(((orgs ?? []) as Array<{ id: string; name: string | null }>).map((o) => [o.id, o]))

  const pending = { total: 0, bug: 0, idea: 0, praise: 0 }
  for (const row of (newRows ?? []) as Array<{ kind: FeedbackKind }>) {
    pending.total += 1
    pending[row.kind] += 1
  }

  const entries: FeedbackEntry[] = rows.map((row) => {
    const profile = row.user_id ? profileById.get(row.user_id) : undefined
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      message: row.message,
      source: row.source,
      pagePath: row.page_path,
      appVersion: row.app_version,
      createdAt: row.created_at,
      user: { id: row.user_id, name: profile?.full_name ?? null, email: profile?.email ?? null },
      organization: { id: row.organization_id, name: row.organization_id ? orgById.get(row.organization_id)?.name ?? null : null },
    }
  })

  return { entries, total: count ?? 0, pending }
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus) {
  const { error } = await createAdminSupabase().from('user_feedback').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}
