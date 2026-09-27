import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { DEFAULT_PLATFORM_BRANDING } from '@/lib/platform/branding'
import {
  PLATFORM_ANNOUNCEMENT_TAG,
  getAnnouncementsFromFeatures,
  withAnnouncementsInFeatures,
} from '@/lib/platform/announcement'
import { MAX_PLATFORM_ANNOUNCEMENTS, normalizeAnnouncement } from '@/lib/announcements/announcement'

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato AAAA-MM-DD').or(z.literal(''))

const announcementSchema = z.object({
  id: z.string().trim().max(40).optional().default(''),
  enabled: z.boolean(),
  title: z.string().trim().max(120),
  message: z.string().trim().max(600),
  badgeLabel: z.string().trim().max(40).optional().default('Novedad destacada'),
  badgeVariant: z.enum(['primary', 'amber', 'emerald', 'purple', 'rose', 'cyan', 'indigo', 'orange', 'teal', 'slate']).optional().default('primary'),
  highlightNote: z.string().trim().max(120).optional().default(''),
  carouselAnimation: z.enum(['slide', 'fade', 'zoom']).optional().default('slide'),
  carouselIntervalSeconds: z.number().int().min(0).max(30).optional().default(3),
  imageBackdrop: z.enum(['ambient', 'dark', 'tinted', 'light']).optional().default('ambient'),
  imageFit: z.enum(['contain', 'cover']).optional().default('contain'),
  imageEffect: z.enum(['zoom', 'glow', 'none']).optional().default('zoom'),
  frequency: z.enum(['always', 'once_per_day', 'once_per_session']).optional().default('once_per_day'),
  autoCloseSeconds: z.number().int().min(0).max(120).optional().default(5),
  imageUrl: z.string().trim().max(500).optional().default(''),
  images: z.array(z.object({
    url: z.string().trim().min(1).max(500),
    alt: z.string().trim().max(120).optional().default(''),
    href: z.string().trim().max(500).optional().default(''),
  })).max(5, 'Hasta 5 imágenes').optional().default([]),
  ctaLabel: z.string().trim().max(60).optional().default(''),
  ctaHref: z.string().trim().max(500).optional().default(''),
  startsAt: dateOnly.optional().default(''),
  endsAt: dateOnly.optional().default(''),
  updatedAt: z.string().trim().max(40).optional().default(''),
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
    announcements: getAnnouncementsFromFeatures((data as { features?: unknown } | null)?.features),
  })
}

export async function PUT(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ success: false, error: 'Acceso denegado.' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const validation = z
    .array(announcementSchema)
    .max(MAX_PLATFORM_ANNOUNCEMENTS, 'Se pueden cargar hasta 50 avisos')
    .safeParse(body?.announcements)

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
  // Cada aviso lleva su id y su version. El editor sella `updatedAt` solo en los
  // que cambiaron, para no hacer reaparecer los demas.
  const announcements = validation.data.map((entry, index) =>
    normalizeAnnouncement({
      ...entry,
      id: entry.id || 'aviso-' + (index + 1) + '-' + now,
      updatedAt: entry.updatedAt || now,
    }),
  )
  const features = withAnnouncementsInFeatures((current as { features?: unknown } | null)?.features, announcements)

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
    newValues: { marketplace_announcements: announcements },
    request,
  })

  return NextResponse.json({
    success: true,
    announcements: getAnnouncementsFromFeatures((data as { features?: unknown }).features),
  })
}
