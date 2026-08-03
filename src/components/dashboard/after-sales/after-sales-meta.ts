import type { ElementType } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    ArrowLeftRight,
    Ban,
    Check,
    RotateCcw,
    ShieldCheck,
    Wrench,
    X,
} from 'lucide-react'

/**
 * Metadata compartida de posventa. La usan tanto el listado como el diálogo de
 * alta, así que vive acá para que un cambio de etiqueta o de color no quede a
 * medias entre las dos pantallas.
 */

export type CaseStatus = 'open' | 'approved' | 'rejected' | 'completed' | 'cancelled'
export type RequestType = 'repair_warranty' | 'product_warranty' | 'exchange' | 'return'
export type SourceType = 'repair' | 'sale'

export const REQUEST_META: Record<RequestType, { label: string; icon: ElementType; className: string; hint: string }> = {
    repair_warranty: {
        label: 'Garantía de reparación',
        icon: Wrench,
        className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
        hint: 'El equipo volvió a fallar por lo mismo que se reparó.',
    },
    product_warranty: {
        label: 'Garantía de producto',
        icon: ShieldCheck,
        className: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300',
        hint: 'El producto vendido salió defectuoso.',
    },
    exchange: {
        label: 'Cambio',
        icon: ArrowLeftRight,
        className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300',
        hint: 'El cliente se lleva otro producto en su lugar.',
    },
    return: {
        label: 'Devolución',
        icon: RotateCcw,
        className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
        hint: 'Se devuelve el producto y se reintegra el dinero.',
    },
}

export const STATUS_META: Record<CaseStatus, { label: string; className: string }> = {
    open: { label: 'Abierto', className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300' },
    approved: { label: 'Aprobado', className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300' },
    rejected: { label: 'Rechazado', className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300' },
    completed: { label: 'Completado', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300' },
    cancelled: { label: 'Cancelado', className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' },
}

/** Espeja ALLOWED_TRANSITIONS de la API: si cambia una, cambia la otra. */
export const NEXT_ACTIONS: Record<CaseStatus, Array<{ status: CaseStatus; label: string; icon: ElementType; destructive?: boolean }>> = {
    open: [
        { status: 'approved', label: 'Aprobar', icon: Check },
        { status: 'rejected', label: 'Rechazar', icon: X, destructive: true },
        { status: 'cancelled', label: 'Cancelar', icon: Ban, destructive: true },
    ],
    approved: [
        { status: 'completed', label: 'Marcar completado', icon: Check },
        { status: 'cancelled', label: 'Cancelar', icon: Ban, destructive: true },
    ],
    rejected: [],
    completed: [],
    cancelled: [],
}

export function formatMoney(value: number | null | undefined) {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 })
        .format(Number(value) || 0)
}

export function formatDate(value?: string | null) {
    if (!value) return '—'
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return '—'
    return format(date, "d 'de' MMM yyyy", { locale: es })
}
