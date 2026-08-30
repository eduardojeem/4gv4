import { MarketplacePublicNav } from '@/components/public/marketplace-public-nav'
import { MarketplaceMobileBottomNav } from '@/components/public/MarketplaceMobileBottomNav'

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20 lg:pb-0">
      <MarketplacePublicNav />
      {children}
      <MarketplaceMobileBottomNav />
    </div>
  )
}
