import { BranchManagement } from '@/components/admin/branches/branch-management'
import { PlanLimitBanner } from '@/components/subscription/PlanLimitBanner'

export default function AdminBranchesPage() {
  return (
    <div className="space-y-4">
      <PlanLimitBanner resource="branches" />
      <BranchManagement />
    </div>
  )
}
