import {
    Clock, PlayCircle, Package, CheckCircle, XCircle, PauseCircle,
    Activity, Zap, Smartphone, Tablet, Laptop, Monitor
} from 'lucide-react'
import {
    StatusConfigItem, PriorityConfigItem, UrgencyConfigItem, DeviceTypeConfigItem,
    RepairStatus
} from '@/types/repairs'

export const statusConfig: Record<RepairStatus, StatusConfigItem> = {
    recibido: {
        label: 'Recibido',
        color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
        icon: Clock,
        bgColor: 'bg-amber-500',
        lightBg: 'bg-amber-100',
        columnBg: 'bg-amber-50/50 dark:bg-amber-950/20'
    },
    diagnostico: {
        label: 'Diagnóstico',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
        icon: Activity,
        bgColor: 'bg-indigo-500',
        lightBg: 'bg-indigo-100',
        columnBg: 'bg-indigo-50/50 dark:bg-indigo-950/20'
    },
    reparacion: {
        label: 'En Reparación',
        color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
        icon: PlayCircle,
        bgColor: 'bg-blue-500',
        lightBg: 'bg-blue-100',
        columnBg: 'bg-blue-50/50 dark:bg-blue-950/20'
    },
    pausado: {
        label: 'Pausado',
        color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
        icon: PauseCircle,
        bgColor: 'bg-purple-500',
        lightBg: 'bg-purple-100',
        columnBg: 'bg-purple-50/50 dark:bg-purple-950/20'
    },
    listo: {
        label: 'Listo para Entrega',
        color: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
        icon: Package,
        bgColor: 'bg-cyan-500',
        lightBg: 'bg-cyan-100',
        columnBg: 'bg-cyan-50/50 dark:bg-cyan-950/20'
    },
    entregado: {
        label: 'Entregado',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        icon: CheckCircle,
        bgColor: 'bg-emerald-500',
        lightBg: 'bg-emerald-100',
        columnBg: 'bg-emerald-50/50 dark:bg-emerald-950/20'
    },
    cancelado: {
        label: 'Cancelado',
        color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
        icon: XCircle,
        bgColor: 'bg-red-500',
        lightBg: 'bg-red-100',
        columnBg: 'bg-red-50/50 dark:bg-red-950/20'
    }
}

export const wipLimits: Partial<Record<RepairStatus, number>> = {
    recibido: 6,
    diagnostico: 5,
    reparacion: 8,
    pausado: 4,
    listo: 12,
    entregado: 20,
    cancelado: 0,
}

export const priorityConfig: Record<string, PriorityConfigItem> = {
    low: {
        label: 'Baja',
        color: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700',
        bgColor: 'bg-slate-400',
        icon: '●'
    },
    medium: {
        label: 'Media',
        color: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
        bgColor: 'bg-orange-500',
        icon: '●●'
    },
    high: {
        label: 'Alta',
        color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
        bgColor: 'bg-red-500',
        icon: '●●●'
    }
}

export const urgencyConfig: Record<string, UrgencyConfigItem> = {
    normal: {
        label: 'Normal',
        color: 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
        icon: Activity
    },
    urgent: {
        label: 'Urgente',
        color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
        icon: Zap
    }
}

export const deviceTypeConfig: Record<string, DeviceTypeConfigItem> = {
    smartphone: { label: 'Smartphone', icon: Smartphone },
    tablet: { label: 'Tablet', icon: Tablet },
    laptop: { label: 'Laptop', icon: Laptop },
    desktop: { label: 'Desktop', icon: Monitor },
    accessory: { label: 'Accesorio', icon: Package }
}
