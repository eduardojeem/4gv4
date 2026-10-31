import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, type TenantAuthContext } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { loadOrganizationSetupChecklist } from '@/lib/onboarding/setup-checklist-server'

/**
 * Lo que Configuración necesita para guiar al dueño: qué dejó armado el
 * onboarding (sucursal, tienda) y qué falta fuera de esta pantalla (logo,
 * medios de pago, productos). Solo estados, sin datos de contacto ni cuentas.
 */
async function getSetupStatus(_request: NextRequest, context: TenantAuthContext) {
  const organizationId = context.organization.id
  const admin = createAdminSupabase()
  const [settings, organization, branch, sales, checklist] = await Promise.all([
    admin.from('organization_settings').select('modules').eq('organization_id', organizationId).maybeSingle(),
    admin.from('organizations').select('slug, storefront_public').eq('id', organizationId).maybeSingle(),
    admin.from('branches').select('name, city').eq('organization_id', organizationId).eq('is_default', true).maybeSingle(),
    admin.from('sales').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    loadOrganizationSetupChecklist(admin, organizationId).catch(() => null),
  ])
  if (settings.error || organization.error || branch.error) {
    return NextResponse.json({ success: false, error: 'No se pudo cargar el estado de la configuración.' }, { status: 500 })
  }

  const modules = settings.data?.modules && typeof settings.data.modules === 'object' ? settings.data.modules as Record<string, unknown> : {}
  const onboarding = modules.onboarding && typeof modules.onboarding === 'object' ? modules.onboarding as Record<string, unknown> : {}
  const onboardingStatus = onboarding.status === 'completed'
    ? 'completed'
    : onboarding.status === 'in_progress' || onboarding.shared
      ? 'in_progress'
      : 'not_started'
  const done = (key: string) => checklist?.items.find((item) => item.key === key)?.done ?? null
  const hasProducts = done('product')

  return NextResponse.json({
    success: true,
    data: {
      onboardingStatus,
      branch: branch.data ? { name: branch.data.name ?? '', city: branch.data.city ?? '' } : null,
      storefront: { public: organization.data?.storefront_public === true, slug: organization.data?.slug ?? null },
      logo: done('logo'),
      payments: done('payments'),
      products: hasProducts,
      // Con productos o ventas, cambiar la moneda afecta importes que ya existen.
      hasBusinessData: hasProducts === true || (sales.count ?? 0) > 0,
    },
  })
}

export const GET = withTenantAuth({ permission: 'settings.manage' }, getSetupStatus)
