import type { MarketplaceCategory } from '@/lib/public/marketplace'
import { getMarketplaceCategories } from '@/lib/public/marketplace'
import { CompactCategoryBar } from './CompactCategoryBar'

// ─── Types ───────────────────────────────────────────────────────────────────
type Props = {
  categories?: MarketplaceCategory[]
  activeId?: string
  title?: string
  subtitle?: string
  showViewAll?: boolean
  compact?: boolean
  showCount?: boolean
}

// ─── Server component — fetches data and delegates to client bar ──────────────
export async function CategoryCarouselSection({
  categories: providedCategories,
  activeId,
  showViewAll = true,
  showCount = true,
}: Props) {
  const categories = providedCategories ?? await getMarketplaceCategories().catch(() => [])
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
