import type { Metadata } from 'next'
import { MarketplacePublicNav } from '@/components/public/marketplace-public-nav'
import { MarketplaceMobileBottomNav } from '@/components/public/MarketplaceMobileBottomNav'

// Pisa el manifest del layout raiz (que es el del comerciante): quien instala
// desde el marketplace debe recibir la app del marketplace.
export const metadata: Metadata = {
  manifest: '/marketplace/manifest.webmanifest',
}

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
