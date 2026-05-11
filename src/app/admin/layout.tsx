import { AdminLayoutProvider } from '@/contexts/AdminLayoutContext'
import { AdminLayout } from '@/components/admin/layout/AdminLayout'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { RepairsProvider } from '@/contexts/RepairsContext'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <RepairsProvider>
        <AdminLayoutProvider>
          <AdminLayout>
            {children}
          </AdminLayout>
        </AdminLayoutProvider>
      </RepairsProvider>
    </AdminGuard>
  )
}
