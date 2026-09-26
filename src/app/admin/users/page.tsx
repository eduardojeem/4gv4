import { Suspense } from 'react'
import { UserManagement } from '@/components/admin/users/user-management'
import { PlanLimitBanner } from '@/components/subscription/PlanLimitBanner'

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PlanLimitBanner resource="users" />
      <Suspense fallback={<div className="p-4">Cargando gestión de usuarios...</div>}>
        <UserManagement />
      </Suspense>
    </div>
  )
}
