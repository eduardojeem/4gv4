'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AdminFinanceFilters } from '@/hooks/use-admin-finances'
import { PayrollRunDialog } from './PayrollRunDialog'

export function PayrollPanel({ organizationId, branchId, filters, onChanged }: { organizationId: string; branchId: string | null | undefined; filters: AdminFinanceFilters; onChanged: () => unknown | Promise<unknown> }) {
  const [open, setOpen] = useState(false)
  return <section className="space-y-4 rounded-lg border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Nómina</h2><p className="text-sm text-muted-foreground">La vista previa refleja salarios y comisiones devengadas por el servidor. Los pagos se registran después de aprobar.</p></div><Button onClick={() => setOpen(true)} disabled={!branchId}>Preparar nómina</Button></div><PayrollRunDialog open={open} onOpenChange={setOpen} organizationId={organizationId} branchId={branchId} filters={filters} onSaved={onChanged} /></section>
}
