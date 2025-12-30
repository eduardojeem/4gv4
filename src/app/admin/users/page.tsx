import { Suspense } from 'react'
import { UserManagement } from '@/components/admin/users/user-management'

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="p-4">Cargando gestión de usuarios...</div>}>
        <UserManagement />
      </Suspense>
    </div>
  )
}
