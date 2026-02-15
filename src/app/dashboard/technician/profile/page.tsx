'use client'
import { logger } from '@/lib/logger'

import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRepairs } from '@/contexts/RepairsContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
    User,
    Mail,
    Phone,
    MapPin,
    Shield,
    Calendar,
    Trophy,
    Clock,
    CheckCircle2,
    Activity,
    Settings,
    Bell,
    Lock
} from 'lucide-react'

export default function TechnicianProfilePage() {
    const { user, updateProfile } = useAuth()
    const { repairs } = useRepairs()
    const [isEditing, setIsEditing] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        name: user?.profile?.name || '',
        phone: user?.profile?.phone || '',
        location: user?.profile?.location || '',
    })

    // Calculate stats
    const stats = useMemo(() => {
        if (!user?.id) return { completed: 0, efficiency: 0, rating: 0, active: 0 }

        const myRepairs = repairs.filter(r => r.technician?.id === user.id)
        const completed = myRepairs.filter(r => r.dbStatus === 'listo' || r.dbStatus === 'entregado').length
        const active = myRepairs.filter(r => r.dbStatus !== 'listo' && r.dbStatus !== 'entregado').length

        // Mock efficiency (avg days to complete)
        const efficiency = 2.4
        // Mock rating
        const rating = 4.8

        return { completed, efficiency, rating, active }
    }, [repairs, user?.id])

    const handleSaveProfile = async () => {
        setIsLoading(true)
        try {
            const { error } = await updateProfile({
                name: formData.name,
                phone: formData.phone,
                location: formData.location
            })

            if (error) throw new Error(error)

            toast.success('Perfil actualizado correctamente')
            setIsEditing(false)
        } catch (error) {
            toast.error('Error al actualizar perfil')
            logger.error('Error loading technician profile', { error })
        } finally {
            setIsLoading(false)
        }
    }

    if (!user) return null

    return (
        <div className="space-y-6 p-6 max-w-6xl mx-auto animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="relative mb-8">
                <div className="h-48 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg opacity-90"></div>
                <div className="absolute -bottom-16 left-8 flex items-end gap-6">
                    <Avatar className="h-32 w-32 border-4 border-white shadow-xl">
                        <AvatarImage src={user.profile?.avatar_url} />
                        <AvatarFallback className="text-4xl bg-slate-100 text-slate-600">
                            {user.email?.[0].toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="mb-4 space-y-1">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white drop-shadow-sm">
                            {user.profile?.name || 'Técnico'}
                        </h1>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-white/90 text-blue-700 hover:bg-white shadow-sm">
                                {user.role?.toUpperCase() || 'TECNICO'}
                            </Badge>
                            <span className="text-sm text-slate-500 font-medium bg-white/80 px-2 py-0.5 rounded-full shadow-sm">
                                {user.email}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-20 grid gap-6 md:grid-cols-12">
                {/* Left Column: Stats & Info */}
                <div className="md:col-span-4 space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <CheckCircle2 className="h-8 w-8 text-green-600 mb-2" />
                                <span className="text-2xl font-bold text-green-700">{stats.completed}</span>
                                <span className="text-xs text-green-600 font-medium">Completadas</span>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <Activity className="h-8 w-8 text-blue-600 mb-2" />
                                <span className="text-2xl font-bold text-blue-700">{stats.active}</span>
                                <span className="text-xs text-blue-600 font-medium">Activas</span>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <Trophy className="h-8 w-8 text-amber-600 mb-2" />
                                <span className="text-2xl font-bold text-amber-700">{stats.rating}</span>
                                <span className="text-xs text-amber-600 font-medium">Calificación</span>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <Clock className="h-8 w-8 text-purple-600 mb-2" />
                                <span className="text-2xl font-bold text-purple-700">{stats.efficiency}d</span>
                                <span className="text-xs text-purple-600 font-medium">Promedio</span>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Contact Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Información de Contacto</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-slate-700">{user.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-slate-700">{user.profile?.phone || 'No registrado'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="text-slate-700">{user.profile?.location || 'Sucursal Principal'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-slate-700">Miembro desde {new Date(user.created_at || '').toLocaleDateString()}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Settings & Details */}
                <div className="md:col-span-8">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Configuración de Perfil</CardTitle>
                            <CardDescription>Gestiona tu información personal y preferencias</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="general" className="w-full">
                                <TabsList className="mb-6 w-full justify-start">
                                    <TabsTrigger value="general" className="gap-2">
                                        <User className="h-4 w-4" /> General
                                    </TabsTrigger>
                                    <TabsTrigger value="notifications" className="gap-2">
                                        <Bell className="h-4 w-4" /> Notificaciones
                                    </TabsTrigger>
                                    <TabsTrigger value="security" className="gap-2">
                                        <Shield className="h-4 w-4" /> Seguridad
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="general" className="space-y-6">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Nombre Completo</Label>
                                            <Input
                                                id="name"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                disabled={!isEditing}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input id="email" value={user.email} disabled className="bg-slate-50" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="phone">Teléfono</Label>
                                            <Input
                                                id="phone"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                disabled={!isEditing}
                                                placeholder="+54 9 ..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="location">Ubicación / Sucursal</Label>
                                            <Input
                                                id="location"
                                                value={formData.location}
                                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                                disabled={!isEditing}
                                                placeholder="Ej. Centro"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-4 pt-4">
                                        {isEditing ? (
                                            <>
                                                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>
                                                    Cancelar
                                                </Button>
                                                <Button onClick={handleSaveProfile} disabled={isLoading}>
                                                    {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                                                </Button>
                                            </>
                                        ) : (
                                            <Button onClick={() => setIsEditing(true)}>
                                                Editar Perfil
                                            </Button>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="notifications" className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">Nuevas Asignaciones</Label>
                                                <p className="text-sm text-muted-foreground">Recibir notificaciones cuando se me asigne una reparación</p>
                                            </div>
                                            <Switch defaultChecked />
                                        </div>
                                        <div className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">Actualizaciones de Estado</Label>
                                                <p className="text-sm text-muted-foreground">Notificar cuando un cliente apruebe un presupuesto</p>
                                            </div>
                                            <Switch defaultChecked />
                                        </div>
                                        <div className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">Resumen Semanal</Label>
                                                <p className="text-sm text-muted-foreground">Recibir un reporte de rendimiento semanal por email</p>
                                            </div>
                                            <Switch />
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="security" className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-100">
                                            <div className="flex items-start gap-3">
                                                <Lock className="h-5 w-5 text-yellow-600 mt-0.5" />
                                                <div>
                                                    <h4 className="font-medium text-yellow-800">Contraseña</h4>
                                                    <p className="text-sm text-yellow-700 mt-1">
                                                        Para cambiar tu contraseña, por favor contacta al administrador del sistema o utiliza la opción de recuperación de contraseña en la pantalla de login.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Sesiones Activas</Label>
                                            <div className="flex items-center justify-between p-3 border rounded bg-slate-50">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                                    <div className="text-sm">
                                                        <p className="font-medium">Windows PC - Chrome</p>
                                                        <p className="text-xs text-muted-foreground">Activo ahora • Buenos Aires, AR</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline">Actual</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
