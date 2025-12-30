'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
    LogIn,
    UserPlus,
    Edit,
    Trash2,
    Shield,
    FileText,
    Settings,
    AlertTriangle,
    CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActivityLog {
    id: string
    action: string
    details: string
    timestamp: string
    type: 'info' | 'warning' | 'error' | 'success'
    icon?: string
}

interface UserActivityTimelineProps {
    logs: ActivityLog[]
    className?: string
}

export function UserActivityTimeline({ logs, className }: UserActivityTimelineProps) {
    const getIcon = (action: string) => {
        if (action.includes('login')) return LogIn
        if (action.includes('create')) return UserPlus
        if (action.includes('update')) return Edit
        if (action.includes('delete')) return Trash2
        if (action.includes('role')) return Shield
        if (action.includes('report')) return FileText
        if (action.includes('settings')) return Settings
        return CheckCircle
    }

    const getColor = (type: ActivityLog['type']) => {
        switch (type) {
            case 'error': return 'text-red-500 bg-red-50 border-red-200'
            case 'warning': return 'text-orange-500 bg-orange-50 border-orange-200'
            case 'success': return 'text-green-500 bg-green-50 border-green-200'
            default: return 'text-blue-500 bg-blue-50 border-blue-200'
        }
    }

    if (logs.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <div className="bg-gray-50 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <p>No hay actividad registrada recientemente</p>
            </div>
        )
    }

    return (
        <ScrollArea className={cn("h-[400px] pr-4", className)}>
            <div className="space-y-4">
                {logs.map((log, index) => {
                    const Icon = getIcon(log.action.toLowerCase())
                    const isLast = index === logs.length - 1

                    return (
                        <div key={log.id} className="relative pl-6 pb-4">
                            {/* Línea conectora */}
                            {!isLast && (
                                <div className="absolute left-[11px] top-8 bottom-0 w-px bg-gray-200" />
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
                                    <span className="font-medium text-sm text-gray-900">
                                        {log.action}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600">
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
