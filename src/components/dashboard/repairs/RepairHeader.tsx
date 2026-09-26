import { AlertTriangle, PackageCheck, Plus, RefreshCw, Store, Wrench, Sliders, Flame, UserMinus, PauseCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HelpButton } from '@/components/help/HelpButton'
import { RepairLimitBanner } from './RepairLimitBanner'
import type { RepairStatus } from '@/types/repairs'

interface RepairHeaderProps {
  onRefresh: () => void
  onNewRepair?: () => void
  onOpenReceiptSettings?: () => void
  isLoading?: boolean
  totalRepairs: number
  activeRepairs: number
  urgentRepairs: number
  readyRepairs: number
  unassignedRepairs?: number
  pausedRepairs?: number
  statusFilter?: string
  onStatusFilterSelect?: (status: RepairStatus | 'all') => void
  selectedBranchName?: string | null
}

export function RepairHeader({
  onRefresh,
  onNewRepair,
  onOpenReceiptSettings,
  isLoading,
  totalRepairs,
  activeRepairs: _activeRepairs,
  urgentRepairs,
  readyRepairs,
  unassignedRepairs = 0,
  pausedRepairs = 0,
  statusFilter = 'all',
  onStatusFilterSelect,
  selectedBranchName,
}: RepairHeaderProps) {

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-xs dark:border-slate-800 p-3 sm:px-4 sm:py-3 transition-all">
      <div className="flex flex-col gap-2.5">
        {/* Fila Principal: Título, Sucursal, Cuota de Plan y Acciones */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white inline-flex items-center gap-2">
              Reparaciones
            </h1>

            {selectedBranchName && (
              <Badge
                variant="outline"
                className="rounded-full border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-medium text-white/80 gap-1 shrink-0"
              >
                <Store className="h-3 w-3" />
                {selectedBranchName}
              </Badge>
            )}

            <HelpButton
              guideKey="repairs"
              showLabel
              buttonLabel="¿Cómo funciona?"
              variant="outline"
              className="h-7 px-2.5 rounded-full border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/35 hover:text-white text-[11px] font-bold gap-1 shadow-2xs backdrop-blur-xs transition-all shrink-0"
            />

            {/* Cuota de Plan reubicada compacta en el encabezado */}
            <RepairLimitBanner compact reloadSignal={totalRepairs} className="shrink-0" />
          </div>

          {/* Botones de acción principales en fila compacta */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-end sm:self-auto">
            {onNewRepair && (
              <Button
                data-help-id="repair-new"
                onClick={onNewRepair}
                className="h-8 sm:h-8.5 gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3 sm:px-3.5 text-xs font-bold text-white shadow-xs focus-visible:ring-2 focus-visible:ring-emerald-200 active:scale-95 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nueva reparación</span>
                <kbd className="ml-1 hidden rounded-md border border-emerald-200/60 bg-emerald-600/40 px-1.5 font-mono text-[9px] font-semibold text-white sm:inline-flex">
                  Ctrl+N
                </kbd>
              </Button>
            )}

            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 sm:h-8.5 gap-1.5 rounded-xl border-white/15 bg-white/5 px-2.5 text-xs font-semibold text-white hover:bg-white/10 hover:text-white transition-colors"
              title="Actualizar lista de reparaciones"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              <span className="hidden md:inline">Actualizar</span>
            </Button>

            {onOpenReceiptSettings && (
              <Button
                variant="outline"
                onClick={onOpenReceiptSettings}
                title="Configurar opciones de comprobante, términos y papel"
                className="h-8 sm:h-8.5 gap-1.5 rounded-xl border-white/15 bg-white/5 px-2.5 text-xs font-semibold text-white hover:bg-white/10 hover:text-white transition-colors"
              >
                <Sliders className="h-3.5 w-3.5 text-emerald-300" />
                <span className="hidden md:inline">Comprobantes</span>
              </Button>
            )}
          </div>
        </div>

        {/* Fila Secundaria: Indicadores operativos pasados arriba */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/10 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-white/85">
              <Wrench className="mr-1 h-3 w-3" />
              {totalRepairs} visibles
            </Badge>

            {/* Urgentes */}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all',
                urgentRepairs > 0
                  ? 'border border-red-400/40 bg-red-500/20 text-red-200'
                  : 'bg-white/[0.06] text-white/70'
              )}
              title="Equipos con urgencia alta"
            >
              <Flame className="h-3 w-3 text-red-300" />
              <span>{urgentRepairs}</span>
              <span className="font-normal opacity-85">urgentes</span>
            </span>

            {/* Sin Técnico */}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all',
                unassignedRepairs > 0
                  ? 'border border-amber-400/40 bg-amber-500/20 text-amber-200'
                  : 'bg-white/[0.06] text-white/70'
              )}
              title="Equipos que requieren técnico asignado"
            >
              <UserMinus className="h-3 w-3 text-amber-300" />
              <span>{unassignedRepairs}</span>
              <span className="font-normal opacity-85">sin técnico</span>
            </span>

            {/* Listas para Entrega */}
            <button
              type="button"
              onClick={() => onStatusFilterSelect?.(statusFilter === 'listo' ? 'all' : 'listo')}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all cursor-pointer',
                readyRepairs > 0
                  ? 'border border-emerald-400/40 bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35'
                  : 'bg-white/[0.06] text-white/70 hover:bg-white/10',
                statusFilter === 'listo' ? 'ring-2 ring-emerald-300 ring-offset-1 ring-offset-slate-950 font-bold' : ''
              )}
              title="Filtrar equipos listos para cobro o entrega"
            >
              <PackageCheck className="h-3 w-3 text-emerald-300" />
              <span>{readyRepairs}</span>
              <span className="font-normal opacity-85">listas</span>
            </button>

            {/* En Pausa / Espera */}
            <button
              type="button"
              onClick={() => onStatusFilterSelect?.(statusFilter === 'pausado' ? 'all' : 'pausado')}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all cursor-pointer',
                pausedRepairs > 0
                  ? 'border border-violet-400/40 bg-violet-500/25 text-violet-100 hover:bg-violet-500/35'
                  : 'bg-white/[0.06] text-white/70 hover:bg-white/10',
                statusFilter === 'pausado' ? 'ring-2 ring-violet-300 ring-offset-1 ring-offset-slate-950 font-bold' : ''
              )}
              title="Filtrar equipos pausados a la espera de repuesto o cliente"
            >
              <PauseCircle className="h-3 w-3 text-violet-300" />
              <span>{pausedRepairs}</span>
              <span className="font-normal opacity-85">en pausa</span>
            </button>
          </div>

          <div className="text-[11px] text-white/70">
            {urgentRepairs > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-red-200 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5 text-red-300 shrink-0" />
                Hay {urgentRepairs} equipos prioritarios
              </span>
            ) : readyRepairs > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-200 font-semibold">
                <PackageCheck className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                {readyRepairs} equipos listos para entrega
              </span>
            ) : (
              <span className="opacity-60 hidden sm:inline">Sin urgencias pendientes</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
