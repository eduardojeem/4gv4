import { notFound } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { OrganizationDetailView, type FullOrganizationDetail } from '@/components/superadmin/organizations/OrganizationDetailView'
import { summarizeOrganizationActivity } from '@/lib/superadmin/organization-activity'
import { normalizePlanCode } from '@/lib/saas/subscription-service'

/** Tope del barrido de ventas para calcular facturacion. */
const SALES_SCAN_CAP = 20000

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
    { data: members },
    { data: subscription },
    { data: settings },
    { data: branches },
    { count: productsCount },
    { count: quotaProductsCount },
    { count: staffMembersCount },
    { count: customersCount },
    { data: salesRows },
    { count: repairsCount, error: repairsError },
  ] = await Promise.all([
    admin
      .from('organization_members')
      .select('id, user_id, role, status, created_at, profiles(id, email, full_name, avatar_url)')
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
    admin
      .from('repairs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
  ])

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

  const detailData: FullOrganizationDetail = {
    organization: org,
    owner: ownerProfile,
    settings,
    members: (members ?? []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      created_at: m.created_at,
      profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles ?? null,
    })),
    subscription: subscription ?? null,
    plan_details: planDetails,
    branches: branches ?? [],
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
      repairs: repairsError ? null : repairsCount ?? 0,
    },
    activity,
    activityTruncated,
  }

  return <OrganizationDetailView data={detailData} />
}
