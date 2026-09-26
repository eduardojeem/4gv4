import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, type TenantAuthContext } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { BusinessProfileInputSchema } from '@/lib/organization/business-profile'
import { validateEnabledModules } from '@/lib/saas/effective-modules'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'

function profileResponse(planInfo: Awaited<ReturnType<typeof getOrganizationPlanInfo>>) {
  return {
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

  const supabase = createAdminSupabase()
  const previous = {
    businessVertical: currentPlan.businessVertical,
    operatingModel: currentPlan.operatingModel,
    enabledModules: currentPlan.enabledModules,
  }
  const next = validation.data

  const { error: updateError } = await supabase
    .from('organizations')
    .update({
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
  return NextResponse.json({ success: true, data: profileResponse(updatedPlan) })
}

export const GET = withTenantAuth({ permission: 'settings.manage' }, getProfile)
export const PATCH = withTenantAuth({ permission: 'settings.manage' }, updateProfile)
