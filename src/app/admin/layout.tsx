import { AdminLayoutProvider } from '@/contexts/AdminLayoutContext'
import { AdminLayout } from '@/components/admin/layout/AdminLayout'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { RepairsProvider } from '@/contexts/RepairsContext'
import { SubscriptionGate } from '@/components/admin/SubscriptionGate'
import { SubscriptionBanner } from '@/components/admin/SubscriptionBanner'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionGate>
      <AdminGuard>
        <RepairsProvider>
          <AdminLayoutProvider>
            <AdminLayout>
              <SubscriptionBanner />
              {children}
            </AdminLayout>
          </AdminLayoutProvider>
        </RepairsProvider>
      </AdminGuard>
    </SubscriptionGate>
  )
}
