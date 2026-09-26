import { AdminLayoutProvider } from '@/contexts/AdminLayoutContext'
import { AdminLayout } from '@/components/admin/layout/AdminLayout'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { RepairsProvider } from '@/contexts/RepairsContext'
import { SubscriptionGate } from '@/components/admin/SubscriptionGate'
import { SubscriptionBanner } from '@/components/admin/SubscriptionBanner'
import { ActiveOrganizationProvider } from '@/contexts/ActiveOrganizationContext'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionGate>
      <ActiveOrganizationProvider>
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
      </ActiveOrganizationProvider>
    </SubscriptionGate>
  )
}
