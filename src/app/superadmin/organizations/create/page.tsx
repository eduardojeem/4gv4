import { createAdminSupabase } from '@/lib/supabase/admin'
import { CreateOrganizationForm } from '@/components/superadmin/organizations/CreateOrganizationForm'
import { buildPlanOptions } from '@/lib/superadmin/create-organization'

/**
 * Alta de una organizacion.
 *
 * La pagina entera era un componente de cliente que leia los planes con el
 * cliente del navegador desde `subscription_plans`, la ficha comercial. Los
 * limites que el sistema aplica viven en `plans`: se leen aca, en el servidor,
 * y el formulario recibe ya las dos cosas cruzadas. El layout de superadmin ya
 * exige la sesion.
 */
export default async function SuperAdminCreateOrganizationPage() {
  const admin = createAdminSupabase()

  const [{ data: commercial, error: commercialError }, { data: technical }] = await Promise.all([
    admin
      .from('subscription_plans')
      .select('tier, name, price, price_note, description, is_popular, trial_days, limits')
      .eq('is_active', true)
      .order('price', { ascending: true }),
    admin.from('plans').select('code, limits, modules'),
  ])

  const plans = buildPlanOptions(
    (commercial ?? []) as Array<Record<string, unknown>>,
    (technical ?? []) as Array<Record<string, unknown>>
  )

  return <CreateOrganizationForm plans={plans} plansFailed={Boolean(commercialError)} />
}
