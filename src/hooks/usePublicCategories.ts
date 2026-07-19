import useSWR from 'swr'
import { usePathname } from 'next/navigation'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'

interface Category {
  id: string
  name: string
  parent_id?: string | null
  subcategories?: Category[]
  /** Productos publicados en la categoría (incluye subcategorías). */
  productCount?: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  const data = await res.json()
  return data.data || []
}

export function usePublicCategories() {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)

  const { data, error, isLoading } = useSWR<Category[]>(
    withOrgQuery('/api/public/categories', tenantSlug),
    fetcher,
    { revalidateOnFocus: false }
  )

  return {
    categories: data || [],
    isLoading,
    error: error ? error.message : null
  }
}
