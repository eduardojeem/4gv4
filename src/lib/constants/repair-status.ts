import type { LucideIcon } from 'lucide-react'
import type { Repair, RepairStatus } from '@/types/repairs'
import { Package, Clock, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react'

export type RepairStatusKey = 'recibido' | 'diagnostico' | 'reparacion' | 'pausado' | 'listo' | 'entregado' | 'cancelado'

export interface RepairStatusConfig {
  label: string
  color: string
  bgCard: string
  bgDot: string
  Icon: LucideIcon
  description: string
  stepIndex: number
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
}

export const REPAIR_STATUS_CONFIG: Record<RepairStatusKey, RepairStatusConfig> = {
  recibido: {
    label: 'Recibido',
    color: 'text-blue-600',
    bgCard: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900',
    bgDot: 'bg-blue-500',
    Icon: Package,
    description: 'Tu dispositivo ha sido recibido en nuestro taller.',
    stepIndex: 0,
    badgeVariant: 'secondary',
  },
  diagnostico: {
    label: 'Diagnóstico',
    color: 'text-violet-600',
    bgCard: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900',
    bgDot: 'bg-violet-500',
    Icon: Clock,
    description: 'Estamos evaluando el problema de tu equipo.',
    stepIndex: 1,
    badgeVariant: 'secondary',
  },
  reparacion: {
    label: 'En reparación',
    color: 'text-amber-600',
    bgCard: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900',
    bgDot: 'bg-amber-500',
    Icon: Wrench,
    description: 'Nuestros técnicos están trabajando en tu dispositivo.',
    stepIndex: 2,
    badgeVariant: 'default',
  },
  pausado: {
    label: 'Pausado',
    color: 'text-yellow-600',
    bgCard: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900',
    bgDot: 'bg-yellow-500',
    Icon: AlertCircle,
    description: 'La reparación está pausada. Posiblemente esperamos repuestos o tu aprobación.',
    stepIndex: 2,
    badgeVariant: 'secondary',
  },
  listo: {
    label: 'Listo para retirar',
    color: 'text-green-600',
    bgCard: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900',
    bgDot: 'bg-green-500',
    Icon: CheckCircle2,
    description: 'Tu equipo está listo. Puedes pasar a retirarlo.',
    stepIndex: 3,
    badgeVariant: 'default',
  },
  entregado: {
    label: 'Entregado',
    color: 'text-gray-600',
    bgCard: 'bg-gray-50 border-gray-200 dark:bg-gray-950/30 dark:border-gray-900',
    bgDot: 'bg-gray-500',
    Icon: Package,
    description: 'Reparación finalizada y entregada.',
    stepIndex: 4,
    badgeVariant: 'secondary',
  },
  cancelado: {
    label: 'Cancelado',
    color: 'text-red-600',
    bgCard: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900',
    bgDot: 'bg-red-500',
    Icon: AlertCircle,
    description: 'La reparación ha sido cancelada.',
    stepIndex: -1,
    badgeVariant: 'destructive',
  },
}

export const REPAIR_TIMELINE_STEPS = [
  { id: 'recibido', label: 'Recibido' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'reparacion', label: 'Reparación' },
  { id: 'listo', label: 'Listo' },
  { id: 'entregado', label: 'Entregado' },
] as const

type RepairStatusSource = Pick<Repair, 'status' | 'dbStatus'>

export const COMPLETED_REPAIR_STATUSES = new Set<RepairStatus>(['listo', 'entregado'])
export const INACTIVE_REPAIR_STATUSES = new Set<RepairStatus>(['listo', 'entregado', 'cancelado'])

export function resolveRepairStatus(repair: RepairStatusSource): RepairStatus {
  return (repair.dbStatus || repair.status) as RepairStatus
}

export function isCompletedRepair(repair: RepairStatusSource): boolean {
  return COMPLETED_REPAIR_STATUSES.has(resolveRepairStatus(repair))
}

export function isActiveRepair(repair: RepairStatusSource): boolean {
  return !INACTIVE_REPAIR_STATUSES.has(resolveRepairStatus(repair))
}

export function getRepairStatusConfig(status: string): RepairStatusConfig {
  return REPAIR_STATUS_CONFIG[status.toLowerCase() as RepairStatusKey] ?? REPAIR_STATUS_CONFIG.recibido
}
