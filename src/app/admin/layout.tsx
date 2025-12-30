import { AdminLayoutProvider } from '@/contexts/AdminLayoutContext'
import { AdminLayout } from '@/components/admin/layout/AdminLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayoutProvider>
      <AdminLayout>
        {children}
      </AdminLayout>
    </AdminLayoutProvider>
  )
}