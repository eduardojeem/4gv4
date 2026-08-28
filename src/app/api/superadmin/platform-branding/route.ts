import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import {
  DEFAULT_PLATFORM_BRANDING,
  getBrandingFromFeatures,
  normalizePlatformBranding,
  withBrandingInFeatures,
} from '@/lib/platform/branding'

const brandingSchema = z.object({
  platformName: z.string().trim().min(2).max(80),
  platformTagline: z.string().trim().min(2).max(140),
  logoUrl: z.string().trim().max(500).optional().default(''),
  logoDarkUrl: z.string().trim().max(500).optional().default(''),
  faviconUrl: z.string().trim().max(500).optional().default(''),
  hideNavBrandText: z.boolean().optional().default(false),
  hideNavTagline: z.boolean().optional().default(false),
  logoHeight: z.enum(['sm', 'md', 'lg', 'xl']).optional().default('md'),
  logoGlowDark: z.boolean().optional().default(true),
  marketplaceName: z.string().trim().min(2).max(80),
  marketplaceTagline: z.string().trim().min(2).max(140),
  primaryCtaLabel: z.string().trim().min(2).max(50),
  primaryCtaHref: z.string().trim().min(1).max(500),
  secondaryCtaLabel: z.string().trim().min(2).max(50),
  secondaryCtaHref: z.string().trim().min(1).max(500),
  loginEyebrow: z.string().trim().min(2).max(80),
  loginSubtitle: z.string().trim().min(2).max(120),
  seoTitle: z.string().trim().min(2).max(160),
  seoDescription: z.string().trim().min(2).max(240),
  footerText: z.string().trim().min(2).max(180),
})

function isSafeHref(value: string) {
  return value.startsWith('/') || value.startsWith('https://') || value.startsWith('http://')
}

export async function GET() {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ success: false, error: 'Acceso denegado.' }, { status: 403 })

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('system_settings')
    .select('features, updated_at, updated_by')
    .eq('id', 'system')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ success: false, error: 'No se pudo cargar la marca SaaS.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    branding: getBrandingFromFeatures((data as { features?: unknown } | null)?.features),
    updatedAt: (data as { updated_at?: string | null } | null)?.updated_at ?? null,
    updatedBy: (data as { updated_by?: string | null } | null)?.updated_by ?? null,
  })
}

export async function PUT(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ success: false, error: 'Acceso denegado.' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const validation = brandingSchema.safeParse(body?.branding)

  if (!validation.success) {
    const issue = validation.error.issues[0]
    return NextResponse.json({ success: false, error: issue?.message || 'Datos invalidos.' }, { status: 400 })
  }

  if (!isSafeHref(validation.data.primaryCtaHref) || !isSafeHref(validation.data.secondaryCtaHref)) {
    return NextResponse.json({ success: false, error: 'Los enlaces deben ser rutas locales o URLs http(s).' }, { status: 400 })
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

  const branding = normalizePlatformBranding(validation.data)
  const features = withBrandingInFeatures((current as { features?: unknown } | null)?.features, branding)
  const now = new Date().toISOString()

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

  const { data, error } = await mutation
    .select('features, updated_at, updated_by')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: 'No se pudo guardar la marca SaaS.' }, { status: 500 })
  }

  await logSuperAdminAction({
    actorId: me.id,
    actorEmail: me.email,
    action: 'update_platform_branding',
    resource: 'system_settings',
    resourceId: 'system',
    newValues: { saas_branding: branding },
    request,
  })

  return NextResponse.json({
    success: true,
    branding: getBrandingFromFeatures((data as { features?: unknown }).features),
    updatedAt: (data as { updated_at?: string | null }).updated_at ?? now,
    updatedBy: (data as { updated_by?: string | null }).updated_by ?? me.id,
  })
}
