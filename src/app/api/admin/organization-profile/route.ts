import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, type TenantAuthContext } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { BusinessProfileInputSchema, moduleDependencyProblems } from '@/lib/organization/business-profile'
import { serviceBusinessDetailsPatch } from '@/lib/organization/service-specialties'
import { validateEnabledModules } from '@/lib/saas/effective-modules'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { revalidatePath, revalidateTag } from 'next/cache'
import { samePublicValue } from '@/lib/public/cache-invalidation'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { buildVerticalWebsitePreset, type PresetKey } from '@/lib/website/vertical-website-preset'
import type { WebsiteSettings } from '@/types/website-settings'

const PRESET_KEYS: PresetKey[] = ['company_info', 'hero_content', 'hero_stats', 'trust_bar', 'process_flows', 'booking_section', 'checkout']

/**
 * Deja la página pública lista para el rubro guardado. Solo las claves que
 * dependen del rubro; el resto de la configuración queda como estaba.
 */
async function prepareWebsite(
  supabase: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
  userId: string,
  planInfo: Awaited<ReturnType<typeof getOrganizationPlanInfo>>,
  overwriteCustomContent = false,
  resetStorefrontStyleToAuto = false,
): Promise<{ ok: true; summary: string[] } | { ok: false }> {
  const { data: rows, error } = await supabase
    .from('website_settings')
    .select('key, value')
    .eq('organization_id', organizationId)
    .in('key', PRESET_KEYS)
  if (error) return { ok: false }

  const current: Partial<WebsiteSettings> = {}
  for (const row of rows ?? []) (current as Record<string, unknown>)[row.key] = row.value

  const capabilities = resolveStorefrontCapabilities({
    businessVertical: planInfo.businessVertical,
    operatingModel: planInfo.operatingModel,
    effectiveModules: planInfo.effectiveModules,
  })
  const preset = buildVerticalWebsitePreset({
    vertical: planInfo.businessVertical,
    model: planInfo.operatingModel,
    capabilities,
    effectiveModules: planInfo.effectiveModules,
    current,
    overwriteCustomContent,
    resetStorefrontStyleToAuto,
  })

  const now = new Date().toISOString()
  const upserts = Object.entries(preset.values).map(([key, value]) => ({
    organization_id: organizationId,
    key,
    value,
    updated_by: userId,
    updated_at: now,
  }))
  const { error: upsertError } = await supabase.from('website_settings').upsert(upserts, { onConflict: 'organization_id,key' })
  if (upsertError) return { ok: false }
  return { ok: true, summary: preset.summary }
}

function profileResponse(planInfo: Awaited<ReturnType<typeof getOrganizationPlanInfo>>) {
  return {
    serviceSpecialties: planInfo.serviceSpecialties,
    attentionMode: planInfo.attentionMode,
    appointmentMode: planInfo.appointmentMode,
    businessVertical: planInfo.businessVertical,
    operatingModel: planInfo.operatingModel,
    enabledModules: planInfo.enabledModules,
    entitledModules: planInfo.entitledModules,
    effectiveModules: planInfo.effectiveModules,
  }
}

async function getProfile(_request: NextRequest, context: TenantAuthContext) {
  const planInfo = await getOrganizationPlanInfo(context.organization.id)
  return NextResponse.json({ success: true, data: profileResponse(planInfo) })
}

async function updateProfile(request: NextRequest, context: TenantAuthContext) {
  const body = await request.json().catch(() => null)
  // Opcional: además del perfil, dejar la página pública lista para el rubro.
  const wantsWebsite = Boolean(body && typeof body === 'object' && (body as { prepareWebsite?: unknown }).prepareWebsite === true)
  const overwriteCustomContent = Boolean(body && typeof body === 'object' && (body as { overwriteCustomContent?: unknown }).overwriteCustomContent === true)
  const resetStorefrontStyleToAuto = Boolean(body && typeof body === 'object' && (body as { resetStorefrontStyleToAuto?: unknown }).resetStorefrontStyleToAuto === true)
  const validation = BusinessProfileInputSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({
      success: false,
      error: 'Revisá el rubro, la forma de trabajo y los módulos seleccionados.',
      details: validation.error.flatten(),
    }, { status: 422 })
  }

  const currentPlan = await getOrganizationPlanInfo(context.organization.id)
  const selectedModules = validation.data.enabledModules ?? currentPlan.entitledModules
  const entitlement = validateEnabledModules(
    selectedModules,
    currentPlan.entitledModules,
    currentPlan.moduleTrials.map(trial => trial.module),
  )
  if (!entitlement.valid) {
    return NextResponse.json({
      success: false,
      code: 'MODULE_NOT_ENTITLED',
      error: 'Uno o más módulos seleccionados no están incluidos en el plan actual.',
      unavailableModules: entitlement.unavailableModules,
    }, { status: 422 })
  }

  // Un módulo sin lo que necesita deja su sección vacía (ej. Entregas sin Pedidos).
  const dependencyProblems = moduleDependencyProblems(validation.data.enabledModules ?? [])
  if (validation.data.enabledModules && dependencyProblems.length > 0) {
    return NextResponse.json({
      success: false,
      code: 'MODULE_DEPENDENCY',
      error: dependencyProblems.join(' '),
      problems: dependencyProblems,
    }, { status: 422 })
  }

  const supabase = createAdminSupabase()
  const previous = {
    serviceSpecialties: currentPlan.serviceSpecialties,
    attentionMode: currentPlan.attentionMode,
    appointmentMode: currentPlan.appointmentMode,
    businessVertical: currentPlan.businessVertical,
    operatingModel: currentPlan.operatingModel,
    enabledModules: currentPlan.enabledModules,
  }
  const next = validation.data

  const { error: updateError } = await supabase
    .from('organizations')
    .update({
      ...serviceBusinessDetailsPatch(next),
      business_vertical: next.businessVertical,
      operating_model: next.operatingModel,
      enabled_modules: next.enabledModules,
      updated_at: new Date().toISOString(),
    })
    .eq('id', context.organization.id)

  if (updateError) {
    return NextResponse.json({ success: false, error: 'No se pudo guardar el perfil del negocio.' }, { status: 500 })
  }

  const { error: auditError } = await supabase.from('tenant_audit_log').insert({
    organization_id: context.organization.id,
    user_id: context.user.id,
    action: 'organization_business_profile.updated',
    resource: 'organization',
    resource_id: context.organization.id,
    metadata: { previous, next },
  })

  if (auditError) {
    await supabase
      .from('organizations')
      .update({
        ...serviceBusinessDetailsPatch(previous),
        business_vertical: previous.businessVertical,
        operating_model: previous.operatingModel,
        enabled_modules: previous.enabledModules,
      })
      .eq('id', context.organization.id)
    return NextResponse.json({
      success: false,
      error: 'No se pudo registrar la trazabilidad del cambio. No se aplicaron modificaciones.',
    }, { status: 500 })
  }

  const updatedPlan = await getOrganizationPlanInfo(context.organization.id)

  // El perfil ya quedó guardado: si la página no se pudo preparar se avisa,
  // pero no se deshace el cambio de rubro.
  const website = wantsWebsite
    && updatedPlan.operatingModel !== 'service'
    && updatedPlan.operatingModel !== 'mixed'
    && updatedPlan.businessVertical !== 'barbershop'
    && updatedPlan.businessVertical !== 'beauty_services'
    ? await prepareWebsite(supabase, context.organization.id, context.user.id, updatedPlan, overwriteCustomContent, resetStorefrontStyleToAuto)
    : null

  // El rubro se ve en el marketplace y en la tienda: que no quede el anterior en caché.
  if (!samePublicValue(profileResponse(currentPlan), profileResponse(updatedPlan)) || website?.ok) {
    try {
      revalidateTag('marketplace:organizations', 'max')
      revalidatePath('/marketplace')
      revalidatePath('/saas/negocios')
    } catch (cacheError) {
      console.warn('Could not revalidate marketplace cache on profile update:', cacheError)
    }
  }

  return NextResponse.json({
    success: true,
    data: profileResponse(updatedPlan),
    website: website ? (website.ok ? { prepared: true, summary: website.summary } : { prepared: false }) : null,
  })
}

export const GET = withTenantAuth({ permission: 'settings.manage' }, getProfile)
export const PATCH = withTenantAuth({ permission: 'settings.manage' }, updateProfile)
