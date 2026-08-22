'use client'

import { AlertTriangle, PackageCheck, Plus, RefreshCw, Store, Wrench, Sliders } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HelpButton } from '@/components/help/HelpButton'

interface RepairHeaderProps {
  onRefresh: () => void
  onNewRepair: () => void
  onOpenReceiptSettings?: () => void
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
  onOpenReceiptSettings,
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
    <div className="rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm dark:border-slate-800">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-3">
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

            <div className="space-y-1">
              <h1 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
                Reparaciones
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/70">
                Prioriza urgentes, sigue estados y entrega equipos desde una sola vista.
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

          <div className="flex flex-col gap-3 lg:min-w-[260px] lg:max-w-[320px]">
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button
                data-help-id="repair-new"
                onClick={onNewRepair}
                className="h-10 flex-1 gap-2 rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-950/20 hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-200 font-bold"
              >
                <Plus className="h-4 w-4" />
                Nueva reparacion
                <kbd className="ml-auto hidden h-6 items-center rounded-full border border-emerald-200/70 bg-emerald-50 px-2 font-mono text-[10px] font-semibold text-emerald-900 sm:inline-flex">
                  Ctrl + N
                </kbd>
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="h-10 flex-1 gap-2 rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white text-xs font-semibold"
                >
                  <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                  Actualizar
                </Button>
                {onOpenReceiptSettings && (
                  <Button
                    variant="outline"
                    onClick={onOpenReceiptSettings}
                    title="Configurar opciones de comprobante, términos y papel"
                    className="h-10 px-3 rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white text-xs font-semibold gap-1.5"
                  >
                    <Sliders className="h-4 w-4 text-emerald-300" />
                    <span className="hidden sm:inline">Comprobantes</span>
                  </Button>
                )}
                <HelpButton
                  guideKey="repairs"
                  showLabel
                  variant="outline"
                  className="h-10 w-10 rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto [&>span]:hidden sm:[&>span]:inline"
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/70">
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
          </div>
        </div>
      </div>
    </div>
  )
}
