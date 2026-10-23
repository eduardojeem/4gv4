import type { createAdminSupabase } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminSupabase>
type ProductReferences = { category_id?: string | null; supplier_id?: string | null }

/** Verify optional foreign keys against the tenant selected by server auth. */
export async function productReferencesBelongToOrganization(
  admin: Admin,
  organizationId: string,
  references: ProductReferences,
): Promise<boolean> {
  const checks: Array<PromiseLike<boolean>> = []
  if (references.category_id) {
    checks.push(admin.from('categories').select('id').eq('id', references.category_id)
      .eq('organization_id', organizationId).maybeSingle().then(({ data, error }) => {
        if (error) throw new Error('No se pudieron validar las referencias del producto.')
        return Boolean(data)
      }))
  }
  if (references.supplier_id) {
    checks.push(admin.from('suppliers').select('id').eq('id', references.supplier_id)
      .eq('organization_id', organizationId).maybeSingle().then(({ data, error }) => {
        if (error) throw new Error('No se pudieron validar las referencias del producto.')
        return Boolean(data)
      }))
  }
  return (await Promise.all(checks)).every(Boolean)
}
