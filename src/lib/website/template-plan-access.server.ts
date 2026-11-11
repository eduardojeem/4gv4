import 'server-only'

import { createAdminSupabase } from '@/lib/supabase/admin'
import { getOrganizationPlanInfo, normalizePlanCode } from '@/lib/saas/subscription-service'
import type { PlanCode } from '@/lib/saas/plan-features'
import type { OperatingModel, OrganizationModule } from '@/lib/organization/business-profile'
import type { ServiceSpecialty } from '@/lib/organization/service-specialties'
import { STOREFRONT_STYLE_LABELS, type StorefrontStylePreference } from '@/lib/website/storefront-style'
import {
  PLAN_CODE_ORDER,
  canSwitchTemplate,
  templateToCheck,
  templatesForPlan,
  type PlanTemplateAccessRow,
  type PlanTemplateSummary,
} from '@/lib/website/template-plan-access'

export interface PlanTemplateCatalogEntry extends PlanTemplateSummary {
  isActive: boolean
  /** true si Super Admin ya guardó la lista; false si se usa la de por defecto. */
  customized: boolean
}

/**
 * Planes técnicos con sus plantillas. Incluye planes inactivos para Super Admin
 * (quien ya lo paga sigue en él); el panel de la tienda filtra los activos.
 */
export async function loadPlanTemplateCatalog(): Promise<PlanTemplateCatalogEntry[]> {
  const admin = createAdminSupabase()
  const [plansResult, accessResult] = await Promise.all([
    admin.from('plans').select('code, name, is_active'),
    admin.from('storefront_template_plan_access').select('plan_code, templates'),
  ])
  if (plansResult.error) throw plansResult.error
  // Sin la tabla (migración pendiente) se usan los valores por defecto.
  const rows = (accessResult.error ? [] : accessResult.data ?? []) as PlanTemplateAccessRow[]

  const seen = new Set<PlanCode>()
  const entries: PlanTemplateCatalogEntry[] = []
  for (const plan of (plansResult.data ?? []) as Array<{ code: string; name: string | null; is_active: boolean | null }>) {
    const code = normalizePlanCode(plan.code)
    if (seen.has(code)) continue
    seen.add(code)
    entries.push({
      code,
      name: plan.name?.trim() || code,
      isActive: plan.is_active !== false,
      templates: templatesForPlan(code, rows),
      customized: rows.some((row) => row.plan_code === code),
    })
  }
  return entries.sort((a, b) => PLAN_CODE_ORDER.indexOf(a.code) - PLAN_CODE_ORDER.indexOf(b.code))
}

export interface OrganizationTemplateAccess {
  planCode: PlanCode
  planName: string
  allowed: StorefrontStylePreference[]
  businessVertical: string
  /** Tiene la agenda (módulo Servicios): cambia qué elige «Automático» en rubros de turnos. */
  servicesAvailable: boolean
  /** Datos del perfil operativo de la cuenta (usados también por la app móvil). */
  operatingModel?: OperatingModel
  effectiveModules?: OrganizationModule[]
  serviceSpecialties?: ServiceSpecialty[]
  /** Planes activos (para el aviso «Disponible en …»). */
  plans: PlanTemplateSummary[]
}

export async function getOrganizationTemplateAccess(organizationId: string): Promise<OrganizationTemplateAccess> {
  const [planInfo, catalog] = await Promise.all([
    getOrganizationPlanInfo(organizationId, { strict: true }),
    loadPlanTemplateCatalog(),
  ])
  const own = catalog.find((entry) => entry.code === planInfo.code)
  return {
    planCode: planInfo.code,
    planName: own?.name ?? planInfo.name,
    allowed: own?.templates ?? templatesForPlan(planInfo.code, []),
    businessVertical: planInfo.businessVertical,
    servicesAvailable: planInfo.effectiveModules.includes('services'),
    operatingModel: planInfo.operatingModel,
    effectiveModules: planInfo.effectiveModules,
    serviceSpecialties: planInfo.serviceSpecialties,
    plans: catalog.filter((entry) => entry.isActive).map(({ code, name, templates }) => ({ code, name, templates })),
  }
}

function storefrontStyleOf(companyInfo: unknown): StorefrontStylePreference | undefined {
  if (!companyInfo || typeof companyInfo !== 'object') return undefined
  const value = (companyInfo as { storefrontStyle?: unknown }).storefrontStyle
  return typeof value === 'string' ? (value as StorefrontStylePreference) : undefined
}

/**
 * Valida el cambio de plantilla de un guardado de `company_info`.
 * Devuelve el mensaje de error, o null si se puede guardar. Mantener la
 * plantilla actual siempre se permite (aunque el plan ya no la incluya).
 */
export async function checkStorefrontTemplateChange(
  organizationId: string,
  nextCompanyInfo: unknown,
  previousCompanyInfo: unknown
): Promise<string | null> {
  const next = storefrontStyleOf(nextCompanyInfo)
  if (!next) return null
  const current = storefrontStyleOf(previousCompanyInfo) ?? 'auto'
  if (next === current) return null

  const access = await getOrganizationTemplateAccess(organizationId)
  const allowed = canSwitchTemplate({
    next,
    current,
    allowed: access.allowed,
    businessVertical: access.businessVertical,
    context: { servicesAvailable: access.servicesAvailable },
  })
  if (allowed) return null
  return `La plantilla «${STOREFRONT_STYLE_LABELS[templateToCheck(next, access.businessVertical, { servicesAvailable: access.servicesAvailable }) as keyof typeof STOREFRONT_STYLE_LABELS] ?? next}» no está incluida en tu plan ${access.planName}.`
}
