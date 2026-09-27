import { AlertTriangle, CheckCircle2, HelpCircle, PackageX, Wrench } from 'lucide-react'
import type { RepairQualityCheck } from '@/types/repairs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const PRESENTATION = {
  passed: {
    label: 'Probado · Funciona',
    aria: 'Verificación técnica aprobada: el equipo funciona',
    icon: CheckCircle2,
    className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  failed: {
    label: 'Falló prueba · No entregar',
    aria: 'Verificación técnica fallida: no entregar el equipo como reparado',
    icon: AlertTriangle,
    className: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  },
  unrepairable: {
    label: 'No fue posible reparar',
    aria: 'Verificación técnica: no fue posible reparar el equipo',
    icon: Wrench,
    className: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  },
  withdrawn: {
    label: 'Retiro sin reparar',
    aria: 'Verificación técnica: el cliente retira el equipo sin reparar',
    icon: PackageX,
    className: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  },
} as const

export function RepairQualityBadge({
  qualityCheck,
  className,
}: {
  qualityCheck?: RepairQualityCheck | null
  className?: string
}) {
  const presentation = qualityCheck ? PRESENTATION[qualityCheck.result] : null
  const Icon = presentation?.icon ?? HelpCircle
  const label = presentation?.label ?? 'Sin verificar'
  const aria = presentation?.aria ?? 'Equipo sin verificación técnica registrada'

  return (
    <Badge
      variant="outline"
      aria-label={aria}
      title={qualityCheck?.note || aria}
      className={cn(
        'inline-flex h-6 w-fit items-center gap-1 whitespace-nowrap px-2 text-[10px] font-bold',
        presentation?.className ?? 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}
