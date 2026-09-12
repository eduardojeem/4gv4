import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { DEFAULT_PLATFORM_BRANDING } from '@/lib/platform/branding'
import {
  PLATFORM_ANNOUNCEMENT_TAG,
  getAnnouncementFromFeatures,
  withAnnouncementInFeatures,
} from '@/lib/platform/announcement'
import { normalizeAnnouncement } from '@/lib/announcements/announcement'

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato AAAA-MM-DD').or(z.literal(''))

const announcementSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().max(120),
  message: z.string().trim().max(600),
  imageUrl: z.string().trim().max(500).optional().default(''),
  ctaLabel: z.string().trim().max(60).optional().default(''),
  ctaHref: z.string().trim().max(500).optional().default(''),
  startsAt: dateOnly.optional().default(''),
  endsAt: dateOnly.optional().default(''),
}).superRefine((value, context) => {
  // Un aviso activo sin texto no se mostraria nunca: mejor decirlo al guardar.
  if (value.enabled && !value.title) {
    context.addIssue({ code: 'custom', path: ['title'], message: 'Escribí un título para activarlo' })
  }
  if (value.enabled && !value.message) {
    context.addIssue({ code: 'custom', path: ['message'], message: 'Escribí el mensaje para activarlo' })
  }
  if (value.ctaLabel && !value.ctaHref) {
    context.addIssue({ code: 'custom', path: ['ctaHref'], message: 'El botón necesita un enlace' })
  }
  if (value.ctaHref && !(value.ctaHref.startsWith('/') || /^https?:\/\//i.test(value.ctaHref))) {
    context.addIssue({ code: 'custom', path: ['ctaHref'], message: 'Usá una ruta interna (/productos) o una URL http(s)' })
  }
  if (value.startsAt && value.endsAt && value.startsAt > value.endsAt) {
    context.addIssue({ code: 'custom', path: ['endsAt'], message: 'La fecha de fin es anterior a la de inicio' })
  }
})

export async function GET() {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ success: false, error: 'Acceso denegado.' }, { status: 403 })

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('system_settings')
    .select('features')
    .eq('id', 'system')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ success: false, error: 'No se pudo leer el aviso.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    announcement: getAnnouncementFromFeatures((data as { features?: unknown } | null)?.features),
  })
}

export async function PUT(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ success: false, error: 'Acceso denegado.' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const validation = announcementSchema.safeParse(body?.announcement)

  if (!validation.success) {
    const issue = validation.error.issues[0]
    return NextResponse.json({ success: false, error: issue?.message || 'Datos invalidos.' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: current, error: readError } = await admin
    .from('system_settings')
    .select('features')
    .eq('id', 'system')
    .maybeSingle()

  if (readError) {
    return NextResponse.json({ success: false, error: 'No se pudo leer la configuracion actual.' }, { status: 500 })
  }

  const now = new Date().toISOString()
  // `updatedAt` identifica la version del aviso: al editarlo, quien ya lo habia
  // cerrado vuelve a verlo.
  const announcement = normalizeAnnouncement({ ...validation.data, updatedAt: now })
  const features = withAnnouncementInFeatures((current as { features?: unknown } | null)?.features, announcement)

  const mutation = current
    ? admin
        .from('system_settings')
        .update({ features, updated_by: me.id, updated_at: now })
        .eq('id', 'system')
    : admin
        .from('system_settings')
        .insert({
          id: 'system',
          company_name: DEFAULT_PLATFORM_BRANDING.platformName,
          company_email: '',
          company_phone: '',
          currency: 'PYG',
          tax_rate: 10,
          low_stock_threshold: 5,
          session_timeout: 60,
          auto_backup: false,
          email_notifications: true,
          sms_notifications: false,
          maintenance_mode: false,
          allow_registration: true,
          require_email_verification: false,
          max_login_attempts: 5,
          password_min_length: 8,
          require_two_factor: false,
          features,
          updated_by: me.id,
          updated_at: now,
        })

  const { data, error } = await mutation.select('features').single()

  if (error) {
    return NextResponse.json({ success: false, error: 'No se pudo guardar el aviso.' }, { status: 500 })
  }

  // Sin esto el cartel tardaba hasta cinco minutos en aparecer o desaparecer.
  revalidateTag(PLATFORM_ANNOUNCEMENT_TAG, 'max')

  await logSuperAdminAction({
    actorId: me.id,
    actorEmail: me.email,
    action: 'update_marketplace_announcement',
    resource: 'system_settings',
    resourceId: 'system',
    newValues: { marketplace_announcement: announcement },
    request,
  })

  return NextResponse.json({
    success: true,
    announcement: getAnnouncementFromFeatures((data as { features?: unknown }).features),
  })
}
