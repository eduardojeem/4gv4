import { getMarketplaceCategories } from '@/lib/public/marketplace'
import { CompactCategoryBar } from './CompactCategoryBar'

// ─── Types ───────────────────────────────────────────────────────────────────
type Props = {
  activeId?: string
  title?: string
  subtitle?: string
  showViewAll?: boolean
  compact?: boolean
  showCount?: boolean
}

// ─── Server component — fetches data and delegates to client bar ──────────────
export async function CategoryCarouselSection({
  activeId,
  showViewAll = true,
  showCount = true,
}: Props) {
  const categories = await getMarketplaceCategories()
  if (!categories.length) return null

  return (
    <CompactCategoryBar
      categories={categories}
      activeId={activeId}
      showViewAll={showViewAll}
      showCount={showCount}
    />
  )
}
