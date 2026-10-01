import type { Metadata } from 'next'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { CatalogsHub, type CatalogsHubData } from '@/components/superadmin/CatalogsHub'

export const metadata: Metadata = {
  title: 'Catálogos globales | Super Admin',
}

export const revalidate = 60

type Admin = ReturnType<typeof createAdminSupabase>
type Conditions = { active?: boolean; isNull?: string[]; notNull?: string[] }

/** Cuenta filas sin traerlas. `null` si la tabla no existe todavía. */
async function count(admin: Admin, table: string, conditions: Conditions = {}): Promise<number | null> {
  let query = admin.from(table).select('id', { count: 'exact', head: true })
  if (conditions.active) query = query.eq('is_active', true)
  for (const column of conditions.isNull ?? []) query = query.is(column, null)
  for (const column of conditions.notNull ?? []) query = query.not(column, 'is', null)
  const { count: total, error } = await query
  return error ? null : total ?? 0
}

async function getData(): Promise<CatalogsHubData> {
  const admin = createAdminSupabase()
  const [
    categories, categoryRoots, tenantCategories, tenantCategoriesLinked,
    brands, brandsWithoutLogo, tenantBrands, tenantBrandsLinked,
    products, productsWithoutCategory, productsWithoutImage,
    deviceModels,
  ] = await Promise.all([
    count(admin, 'global_categories', { active: true }),
    count(admin, 'global_categories', { active: true, isNull: ['parent_id'] }),
    count(admin, 'categories'),
    count(admin, 'categories', { notNull: ['global_category_id'] }),
    count(admin, 'global_brands', { active: true }),
    count(admin, 'global_brands', { active: true, isNull: ['logo_url'] }),
    count(admin, 'brands'),
    count(admin, 'brands', { notNull: ['global_brand_id'] }),
    count(admin, 'global_products', { active: true }),
    count(admin, 'global_products', { active: true, isNull: ['global_category_id'] }),
    count(admin, 'global_products', { active: true, isNull: ['image_url'] }),
    count(admin, 'global_device_models', { active: true }),
  ])

  return {
    categories: { active: categories, roots: categoryRoots, tenantTotal: tenantCategories, tenantLinked: tenantCategoriesLinked },
    brands: { active: brands, withoutLogo: brandsWithoutLogo, tenantTotal: tenantBrands, tenantLinked: tenantBrandsLinked },
    products: { active: products, withoutCategory: productsWithoutCategory, withoutImage: productsWithoutImage },
    deviceModels: { active: deviceModels },
  }
}

export default async function SuperAdminCatalogsPage() {
  const data = await getData()
  return (
    <div className="p-4 sm:p-6">
      <CatalogsHub data={data} />
    </div>
  )
}
