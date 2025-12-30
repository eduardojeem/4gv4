'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, User, LogOut, Settings, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { useRepairs } from '@/contexts/RepairsContext'
import { useMemo, useState } from 'react'

export function TechnicianHeader() {
    const { repairs } = useRepairs()
    const { signOut } = useAuth()
    const router = useRouter()
    const [logoutOpen, setLogoutOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Get current technician (mock for now - should come from auth context)
    const currentTechnicianId = 'current-tech-id' // TODO: Get from auth

    // Calculate stats
    const technicianStats = useMemo(() => {
        const myRepairs = repairs.filter(r => r.technician_id === currentTechnicianId)
        const urgent = myRepairs.filter(r =>
            r.urgency === 'urgent' &&
            r.dbStatus !== 'listo' &&
            r.dbStatus !== 'entregado'
        )
        const active = myRepairs.filter(r =>
            r.dbStatus === 'reparacion' || r.dbStatus === 'diagnostico'
        )

        return { total: myRepairs.length, urgent: urgent.length, active: active.length }
    }, [repairs, currentTechnicianId])

    return (
        <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90">

            {/* Left: Title & Stats */}
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Panel de Técnico
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {technicianStats.active} activas · {technicianStats.total} totales
                    </p>
                </div>

                {technicianStats.urgent > 0 && (
                    <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {technicianStats.urgent} urgentes
                    </Badge>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">

                {/* Notifications */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="relative">
                            <Bell className="h-5 w-5" />
                            {technicianStats.urgent > 0 && (
                                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                                    {technicianStats.urgent}
                                </span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                        <div className="p-2 font-semibold text-sm border-b">
                            Notificaciones
                        </div>
                        {technicianStats.urgent > 0 ? (
                            <DropdownMenuItem>
                                <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                                {technicianStats.urgent} reparaciones urgentes pendientes
                            </DropdownMenuItem>
                        ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                No hay notificaciones nuevas
                            </div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Profile */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                                <User className="h-4 w-4 text-white" />
                            </div>
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-medium">Técnico</p>
                                <p className="text-xs text-muted-foreground">En servicio</p>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem>
                            <User className="h-4 w-4 mr-2" />
                            Mi Perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Configuración
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => setLogoutOpen(true)}>
                            <LogOut className="h-4 w-4 mr-2" />
                            Cerrar Sesión
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se cerrará tu sesión actual y volverás a la pantalla de acceso.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                setLoading(true)
                                try {
                                    await signOut()
                                    router.push('/login')
                                    router.refresh()
                                } finally {
                                    setLoading(false)
                                }
                            }}
                            disabled={loading}
                        >
                            {loading ? 'Cerrando…' : 'Cerrar sesión'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </header>
    )
}
