'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    User,
    Calendar,
    BarChart3,
    Wrench,
    ChevronLeft,
    ChevronRight,
    History
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const technicianNavItems = [
    {
        title: 'Reparaciones',
        href: '/dashboard/technician',
        icon: Wrench,
        description: 'Gestiona tus reparaciones'
    },
    {
        title: 'Mi Perfil',
        href: '/dashboard/technician/profile',
        icon: User,
        description: 'Información personal'
    },
    {
        title: 'Agenda',
        href: '/dashboard/technician/schedule',
        icon: Calendar,
        description: 'Calendario de trabajo'
    },
    {
        title: 'Estadísticas',
        href: '/dashboard/technician/stats',
        icon: BarChart3,
        description: 'Métricas y rendimiento'
    },
    {
        title: 'Historial',
        href: '/dashboard/technician/history',
        icon: History,
        description: 'Registro de reparaciones'
    }
]

export function TechnicianSidebar() {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)

    return (
        <aside
            className={cn(
                "relative flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300",
                collapsed ? "w-20" : "w-64"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                            <Wrench className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-sm">Panel Técnico</h2>
                            <p className="text-xs text-muted-foreground">Mis reparaciones</p>
                        </div>
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollapsed(!collapsed)}
                    className="h-8 w-8 p-0"
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1">
                {technicianNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                                "hover:bg-gray-100 dark:hover:bg-gray-800",
                                isActive && "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600",
                                !isActive && "text-gray-700 dark:text-gray-300"
                            )}
                            title={collapsed ? item.title : undefined}
                        >
                            <Icon className={cn(
                                "h-5 w-5 flex-shrink-0",
                                isActive && "text-white"
                            )} />
                            {!collapsed && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.title}</p>
                                    <p className={cn(
                                        "text-xs truncate",
                                        isActive ? "text-white/80" : "text-muted-foreground"
                                    )}>
                                        {item.description}
                                    </p>
                                </div>
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                >
                    <LayoutDashboard className="h-5 w-5" />
                    {!collapsed && <span className="text-sm">Volver al Dashboard</span>}
                </Link>
            </div>
        </aside>
    )
}
