import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'

type MembershipRow = {
  organization_id: string
}

type SettingsModules = Record<string, unknown> & {
  onboarding?: Record<string, unknown>
}

const onboardingSchema = z.object({
  displayName: z.string().trim().min(2, 'Nombre publico requerido').max(120),
  currency: z.enum(['PYG', 'USD', 'ARS', 'BRL']).default('PYG'),
  timezone: z.string().trim().min(3).max(80).default('America/Asuncion'),
  phone: z.string().trim().min(6, 'Telefono requerido').max(50),
  email: z.string().trim().email('Correo invalido').max(254).optional().or(z.literal('')),
  address: z.string().trim().min(4, 'Direccion requerida').max(250),
  city: z.string().trim().min(2, 'Ciudad requerida').max(120),
  weekdays: z.string().trim().max(120).optional().or(z.literal('')),
  saturday: z.string().trim().max(120).optional().or(z.literal('')),
  logoUrl: z.string().trim().max(500).optional().or(z.literal('')),
  ruc: z.string().trim().max(50).optional().or(z.literal('')),
  whatsapp: z.string().trim().max(50).optional().or(z.literal('')),
  businessType: z.string().trim().max(50).optional().or(z.literal('')),
  instagram: z.string().trim().max(100).optional().or(z.literal('')),
  facebook: z.string().trim().max(100).optional().or(z.literal('')),
  tiktok: z.string().trim().max(100).optional().or(z.literal('')),
})

function slugifyBranch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'principal'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const validation = onboardingSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      {
        error: 'Completa los datos requeridos de la empresa.',
        details: validation.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 }
    )
  }

  const input = validation.data

  const admin = createAdminSupabase()

  const { data: membership, error: membershipError } = await admin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    logger.error('Failed to load onboarding organization', { error: membershipError.message, userId: user.id })
    return NextResponse.json({ error: 'No se pudo cargar la empresa.' }, { status: 500 })
  }

  const organizationId = (membership as MembershipRow | null)?.organization_id

  if (!organizationId) {
    return NextResponse.json({ error: 'No hay una empresa activa para este usuario.' }, { status: 404 })
  }

  const { data: settings, error: settingsError } = await admin
    .from('organization_settings')
    .select('display_name, currency, timezone, branding, modules')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (settingsError) {
    logger.error('Failed to load onboarding settings', { error: settingsError.message, organizationId })
    return NextResponse.json({ error: 'No se pudo cargar la configuracion.' }, { status: 500 })
  }

  const currentModules = (settings?.modules ?? {}) as SettingsModules
  const now = new Date().toISOString()
  const alreadyCompleted = currentModules.onboarding?.status === 'completed'
  const nextModules: SettingsModules = {
    ...currentModules,
    onboarding: {
      ...(currentModules.onboarding ?? {}),
      status: 'completed',
      // Preservar completed_at y completed_by originales en re-envíos
      completed_at: alreadyCompleted
        ? (currentModules.onboarding?.completed_at ?? now)
        : now,
      completed_by: alreadyCompleted
        ? (currentModules.onboarding?.completed_by ?? user.id)
        : user.id,
      last_updated_at: now,
      last_updated_by: user.id,
      required_company_fields: ['displayName', 'phone', 'address', 'city', 'currency', 'timezone'],
    },
  }

  const { data: defaultBranch } = await admin
    .from('branches')
    .select('id, metadata')
    .eq('organization_id', organizationId)
    .eq('is_default', true)
    .maybeSingle()

  const branchPayload = {
    organization_id: organizationId,
    code: 'MAIN',
    name: 'Sucursal principal',
    slug: slugifyBranch(input.displayName),
    address: input.address,
    city: input.city,
    phone: input.phone,
    email: input.email || null,
    is_active: true,
    is_default: true,
    metadata: {
      ...((defaultBranch?.metadata ?? {}) as Record<string, unknown>),
      onboarding_completed_at: now,
    },
  }

  const websiteCompanyInfo = {
    name: input.displayName,
    phone: input.phone,
    email: input.email || '',
    address: input.address,
    hours: {
      weekdays: input.weekdays || 'Lunes a viernes, 08:00 a 18:00',
      saturday: input.saturday || 'Sabado, 08:00 a 12:00',
      sunday: '',
    },
    logoUrl: input.logoUrl || '',
    brandColor: 'blue',
    headerStyle: 'glass',
    headerColor: '',
    showTopBar: true,
    ruc: input.ruc || '',
    whatsapp: input.whatsapp || '',
    businessType: input.businessType || '',
    instagram: input.instagram || '',
    facebook: input.facebook || '',
    tiktok: input.tiktok || '',
  }

  const results = await Promise.allSettled([
    admin
      .from('organizations')
      .update({ name: input.displayName })
      .eq('id', organizationId),
    admin
      .from('organization_settings')
      .upsert(
        {
          organization_id: organizationId,
          display_name: input.displayName,
          currency: input.currency,
          timezone: input.timezone,
          branding: settings?.branding ?? {},
          modules: nextModules,
        },
        { onConflict: 'organization_id' }
      ),
    defaultBranch?.id
      ? admin.from('branches').update(branchPayload).eq('id', defaultBranch.id)
      : admin.from('branches').insert(branchPayload),
    admin
      .from('website_settings')
      .upsert(
        {
          organization_id: organizationId,
          key: 'company_info',
          value: websiteCompanyInfo,
          updated_by: user.id,
        },
        { onConflict: 'organization_id,key' }
      ),
  ])

  const failed = results.find((result) => result.status === 'fulfilled' && result.value.error)
  const rejected = results.find((result) => result.status === 'rejected')
  const updateError = failed?.status === 'fulfilled' ? failed.value.error : rejected?.status === 'rejected' ? rejected.reason : null

  if (updateError) {
    logger.error('Failed to complete onboarding', {
      error: updateError instanceof Error ? updateError.message : String(updateError?.message ?? updateError),
      organizationId,
    })
    return NextResponse.json({ error: 'No se pudo finalizar el onboarding.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, completedAt: now })
}
