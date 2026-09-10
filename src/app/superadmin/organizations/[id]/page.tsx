import { notFound } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { OrganizationDetailView, type FullOrganizationDetail } from '@/components/superadmin/organizations/OrganizationDetailView'
import { summarizeOrganizationActivity } from '@/lib/superadmin/organization-activity'
import { normalizePlanCode } from '@/lib/saas/subscription-service'
import { getTenantAdminSettings } from '@/lib/organization/admin-settings'
import {
  summarizeOnlineOrders,
  summarizeRepairs,
  summarizeSubscriptionPayments,
} from '@/lib/superadmin/organization-volume'

/** Tope del barrido de ventas para calcular facturacion. */
const SALES_SCAN_CAP = 20000
/** Tope de los barridos de pedidos y reparaciones. */
const ROWS_SCAN_CAP = 20000

type Props = {
  params: Promise<{ id: string }>
}

export default async function SuperAdminOrganizationDetailPage({ params }: Props) {
  const { id } = await params
  const admin = createAdminSupabase()

  // Find organization by ID or by slug
  let query = admin.from('organizations').select('*')
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    query = query.eq('id', id)
  } else {
    query = query.eq('slug', id)
  }

  const { data: org, error: orgError } = await query.maybeSingle()
  if (orgError || !org) {
    notFound()
  }

  // Parallel fetch associated telemetry and models
  const [
    { data: memberRows, error: membersError },
    { data: subscription },
    { data: settings },
    { data: branches },
    { count: productsCount },
    { count: quotaProductsCount },
    { count: staffMembersCount },
    { count: customersCount },
    { data: salesRows },
    { data: repairRows, error: repairsError },
    { data: orderRows, error: ordersError },
    { data: paymentRows, error: paymentsError },
    { data: billing },
    { data: companyInfoRow },
  ] = await Promise.all([
    // Sin `profiles(...)` embebido: `organization_members.user_id` referencia
    // `auth.users(id)`, no `public.profiles`. PostgREST no puede resolver esa
    // relacion y devuelve un error, que aca se leia como una lista vacia: la
    // pestaña decia «0 usuarios» en organizaciones con equipo cargado. El resto
    // del sistema (`/api/admin/users`) ya carga los perfiles por separado.
    admin
      .from('organization_members')
      .select('id, user_id, role, status, created_at')
      .eq('organization_id', org.id),
    admin
      .from('subscriptions')
      .select('*')
      .eq('organization_id', org.id)
      .maybeSingle(),
    admin
      .from('organization_settings')
      .select('*')
      .eq('organization_id', org.id)
      .maybeSingle(),
    admin
      .from('branches')
      .select('id, name, code, slug, address, city, phone, email, is_active, is_default, created_at')
      .eq('organization_id', org.id),
    admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
    // Los que ocupan cupo del plan. El total incluye lo archivado por baja de
    // plan, que deliberadamente NO consume cupo (si consumiera, archivar no
    // liberaria espacio y la organizacion quedaria trabada para siempre).
    // El filtro es exactamente el de `countActiveProducts` en
    // `subscription-service`: si aca se filtrara ademas por `is_active`, la
    // pantalla mostraria un consumo menor al que el sistema realmente aplica.
    admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .is('archived_by_plan_at', null),
    // Las butacas del plan cuentan solo staff activo: los clientes se registran
    // desde la publica y no consumen cupo.
    admin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .neq('role', 'customer')
      .eq('status', 'active'),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
    // Con importe y estado: el conteo pelado no distinguia una venta cobrada de
    // una anulada, y no habia forma de saber cuanto factura la organizacion.
    admin
      .from('sales')
      .select('total_amount, status, created_at')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(SALES_SCAN_CAP + 1),
    // Con importes y estado: el conteo pelado no decia cuantos equipos siguen
    // en el taller ni cuanto trabajo terminado esta sin cobrar.
    admin
      .from('repairs')
      .select('status, final_cost, estimated_cost, paid_amount, created_at, delivered_at')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(ROWS_SCAN_CAP),
    // Tienda online. Es una tabla aparte de `sales`: el mostrador y la web no
    // se mezclan, y hasta ahora la pantalla solo mostraba el mostrador.
    admin
      .from('customer_orders')
      .select('status, payment_status, total, created_at')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(ROWS_SCAN_CAP),
    // Lo que la organizacion pago por el servicio.
    admin
      .from('subscription_payments')
      .select('amount, currency, status, payment_method, provider, plan_id, paid_at, created_at')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(500),
    // Identidad fiscal: RUC y razon social viven aca, no en `organizations`.
    admin
      .from('billing_profiles')
      .select('business_name, ruc, billing_email, fiscal_address, phone')
      .eq('organization_id', org.id)
      .maybeSingle(),
    // Contacto publico del negocio, cargado desde «Sitio Web».
    admin
      .from('website_settings')
      .select('value')
      .eq('organization_id', org.id)
      .eq('key', 'company_info')
      .maybeSingle(),
  ])

  // Los perfiles van en una segunda consulta, cruzada por id en memoria.
  const memberList = memberRows ?? []
  const memberUserIds = Array.from(
    new Set(memberList.map((m: any) => String(m.user_id ?? '')).filter(Boolean))
  )
  const { data: memberProfiles } = memberUserIds.length
    ? await admin
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', memberUserIds)
    : { data: [] as Array<{ id: string; email: string | null; full_name: string | null; avatar_url: string | null }> }

  const profileById = new Map<string, any>((memberProfiles ?? []).map((p: any) => [String(p.id), p] as [string, any]))

  // El plan vive en dos tablas: `subscription_plans` es la comercial (precio,
  // nombre, features de marketing) y `plans` la tecnica (los limites que el
  // sistema realmente aplica). `mergeCommercialPlans` le da prioridad a los
  // limites de `plans`; esta pantalla hace lo mismo, porque mostrar los de la
  // comercial seria mostrar un numero que nadie aplica.
  const planTier = (subscription?.plan || org.plan || 'FREE').toLowerCase()
  const planCode = normalizePlanCode(planTier)
  const [{ data: planRow }, { data: technicalPlan }] = await Promise.all([
    admin.from('subscription_plans').select('*').eq('tier', planTier).maybeSingle(),
    admin.from('plans').select('code, name, limits, modules, is_active').eq('code', planCode).maybeSingle(),
  ])

  const isLimitMap = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

  // Sin fila en `plans` el servicio sirve los limites de FREE con el codigo de
  // la organizacion. Aca no se inventa ninguno: `null` se muestra como «el plan
  // no tiene limites cargados», que es la verdad.
  const planLimits = isLimitMap(technicalPlan?.limits)
    ? technicalPlan.limits
    : isLimitMap(planRow?.limits)
      ? planRow.limits
      : null

  const planDetails = planRow ?? null

  // Owner profile
  let ownerProfile = null
  if (org.owner_id) {
    const { data: owner } = await admin
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('id', org.owner_id)
      .maybeSingle()
    ownerProfile = owner
  }

  const sales = salesRows ?? []
  const activityTruncated = sales.length > SALES_SCAN_CAP
  const activity = summarizeOrganizationActivity(
    activityTruncated ? sales.slice(0, SALES_SCAN_CAP) : sales
  )

  // Un modulo puede no estar instalado en esta organizacion: `null` no es lo
  // mismo que cero.
  const repairSummary = repairsError ? null : summarizeRepairs(repairRows ?? [])
  const onlineSummary = ordersError ? null : summarizeOnlineOrders(orderRows ?? [])
  const billingSummary = paymentsError ? null : summarizeSubscriptionPayments(paymentRows ?? [])

  const branchList = branches ?? []
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

  const detailData: FullOrganizationDetail = {
    organization: org,
    owner: ownerProfile,
    settings,
    members: memberList.map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      created_at: m.created_at,
      profiles: profileById.get(String(m.user_id)) ?? null,
    })),
    // Una consulta que fallo no es una organizacion sin equipo.
    membersFailed: Boolean(membersError),
    subscription: subscription ?? null,
    plan_details: planDetails,
    branches: branchList,
    // Las tres fuentes de contacto se resuelven en la vista con el mismo orden
    // de preferencia que usa /api/onboarding/status.
    admin_settings: getTenantAdminSettings(settings?.modules) as Record<string, unknown>,
    company_info: isRecord(companyInfoRow?.value) ? companyInfoRow.value : null,
    billing: billing ?? null,
    settings_modules: settings?.modules ?? null,
    plan_limits: planLimits,
    plan_limits_source: technicalPlan ? 'technical' : planRow?.limits ? 'commercial' : 'missing',
    counts: {
      products: productsCount ?? 0,
      quotaProducts: quotaProductsCount ?? 0,
      staffMembers: staffMembersCount ?? 0,
      sales: activity.totalSales,
      customers: customersCount ?? 0,
      // El modulo puede no estar instalado en esta organizacion: `null` no es
      // lo mismo que cero reparaciones.
      repairs: repairSummary?.total ?? null,
    },
    repair_summary: repairSummary,
    online_summary: onlineSummary,
    billing_summary: billingSummary,
    activity,
    activityTruncated,
  }

  return <OrganizationDetailView data={detailData} />
}
