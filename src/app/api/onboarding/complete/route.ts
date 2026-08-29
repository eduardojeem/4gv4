import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  SupportedCurrencySchema,
  SupportedLanguageSchema,
  isValidTimeZone,
} from '@/lib/validations/system-settings'
import {
  getTenantAdminSettings,
  mergeTenantAdminSettings,
  normalizeOrganizationModules,
  toOnboardingAdminSettings,
} from '@/lib/organization/admin-settings'
import { BusinessProfileInputSchema, getSuggestedModules } from '@/lib/organization/business-profile'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'

type OnboardingMetadata = Record<string, unknown> & {
  onboarding?: Record<string, unknown>
}

const onboardingSchema = z.object({
  displayName: z.string().trim().min(2, 'Nombre publico requerido').max(120),
  currency: SupportedCurrencySchema.default('PYG'),
  timezone: z.string().trim().refine(isValidTimeZone, 'Zona horaria invalida').default('America/Asuncion'),
  language: SupportedLanguageSchema.default('es'),
  confirmCurrencyChange: z.boolean().default(false),
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
  businessVertical: BusinessProfileInputSchema.shape.businessVertical.default('general'),
  operatingModel: BusinessProfileInputSchema.shape.operatingModel.default('retail'),
  instagram: z.string().trim().max(100).optional().or(z.literal('')),
  facebook: z.string().trim().max(100).optional().or(z.literal('')),
  tiktok: z.string().trim().max(100).optional().or(z.literal('')),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()
  const [{ data: profile, error: profileError }, organizationContext] = await Promise.all([
    admin.from('profiles').select('role, status').eq('id', user.id).maybeSingle(),
    getCurrentOrganizationContext(user.id),
  ])

  if (profileError) {
    logger.error('Failed to load onboarding user profile', { error: profileError.message, userId: user.id })
    return NextResponse.json({ error: 'No se pudo validar el usuario.' }, { status: 500 })
  }

  const profileRole = typeof profile?.role === 'string' ? profile.role : null
  const profileStatus = typeof profile?.status === 'string' ? profile.status : null
  const isActive = profileStatus !== 'inactive' && profileStatus !== 'suspended'
  const canComplete = Boolean(
    isActive
    && organizationContext
    && (
      profileRole === 'super_admin'
      || organizationContext.role === 'owner'
      || organizationContext.role === 'admin'
    )
  )
  if (!canComplete) {
    return NextResponse.json({ error: 'Solo administradores pueden finalizar el onboarding.' }, { status: 403 })
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
  const organizationId = organizationContext!.id
  const { data: settings, error: settingsError } = await admin
    .from('organization_settings')
    .select('currency, modules')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (settingsError) {
    logger.error('Failed to load onboarding settings', { error: settingsError.message, organizationId })
    return NextResponse.json({ error: 'No se pudo cargar la configuracion.' }, { status: 500 })
  }

  const currentModules = normalizeOrganizationModules(settings?.modules) as OnboardingMetadata
  const currentAdminSettings = getTenantAdminSettings(currentModules)
  const currentCurrency = settings?.currency || currentAdminSettings.currency || 'PYG'
  if (input.currency !== currentCurrency && !input.confirmCurrencyChange) {
    return NextResponse.json(
      {
        error: 'Confirma que el cambio de moneda no convierte precios, saldos ni operaciones existentes.',
        code: 'CURRENCY_CHANGE_CONFIRMATION_REQUIRED',
      },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()
  const previousOnboarding = currentModules.onboarding ?? {}
  const alreadyCompleted = previousOnboarding.status === 'completed'
  const modulesWithAdminSettings = mergeTenantAdminSettings(
    currentModules,
    toOnboardingAdminSettings(input)
  )
  const nextModules: OnboardingMetadata = {
    ...modulesWithAdminSettings,
    onboarding: {
      ...previousOnboarding,
      status: 'completed',
      completed_at: alreadyCompleted ? previousOnboarding.completed_at ?? now : now,
      completed_by: alreadyCompleted ? previousOnboarding.completed_by ?? user.id : user.id,
      last_updated_at: now,
      last_updated_by: user.id,
      required_company_fields: [
        'displayName', 'phone', 'address', 'city', 'currency', 'timezone', 'language',
      ],
    },
  }

  const branchPayload = {
    address: input.address,
    city: input.city,
    phone: input.phone,
    email: input.email || '',
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

  const { data: completion, error: updateError } = await admin.rpc(
    'complete_organization_onboarding',
    {
      p_organization_id: organizationId,
      p_user_id: user.id,
      p_display_name: input.displayName,
      p_currency: input.currency,
      p_timezone: input.timezone,
      p_logo_url: input.logoUrl || '',
      p_modules: nextModules,
      p_branch: branchPayload,
      p_company_info: websiteCompanyInfo,
    }
  )

  if (updateError) {
    logger.error('Failed to complete onboarding', { error: updateError.message, organizationId })
    return NextResponse.json({ error: 'No se pudo finalizar el onboarding.' }, { status: 500 })
  }

  const planInfo = await getOrganizationPlanInfo(organizationId)
  const entitled = new Set([
    ...planInfo.entitledModules,
    ...planInfo.moduleTrials.map(trial => trial.module),
  ])
  const enabledModules = getSuggestedModules(input.businessVertical, input.operatingModel)
    .filter(module => entitled.has(module))
  const { error: profileUpdateError } = await admin
    .from('organizations')
    .update({
      business_vertical: input.businessVertical,
      operating_model: input.operatingModel,
      enabled_modules: enabledModules,
      updated_at: now,
    })
    .eq('id', organizationId)

  if (profileUpdateError) {
    logger.error('Failed to save onboarding business profile', { error: profileUpdateError.message, organizationId })
    return NextResponse.json({
      error: 'La configuración general se guardó, pero no se pudo aplicar el perfil del negocio. Intentá nuevamente.',
    }, { status: 500 })
  }

  await admin.from('tenant_audit_log').insert({
    organization_id: organizationId,
    user_id: user.id,
    action: 'organization_business_profile.onboarding_saved',
    resource: 'organization',
    resource_id: organizationId,
    metadata: {
      business_vertical: input.businessVertical,
      operating_model: input.operatingModel,
      enabled_modules: enabledModules,
    },
  })

  const completedAt = completion && typeof completion === 'object' && !Array.isArray(completion)
    ? String((completion as Record<string, unknown>).completed_at || now)
    : now
  return NextResponse.json({ success: true, completedAt })
}
