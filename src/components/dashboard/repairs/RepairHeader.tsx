'use client'

import { AlertTriangle, PackageCheck, Plus, RefreshCw, Store, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RepairHeaderProps {
  onRefresh: () => void
  onNewRepair: () => void
  isLoading?: boolean
  totalRepairs: number
  activeRepairs: number
  urgentRepairs: number
  readyRepairs: number
  selectedBranchName?: string | null
}

export function RepairHeader({
  onRefresh,
  onNewRepair,
  isLoading,
  totalRepairs,
  activeRepairs,
  urgentRepairs,
  readyRepairs,
  selectedBranchName,
}: RepairHeaderProps) {
  const quickStats = [
    { label: 'En proceso', value: activeRepairs, tone: 'bg-white/[0.08] text-white' },
    { label: 'Urgentes', value: urgentRepairs, tone: 'bg-red-500/15 text-red-100' },
    { label: 'Listas', value: readyRepairs, tone: 'bg-emerald-500/15 text-emerald-100' },
  ] as const

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white shadow-[0_24px_80px_-40px_rgba(8,15,34,0.75)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.2),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(56,189,248,0.18),_transparent_30%)]" />
      <div className="absolute -right-20 top-6 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90">
                Reparaciones
              </Badge>
              {selectedBranchName && (
                <Badge
                  variant="outline"
                  className="rounded-full border-white/15 bg-white/8 px-3 py-1 text-[11px] font-medium text-white/80"
                >
                  <Store className="h-3.5 w-3.5" />
                  {selectedBranchName}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Todo el taller en un solo lugar.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/70 sm:text-[15px]">
                Aqui puedes ver que equipos siguen en proceso, cuales necesitan atencion y cuales ya estan listos para entregar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-white/85">
                <Wrench className="mr-1.5 h-4 w-4" />
                {totalRepairs} visibles
              </Badge>
              {quickStats.map((stat) => (
                <Badge
                  key={stat.label}
                  className={cn('rounded-full border-0 px-3 py-1.5 text-sm font-medium', stat.tone)}
                >
                  {stat.value} {stat.label.toLowerCase()}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[260px] lg:max-w-[300px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/70 backdrop-blur-sm">
              {urgentRepairs > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-200" />
                  Hay {urgentRepairs} equipos que conviene revisar primero.
                </span>
              ) : readyRepairs > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-emerald-200" />
                  {readyRepairs} equipos ya estan listos para entregar.
                </span>
              ) : (
                <span>La vista de hoy esta ordenada y sin urgencias visibles.</span>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button
                onClick={onNewRepair}
                className="h-11 flex-1 gap-2 rounded-2xl bg-white text-slate-950 hover:bg-white/90"
              >
                <Plus className="h-4 w-4" />
                Nueva reparacion
                <kbd className="ml-auto hidden h-6 items-center rounded-full border border-slate-300 bg-slate-100 px-2 font-mono text-[10px] font-semibold text-slate-700 sm:inline-flex">
                  Ctrl + N
                </kbd>
              </Button>
              <Button
                variant="outline"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-11 gap-2 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
