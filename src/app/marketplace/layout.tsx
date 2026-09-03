import type { Metadata } from 'next'
import { MarketplacePublicNav } from '@/components/public/marketplace-public-nav'
import { MarketplaceMobileBottomNav } from '@/components/public/MarketplaceMobileBottomNav'
import { DEFAULT_PLATFORM_BRANDING, getPlatformBranding } from '@/lib/platform/branding'

// Pisa el manifest del layout raiz (que es el del comerciante): quien instala
// desde el marketplace debe recibir la app del marketplace.
export const metadata: Metadata = {
  manifest: '/marketplace/manifest.webmanifest',
}

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const branding = await getPlatformBranding().catch(() => DEFAULT_PLATFORM_BRANDING)
  return (
    <div className="min-h-screen bg-background text-foreground pb-20 lg:pb-0">
      <MarketplacePublicNav initialBranding={branding} />
      {children}
      <MarketplaceMobileBottomNav />
    </div>
  )
}
