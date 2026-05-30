import { MarketplacePublicNav } from '@/components/public/marketplace-public-nav'

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <MarketplacePublicNav />
      {children}
    </div>
  )
}
