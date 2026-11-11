import { buildSubscriptionExpiryNotice, canSeeSubscriptionExpiry } from '@/lib/saas/subscription-expiry-notice'
import { resolveOrganizationProductCostAccess } from '@/lib/products/cost-access'
import { roleHasPermission } from '@/lib/saas/permissions'
import { NextResponse } from 'next/server'
import { MFA_REQUIRED_CODE } from '@/lib/auth/mfa'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { mapOrganizationRoleToDashboardRole } from '@/lib/auth/section-access'
import { getDashboardPermissionsForOrganizationRole } from '@/lib/auth/organization-dashboard-permissions'
import { filterDashboardNavGroups, getBusinessFocusSection, getMobileDashboardItems } from '@/config/dashboard-navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

/**
 * Menú del panel para la app móvil.
 *
 * Usa la misma definición y los mismos filtros que la barra lateral de la web
 * (rol, permisos, módulos del plan y rubro), así la app nunca muestra una
 * sección que el usuario no ve en la web, ni esconde una que sí ve. Las cuatro
 * pestañas de abajo son las mismas que la barra inferior de la web en celular.
 */
export async function GET() {
  try {
    const auth = await resolveRequestAuthUser()
    if (auth.authenticated === false) {
      return auth.reason === 'inactive'
        ? NextResponse.json({ error: 'Tu usuario está desactivado.' }, { status: 403 })
        : NextResponse.json({ error: 'No autenticado', ...(auth.reason === 'mfa_required' ? { code: MFA_REQUIRED_CODE } : {}) }, { status: 401 })
    }

    const organization = await getCurrentOrganizationContext(auth.user.id)
    if (!organization) {
      return NextResponse.json({ error: 'Tu usuario no pertenece a ningún comercio activo.' }, { status: 403 })
    }

    const showSubscription = canSeeSubscriptionExpiry(organization.role, auth.user.role === 'super_admin')
    const [planInfo, appearance, profile, subscription] = await Promise.all([
      getOrganizationPlanInfo(organization.id),
      createAdminSupabase().from('website_settings').select('value').eq('organization_id', organization.id).eq('key', 'company_info').maybeSingle(),
      createAdminSupabase().from('profiles').select('full_name, avatar_url').eq('id', auth.user.id).maybeSingle(),
      showSubscription ? createAdminSupabase().from('subscriptions').select('plan,status,current_period_ends_at,trial_ends_at,cancel_at_period_end').eq('organization_id', organization.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ])

    const role = auth.user.role === 'super_admin' ? 'super_admin' : mapOrganizationRoleToDashboardRole(organization.role)
    const permissions = new Set(getDashboardPermissionsForOrganizationRole(organization.role))
    const groups = filterDashboardNavGroups({
      role,
      effectiveModules: planInfo.effectiveModules,
      hasPermission: (permission) => role === 'super_admin' || permissions.has(permission),
      businessVertical: planInfo.businessVertical,
    })
    const tabs = getMobileDashboardItems(groups, 4, planInfo.businessVertical)

    const profileRow = profile.data as { full_name?: string | null; avatar_url?: string | null } | null

    const company = appearance.data?.value as { brandColor?: unknown; customBrandColor?: unknown } | null
    const costAccess = await resolveOrganizationProductCostAccess(createAdminSupabase(), {userId:auth.user.id,organizationId:organization.id})
    if (subscription.error) logger.warn('[mobile-dashboard] No se pudo consultar el vencimiento del plan')
    return NextResponse.json({
      subscriptionNotice: showSubscription && !subscription.error ? buildSubscriptionExpiryNotice(subscription.data) : null,
      capabilities: {...Object.fromEntries(([
        'products.create','products.update','products.delete','inventory.stock.manage',
        'crm.customers.manage','ecommerce.orders.manage','pos.sales.create','repairs.orders.create','repairs.orders.update','repairs.orders.assign','repairs.orders.deliver',
      ] as const).map(permission => [permission, role === 'super_admin' || roleHasPermission(organization.role, permission)])), 'orders.delivery': planInfo.effectiveModules.includes('delivery'), 'agenda.create': groups.some(group => group.items.some(item => item.key === 'agenda')) && (role === 'super_admin' || roleHasPermission(organization.role, 'pos.sales.read')), 'products.read_cost':costAccess.canReadCost, 'products.update_cost':costAccess.canWriteCost},
      user: {
        email: auth.user.email ?? null,
        name: profileRow?.full_name || null,
        avatarUrl: profileRow?.avatar_url || null,
        // El menú del avatar muestra Configuración / Panel admin según esto, como la web.
        isAdmin: role === 'admin' || role === 'super_admin',
        isSuperAdmin: role === 'super_admin',
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl,
        role: organization.role,
        plan: planInfo.name,
        brandColor: typeof company?.brandColor === 'string' ? company.brandColor : undefined,
        customBrandColor: typeof company?.customBrandColor === 'string' ? company.customBrandColor : undefined,
      },
      // Sin el ícono (es un componente de React de la web): la app tiene los suyos por `key`.
      groups: groups.map((group) => ({
        id: group.id,
        label: group.label,
        items: group.items.map(({ key, label, mobileLabel, href, description }) => ({ key, label, mobileLabel: mobileLabel ?? null, href, description })),
      })),
      tabs: tabs.map((item) => item.key),
      // Ordena los accesos rápidos del inicio según el rubro.
      businessFocus: getBusinessFocusSection(groups, planInfo.businessVertical),
    })
  } catch (error) {
    logger.error('[mobile-dashboard] No se pudo armar el menú', error)
    return NextResponse.json({ error: 'No se pudo cargar el panel.' }, { status: 500 })
  }
}
