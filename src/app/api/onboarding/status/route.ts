import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getTenantAdminSettings } from '@/lib/organization/admin-settings'
import {
  mergeCanonicalOnboardingData,
  getFirstIncompleteStep,
  filterOnboardingPreferences,
  normalizeOnboardingState,
  validateBranchStep,
  validateBusinessStep,
} from '@/lib/onboarding/shared-setup'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'

type SettingsModules = {
  onboarding?: {
    status?: string
    completed_at?: string | null
    shared?: unknown
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabase()

  const organization = await getCurrentOrganizationContext(user.id)

  if (!organization) {
    return NextResponse.json({
      needsOnboarding: false,
      organization: null,
      reason: 'no_organization',
    })
  }

  const [{ data: settings, error: settingsError }, { data: branch, error: branchError }, { data: companyInfoSetting, error: companyInfoError }, { data: businessProfile, error: businessProfileError }, planInfo] = await Promise.all([
    admin
      .from('organization_settings')
      .select('display_name, currency, timezone, country_code, locale, modules, onboarding_revision')
      .eq('organization_id', organization.id)
      .maybeSingle(),
    admin
      .from('branches')
      .select('id, name, address, city, phone')
      .eq('organization_id', organization.id)
      .eq('is_default', true)
      .maybeSingle(),
    admin
      .from('website_settings')
      .select('value')
      .eq('organization_id', organization.id)
      .eq('key', 'company_info')
      .maybeSingle(),
    admin.from('organizations').select('business_vertical').eq('id', organization.id).maybeSingle(),
    getOrganizationPlanInfo(organization.id).catch(() => null),
  ])

  if (settingsError || branchError || companyInfoError || businessProfileError) {
    logger.error('Failed to load onboarding status settings', {
      error: settingsError?.message ?? branchError?.message ?? companyInfoError?.message ?? businessProfileError?.message,
      organizationId: organization.id,
    })
    return NextResponse.json({ error: 'No se pudo cargar la configuracion.' }, { status: 500 })
  }

  const modules = (settings?.modules ?? {}) as SettingsModules
  const adminSettings = getTenantAdminSettings(settings?.modules)
  const companyInfo = (companyInfoSetting?.value ?? {}) as { phone?: string; address?: string }
  const isCompleted = modules.onboarding?.status === 'completed'
  const hasCompanyBasics = Boolean((settings?.display_name || organization.name) && settings?.currency && settings?.timezone)
  const hasContactBasics = Boolean(
    (adminSettings.companyPhone ?? branch?.phone ?? companyInfo.phone)
    && (adminSettings.companyAddress ?? branch?.address ?? companyInfo.address)
    && (adminSettings.city ?? branch?.city)
  )

  // Una vez que el admin completa explícitamente el onboarding, NO se lo fuerza
  // de vuelta. Los heurísticos de datos solo sirven para auto-saltar/mostrar el
  // onboarding en organizaciones que nunca lo completaron (evita el loop por el
  // que cada navegación reabría el onboarding y re-ejecutaba sus efectos).
  const shared = modules.onboarding?.shared
  const setupState = isRecord(shared)
    ? mergeCanonicalOnboardingData(normalizeOnboardingState(shared), {
        plan: planInfo?.plan ?? organization.plan ?? null,
        businessName: organization.name,
        countryCode: typeof settings?.country_code === 'string' ? settings.country_code : null,
        currency: typeof settings?.currency === 'string' ? settings.currency : null,
        timezone: typeof settings?.timezone === 'string' ? settings.timezone : null,
        locale: typeof settings?.locale === 'string' ? settings.locale : null,
        businessCategory: typeof businessProfile?.business_vertical === 'string' ? businessProfile.business_vertical : null,
        branch: branch ?? null,
      })
    : null
  const needsOnboarding = !isCompleted && (
    Boolean(setupState && !setupState.completed)
    || !hasCompanyBasics
    || !hasContactBasics
  )

  return NextResponse.json({
    needsOnboarding,
    completed: isCompleted,
    onboardingRevision: settings?.onboarding_revision ?? 0,
    hasCompanyBasics,
    hasContactBasics,
    organization,
    setupState,
    setupStep: setupState ? getFirstIncompleteStep(setupState) : null,
    entitledModules: planInfo ? [...planInfo.entitledModules, ...planInfo.moduleTrials.map((trial) => trial.module)] : [],
    needsCountryConfirmation: settings?.country_code == null,
  })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()
  const organization = await getCurrentOrganizationContext(user.id)
  if (!organization) return NextResponse.json({ error: 'No active organization' }, { status: 403 })

  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    admin.from('profiles').select('role, status').eq('id', user.id).maybeSingle(),
    admin.from('organization_settings').select('modules, onboarding_revision').eq('organization_id', organization.id).maybeSingle(),
  ])
  if (profileError || settingsError) return NextResponse.json({ error: 'No se pudo cargar el onboarding.' }, { status: 500 })
  const active = profile?.status !== 'inactive' && profile?.status !== 'suspended'
  if (!active || (profile?.role !== 'super_admin' && !['owner', 'admin'].includes(organization.role))) {
    return NextResponse.json({ error: 'Solo el dueño o administrador puede configurar el negocio.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!isRecord(body) || ![2, 3, 4].includes(Number(body.step)) || !isRecord(body.data)
      || typeof body.expectedRevision !== 'number' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    return NextResponse.json({ error: 'Paso de onboarding inválido.' }, { status: 400 })
  }
  const step = Number(body.step) as 2 | 3 | 4
  const currentModules = isRecord(settings?.modules) ? settings.modules : {}
  const onboarding = isRecord(currentModules.onboarding) ? currentModules.onboarding : {}
  if (!isRecord(onboarding.shared)) return NextResponse.json({ error: 'El onboarding inicial no está habilitado para esta organización.' }, { status: 409 })
  if (onboarding.status === 'completed') return NextResponse.json({ error: 'La configuración inicial ya fue completada.' }, { status: 409 })
  const state = normalizeOnboardingState(onboarding.shared)
  const data = body.data
  let stepPayload: Record<string, unknown>

  if (step === 2) {
    const candidate = { ...state.data, ...data }
    const result = validateBusinessStep({
      businessName: typeof candidate.businessName === 'string' ? candidate.businessName : null,
      countryCode: typeof candidate.countryCode === 'string' ? candidate.countryCode : null,
      businessCategory: typeof candidate.businessCategory === 'string' ? candidate.businessCategory : null,
      currency: typeof candidate.currency === 'string' ? candidate.currency : null,
      timezone: typeof candidate.timezone === 'string' ? candidate.timezone : null,
      locale: typeof candidate.locale === 'string' ? candidate.locale : null,
      regionalConfirmed: candidate.regionalConfirmed === true,
    })
    if (!result.valid) return NextResponse.json({ error: 'Completá los datos obligatorios del negocio.', fields: result.fields }, { status: 400 })
    const selectedCategory = candidate.businessCategory as typeof state.data.businessCategory
    const categoryChanged = state.data.businessCategory !== selectedCategory
    state.data = {
      ...state.data,
      businessName: String(candidate.businessName).trim(),
      countryCode: String(candidate.countryCode).trim().toUpperCase(),
      businessCategory: selectedCategory,
      currency: String(candidate.currency).trim().toUpperCase(),
      timezone: String(candidate.timezone).trim(),
      locale: String(candidate.locale).trim(),
      regionalConfirmed: candidate.regionalConfirmed === true,
      ...(categoryChanged ? { selectedModules: null } : {}),
    }
    if (categoryChanged) state.completedSteps = state.completedSteps.filter((completedStep) => completedStep !== 'modules' && completedStep !== 'ready')
    stepPayload = {
      businessName: state.data.businessName,
      countryCode: state.data.countryCode,
      businessCategory: state.data.businessCategory,
      currency: state.data.currency,
      timezone: state.data.timezone,
      locale: state.data.locale,
      regionalConfirmed: state.data.regionalConfirmed,
      ...(categoryChanged ? { selectedModules: null } : {}),
    }
  } else if (step === 3) {
    const candidate = { ...state.data.primaryBranch, ...data }
    const result = validateBranchStep({ name: typeof candidate.name === 'string' ? candidate.name : '', city: typeof candidate.city === 'string' ? candidate.city : '' })
    if (!result.valid) return NextResponse.json({ error: 'Completá el nombre de la sucursal y la ciudad.', fields: result.fields }, { status: 400 })
    const branchPayload = {
      name: String(candidate.name).trim(),
      city: String(candidate.city).trim(),
      address: typeof candidate.address === 'string' ? candidate.address.trim() : '',
      phone: typeof candidate.phone === 'string' ? candidate.phone.trim() : '',
      is_default: true,
      is_active: true,
      updated_at: new Date().toISOString(),
    }
    const branchId = state.data.primaryBranch.id
    state.data.primaryBranch = {
      id: branchId,
      name: branchPayload.name,
      city: branchPayload.city,
      address: branchPayload.address,
      phone: branchPayload.phone,
      hours: typeof candidate.hours === 'string' ? candidate.hours.trim() : '',
    }
    stepPayload = { ...state.data.primaryBranch }
  } else {
    if (!Array.isArray(data.selectedModules) || data.selectedModules.some((module) => typeof module !== 'string')) {
      return NextResponse.json({ error: 'Seleccioná los módulos que querés usar.' }, { status: 400 })
    }
    const planInfo = await getOrganizationPlanInfo(organization.id)
    const entitled = [...planInfo.entitledModules, ...planInfo.moduleTrials.map((trial) => trial.module)]
    const selected = filterOnboardingPreferences(data.selectedModules as string[], entitled)
    if (selected.length !== new Set(data.selectedModules as string[]).size) {
      return NextResponse.json({ error: 'El plan actual no incluye uno o más módulos seleccionados.', code: 'MODULE_NOT_ENTITLED' }, { status: 403 })
    }
    state.data.selectedModules = selected
    stepPayload = { selectedModules: selected }
  }

  const { data: saveResult, error: saveError } = await admin.rpc('save_organization_onboarding_progress_v2', {
    p_organization_id: organization.id,
    p_user_id: user.id,
    p_expected_revision: Number(body.expectedRevision),
    p_step: step,
    p_step_payload: stepPayload,
  })
  if (saveError) {
    logger.error('Failed to save onboarding progress', { error: saveError.message, organizationId: organization.id })
    return NextResponse.json({ error: 'No se pudo guardar el progreso del onboarding.' }, { status: 500 })
  }
  const saved = isRecord(saveResult) ? saveResult : {}
  if (saved.code === 'ONBOARDING_REVISION_CONFLICT') {
    return NextResponse.json({
      error: 'Tu configuración fue actualizada desde otro dispositivo. Recargamos los datos más recientes.',
      code: saved.code,
      revision: saved.revision,
      setupState: saved.setupState,
    }, { status: 409 })
  }

  const setupState = saved.setupState ? normalizeOnboardingState(saved.setupState) : state
  return NextResponse.json({ success: true, setupState, revision: saved.revision, nextStep: getFirstIncompleteStep(setupState) })
}
