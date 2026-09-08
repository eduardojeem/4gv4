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
import { getWebsiteDefaultsForVertical } from '@/lib/website/default-settings'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { DEFAULT_BRAND_COLOR, isKnownBrandColor } from '@/lib/website/brand-colors'

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
  // El cliente exigia http/https y el servidor aceptaba cualquier cosa; lo que
  // se guarda termina en el <Image> de la tienda publica.
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === '' || /^https?:\/\/\S+$/i.test(value),
      'La URL del logo debe empezar con http:// o https://'
    )
    .optional()
    .or(z.literal('')),
  ruc: z.string().trim().max(50).optional().or(z.literal('')),
  whatsapp: z.string().trim().max(50).optional().or(z.literal('')),
  businessType: z.string().trim().max(50).optional().or(z.literal('')),
  businessVertical: BusinessProfileInputSchema.shape.businessVertical.default('general'),
  operatingModel: BusinessProfileInputSchema.shape.operatingModel.default('retail'),
  instagram: z.string().trim().max(100).optional().or(z.literal('')),
  facebook: z.string().trim().max(100).optional().or(z.literal('')),
  tiktok: z.string().trim().max(100).optional().or(z.literal('')),
  // El onboarding ya escribia el color de marca: le fijaba 'blue' a mano en
  // cada guardado. Ahora es una eleccion del usuario, no una constante.
  brandColor: z.string().trim().refine(isKnownBrandColor, 'Color de marca invalido').default(DEFAULT_BRAND_COLOR),
  // La tienda de una organizacion nueva arranca sin publicar y nada lo decia.
  storefrontPublic: z.boolean().default(false),
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
    },
  }

  const branchPayload = {
    address: input.address,
    city: input.city,
    phone: input.phone,
    email: input.email || '',
  }

  const verticalDefaults = getWebsiteDefaultsForVertical(
    input.businessVertical,
    input.operatingModel,
    input.businessType
  )

  // Solo lo que el onboarding realmente le pregunta al usuario. `headerStyle`,
  // `headerColor` y `showTopBar` se mandaban como constantes y pisaban lo
  // elegido en /admin/website; ahora ni siquiera viajan, y la RPC fusiona en
  // vez de reemplazar, asi que el eslogan, la descripcion, el mapa y el color
  // propio sobreviven.
  const websiteCompanyInfo: Record<string, unknown> = {
    name: input.displayName,
    phone: input.phone,
    email: input.email || '',
    address: input.address,
    // `sunday` no se manda: la RPC fusiona `hours` clave por clave y el
    // domingo que el admin haya cargado se conserva.
    hours: {
      weekdays: input.weekdays || 'Lunes a viernes, 08:00 a 18:00',
      saturday: input.saturday || 'Sabado, 08:00 a 12:00',
    },
    logoUrl: input.logoUrl || '',
    brandColor: input.brandColor,
    ruc: input.ruc || '',
    whatsapp: input.whatsapp || '',
    businessType: input.businessType || '',
    instagram: input.instagram || '',
    facebook: input.facebook || '',
    tiktok: input.tiktok || '',
    // Publication is preserved by complete_organization_onboarding, never enabled here.
  }

  // Los interruptores derivados del rubro solo se proponen la primera vez: en
  // una revisita son decisiones que el admin ya pudo cambiar a mano.
  if (!alreadyCompleted) {
    websiteCompanyInfo.servicesPageEnabled = verticalDefaults.company_info?.servicesPageEnabled ?? false
    websiteCompanyInfo.repairTrackingEnabled = verticalDefaults.company_info?.repairTrackingEnabled ?? false
    websiteCompanyInfo.processSectionEnabled = verticalDefaults.company_info?.processSectionEnabled ?? true
  }

  // La publicacion se aplica ANTES de la RPC: la funcion lee
  // `storefront_public` de `organizations` para estamparlo en `company_info`.
  // Escribirla despues dejaba la fila publica con el valor de la vez anterior.
  const publicationUpdate: Record<string, unknown> = {
    storefront_public: input.storefrontPublic,
    updated_at: now,
  }
  if (!input.storefrontPublic) publicationUpdate.marketplace_public = false

  const { error: publicationError } = await admin
    .from('organizations')
    .update(publicationUpdate)
    .eq('id', organizationId)

  if (publicationError) {
    logger.error('Failed to apply storefront publication', {
      error: publicationError.message,
      organizationId,
    })
    return NextResponse.json({
      error: 'No se pudo aplicar la visibilidad de la tienda. No se guardó nada.',
    }, { status: 500 })
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

  // El contenido del sitio se SIEMBRA, no se reaplica. El array se llamaba
  // `initialWebsiteRows` —la intencion era «solo la primera vez»— pero el
  // upsert corria en cada guardado y reemplazaba el encabezado y los pasos de
  // proceso que el admin hubiera escrito en /admin/website.
  const seedableKeys = [
    { key: 'hero_content', value: verticalDefaults.hero_content },
    { key: 'hero_stats', value: verticalDefaults.hero_stats },
    { key: 'process_steps', value: verticalDefaults.process_steps },
  ].filter((row) => row.value !== undefined)

  const { data: existingRows, error: existingRowsError } = await admin
    .from('website_settings')
    .select('key')
    .eq('organization_id', organizationId)
    .in('key', seedableKeys.map((row) => row.key))

  if (existingRowsError) {
    logger.error('Failed to check website content before seeding', {
      error: existingRowsError.message,
      organizationId,
    })
  }

  const alreadyPresent = new Set((existingRows ?? []).map((row) => row.key))
  const rowsToSeed = existingRowsError
    // Sin saber que hay, no se escribe: perder contenido es peor que no sembrarlo.
    ? []
    : seedableKeys.filter((row) => !alreadyPresent.has(row.key))

  const seedFailures: string[] = []
  for (const row of rowsToSeed) {
    const { error: seedError } = await admin.from('website_settings').insert({
      organization_id: organizationId,
      key: row.key,
      value: row.value,
      updated_by: user.id,
      updated_at: now,
    })
    // El error se leia: antes el resultado se descartaba y el contenido podia
    // no existir con la respuesta diciendo `success: true`.
    if (seedError) {
      seedFailures.push(row.key)
      logger.error('Failed to seed website content', {
        error: seedError.message,
        organizationId,
        key: row.key,
      })
    }
  }

  const planInfo = await getOrganizationPlanInfo(organizationId)
  const entitled = new Set([
    ...planInfo.entitledModules,
    ...planInfo.moduleTrials.map(trial => trial.module),
  ])
  const suggestedModules = getSuggestedModules(input.businessVertical, input.operatingModel)
    .filter(module => entitled.has(module))

  // Los modulos se sugieren la primera vez. En una revisita, lo que el admin
  // eligio a mano en /admin/organization-profile —con validacion de plan y
  // auditoria— manda sobre la sugerencia del rubro.
  const organizationUpdate: Record<string, unknown> = {
    business_vertical: input.businessVertical,
    operating_model: input.operatingModel,
    updated_at: now,
  }
  if (!alreadyCompleted) {
    organizationUpdate.enabled_modules = suggestedModules
  }
  const enabledModules = alreadyCompleted ? null : suggestedModules
  const { error: profileUpdateError } = await admin
    .from('organizations')
    .update(organizationUpdate)
    .eq('id', organizationId)

  if (profileUpdateError) {
    logger.error('Failed to save onboarding business profile', { error: profileUpdateError.message, organizationId })
    return NextResponse.json({
      error: 'La configuración general se guardó, pero no se pudo aplicar el perfil del negocio. Intentá nuevamente.',
    }, { status: 500 })
  }

  const { error: auditError } = await admin.from('tenant_audit_log').insert({
    organization_id: organizationId,
    user_id: user.id,
    action: 'organization_business_profile.onboarding_saved',
    resource: 'organization',
    resource_id: organizationId,
    metadata: {
      business_vertical: input.businessVertical,
      operating_model: input.operatingModel,
      enabled_modules: enabledModules,
      storefront_public: input.storefrontPublic,
      seeded_website_keys: rowsToSeed.map((row) => row.key),
    },
  })

  // No se revierte —a diferencia de /api/admin/organization-profile— porque a
  // esta altura ya hay una transaccion confirmada detras; pero el hueco en la
  // trazabilidad se registra en vez de descartarse en silencio.
  if (auditError) {
    logger.error('Onboarding saved without audit trail', {
      error: auditError.message,
      organizationId,
    })
  }

  const completedAt = completion && typeof completion === 'object' && !Array.isArray(completion)
    ? String((completion as Record<string, unknown>).completed_at || now)
    : now

  return NextResponse.json({
    success: true,
    completedAt,
    storefrontPublic: input.storefrontPublic,
    // Con esto en true el sitio quedo sin su contenido inicial y la pantalla lo
    // dice: antes el error se descartaba y la respuesta seguia siendo exitosa.
    websiteContentIncomplete: seedFailures.length > 0,
  })
}
