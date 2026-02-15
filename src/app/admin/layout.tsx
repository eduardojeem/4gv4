import { AdminLayoutProvider } from '@/contexts/AdminLayoutContext'
import { AdminLayout } from '@/components/admin/layout/AdminLayout'
import { AdminGuard } from '@/components/admin/AdminGuard'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminLayoutProvider>
        <AdminLayout>
          {children}
        </AdminLayout>
      </AdminLayoutProvider>
    </AdminGuard>
  )
}