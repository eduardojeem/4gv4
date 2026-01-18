import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { DemoBanner } from '@/components/demo-banner'
import { DashboardLayoutProvider } from '@/contexts/DashboardLayoutContext'
import { ProductsProvider } from '@/contexts/ProductsContext'
import { RepairsProvider } from '@/contexts/RepairsContext'
import { SessionTrackingProvider } from '@/components/providers/session-tracking-provider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionTrackingProvider>
      <DashboardLayoutProvider>
        <ProductsProvider>
          <RepairsProvider>
            <div className="flex h-screen bg-background text-foreground">
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background text-foreground p-6">
                  <DemoBanner />
                  {children}
                </main>
              </div>
            </div>
          </RepairsProvider>
        </ProductsProvider>
      </DashboardLayoutProvider>
    </SessionTrackingProvider>
  )
}