import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { ScrollToTop } from '@/components/dashboard/scroll-to-top'
import { ScrollRestoration } from '@/components/dashboard/scroll-restoration'
import { DemoBanner } from '@/components/demo-banner'
import { DashboardLayoutProvider } from '@/contexts/DashboardLayoutContext'
import { ProductsProvider } from '@/contexts/ProductsContext'
import { RepairsProvider } from '@/contexts/RepairsContext'
import { SessionTrackingProvider } from '@/components/providers/session-tracking-provider'
import { DashboardGuard } from '@/components/dashboard/DashboardGuard'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionTrackingProvider>
      <DashboardGuard>
        <DashboardLayoutProvider>
          <ProductsProvider>
            <RepairsProvider>
              <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
                <Sidebar />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <Header />
                  <main 
                    id="dashboard-main"
                    className="flex-1 overflow-x-hidden overflow-y-auto scroll-smooth overscroll-none bg-background text-foreground p-4 sm:p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6 relative will-change-scroll scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent"
                  >
                    <div className="min-h-full">
                      <DemoBanner />
                      {children}
                    </div>
                  </main>
                  <MobileNav />
                  <ScrollToTop />
                  <ScrollRestoration />
                </div>
              </div>
            </RepairsProvider>
          </ProductsProvider>
        </DashboardLayoutProvider>
      </DashboardGuard>
    </SessionTrackingProvider>
  )
}
