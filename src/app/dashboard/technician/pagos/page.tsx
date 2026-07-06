'use client'

import { useAuth } from '@/contexts/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet } from 'lucide-react'
import { TechnicianPaymentsTab } from '@/components/dashboard/technicians/detail/TechnicianPaymentsTab'

export default function TechnicianMyPaymentsPage() {
  const { user } = useAuth()

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <Wallet className="h-3.5 w-3.5" />
          Panel técnico
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Mis cobros</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tu ganancia del mes, los pagos recibidos y el acuse de recibo.
        </p>
      </header>

      {!user ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <TechnicianPaymentsTab technicianId={user.id} canManage={false} canConfirmReceipt />
      )}
    </div>
  )
}
