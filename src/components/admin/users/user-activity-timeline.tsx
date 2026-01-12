'use client'

import { useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    LogIn,
    UserPlus,
    Edit,
    Trash2,
    Shield,
    FileText,
    Settings,
    CheckCircle,
    Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSecurityLogs } from '@/hooks/use-security-logs'

interface ActivityLog {
    id: string
    action: string
    details: string
    timestamp: string
    type: 'info' | 'warning' | 'error' | 'success'
    icon?: string
}

interface UserActivityTimelineProps {
    logs?: ActivityLog[]
    className?: string
    limit?: number
}

export function UserActivityTimeline({ logs: propLogs, className, limit = 50 }: UserActivityTimelineProps) {
    const { logs: securityLogs, isLoading, fetchSecurityLogs } = useSecurityLogs()

    useEffect(() => {
        if (!propLogs) {
            fetchSecurityLogs({ limit })
        }
    }, [fetchSecurityLogs, limit, propLogs])

    const displayLogs: ActivityLog[] = propLogs || securityLogs.map(log => ({
        id: log.id,
        action: log.event,
        details: `${log.details || ''} - Usuario: ${log.user}`,
        timestamp: log.timestamp,
        type: log.severity === 'critical' || log.severity === 'high' ? 'error' :
              log.severity === 'medium' ? 'warning' : 'info'
    }))

    const getIcon = (action: string) => {
        const lowerAction = action.toLowerCase()
        if (lowerAction.includes('login') || lowerAction.includes('inicio de sesión')) return LogIn
        if (lowerAction.includes('create') || lowerAction.includes('creación')) return UserPlus
        if (lowerAction.includes('update') || lowerAction.includes('actualización')) return Edit
        if (lowerAction.includes('delete') || lowerAction.includes('eliminación')) return Trash2
        if (lowerAction.includes('role') || lowerAction.includes('rol')) return Shield
        if (lowerAction.includes('report')) return FileText
        if (lowerAction.includes('settings')) return Settings
        return CheckCircle
    }

    const getColor = (type: ActivityLog['type']) => {
        switch (type) {
            case 'error': return 'text-red-500 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
            case 'warning': return 'text-orange-500 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400'
            case 'success': return 'text-green-500 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
            default: return 'text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
        }
    }

    if (isLoading && !propLogs) {
        return (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 dark:text-blue-400" />
            </div>
        )
    }

    if (displayLogs.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p>No hay actividad registrada recientemente</p>
            </div>
        )
    }

    return (
        <ScrollArea className={cn("h-[400px] pr-4", className)}>
            <div className="space-y-4">
                {displayLogs.map((log, index) => {
                    const Icon = getIcon(log.action)
                    const isLast = index === displayLogs.length - 1

                    return (
                        <div key={log.id} className="relative pl-6 pb-4">
                            {/* Línea conectora */}
                            {!isLast && (
                                <div className="absolute left-[11px] top-8 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                            )}

                            {/* Punto de tiempo */}
                            <div className={cn(
                                "absolute left-0 top-1 w-6 h-6 rounded-full border flex items-center justify-center z-10",
                                getColor(log.type)
                            )}>
                                <Icon className="h-3 w-3" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                        {log.action}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {log.details}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </ScrollArea>
    )
}
