'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRepairs } from '@/contexts/RepairsContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import {
  User, Mail, Phone, MapPin, Shield, Calendar,
  Trophy, Clock, CheckCircle2, Activity, Bell, Lock,
  Pencil, Save, X, Wrench, Star
} from 'lucide-react'

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  accent: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className={cn('p-2 rounded-lg', accent)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-gray-900 dark:text-gray-50 tabular-nums leading-tight">
          {value}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TechnicianProfilePage() {
  const { user, updateProfile } = useAuth()
  const { repairs } = useRepairs()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
  })

  // Notification preferences (local — would need backend to persist)
  const [notifications, setNotifications] = useState({
    newAssignments: true,
    statusUpdates: true,
    weeklyReport: false,
  })

  // Sync formData when user loads
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.profile?.name || '',
        phone: user.profile?.phone || '',
        location: user.profile?.location || '',
      })
    }
  }, [user])

  // Calculate stats from real repair data
  const stats = useMemo(() => {
    if (!user?.id) return { completed: 0, avgTime: 0, rating: 0, active: 0, total: 0 }

    const myRepairs = repairs.filter(r => r.technician?.id === user.id)
    const completed = myRepairs.filter(r => r.dbStatus === 'listo' || r.dbStatus === 'entregado')
    const active = myRepairs.filter(r =>
      r.dbStatus !== 'listo' && r.dbStatus !== 'entregado' && r.dbStatus !== 'cancelado'
    ).length

    // Average time to complete (in days)
    const completedWithDates = completed.filter(r => r.completedAt && r.createdAt)
    const avgTime = completedWithDates.length > 0
      ? Math.round(
          completedWithDates.reduce((acc, r) => {
            const days = (new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
            return acc + days
          }, 0) / completedWithDates.length * 10
        ) / 10
      : 0

    // Average rating
    const rated = myRepairs.filter(r => r.customerRating && r.customerRating > 0)
    const rating = rated.length > 0
      ? Math.round(rated.reduce((acc, r) => acc + (r.customerRating || 0), 0) / rated.length * 10) / 10
      : 0

    return { completed: completed.length, avgTime, rating, active, total: myRepairs.length }
  }, [repairs, user?.id])

  const handleSaveProfile = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await updateProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim()
      })

      if (error) throw new Error(error)

      toast.success('Perfil actualizado correctamente')
      setIsEditing(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido'
      toast.error(`Error al actualizar perfil: ${msg}`)
      logger.error('Error updating technician profile', { error })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelEdit = () => {
    // Reset form to current user data
    setFormData({
      name: user?.profile?.name || '',
      phone: user?.profile?.phone || '',
      location: user?.profile?.location || '',
    })
    setIsEditing(false)
  }

  // Loading state
  if (!user) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const initials = (user.profile?.name || user.email || 'T')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })
    : 'Desconocido'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ── Profile Header ── */}
      <Card className="border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700" />
        <CardContent className="relative pt-0 pb-5 px-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10">
            <Avatar className="h-20 w-20 border-4 border-white dark:border-slate-900 shadow-lg">
              <AvatarImage src={user.profile?.avatar_url} />
              <AvatarFallback className="text-xl font-bold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 truncate">
                {user.profile?.name || 'Técnico'}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-xs font-medium">
                  <Wrench className="h-3 w-3 mr-1" />
                  {user.role === 'admin' ? 'Administrador' : 'Técnico'}
                </Badge>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {user.email}
                </span>
              </div>
            </div>
            <Button
              variant={isEditing ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => isEditing ? handleCancelEdit() : setIsEditing(true)}
              className="gap-1.5 self-start sm:self-auto"
            >
              {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {isEditing ? 'Cancelar' : 'Editar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={CheckCircle2}
          label="Completadas"
          value={stats.completed}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />
        <StatCard
          icon={Activity}
          label="En proceso"
          value={stats.active}
          accent="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />
        <StatCard
          icon={Star}
          label="Calificación"
          value={stats.rating > 0 ? `${stats.rating}/5` : '—'}
          accent="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
        />
        <StatCard
          icon={Clock}
          label="Tiempo promedio"
          value={stats.avgTime > 0 ? `${stats.avgTime}d` : '—'}
          accent="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
        />
      </div>

      {/* ── Settings Tabs ── */}
      <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <TabsList className="w-full justify-start bg-transparent p-0 h-auto border-b border-gray-100 dark:border-slate-800 rounded-none">
              {[
                { value: 'general', icon: User, label: 'General' },
                { value: 'notifications', icon: Bell, label: 'Notificaciones' },
                { value: 'security', icon: Shield, label: 'Seguridad' },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-none px-4 pb-3 pt-2 text-sm font-medium text-gray-500 dark:text-gray-400"
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            {/* ── General Tab ── */}
            <TabsContent value="general" className="mt-0 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Nombre completo <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isEditing}
                    placeholder="Tu nombre"
                    className={cn(!isEditing && 'bg-gray-50 dark:bg-slate-800/50')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    value={user.email}
                    disabled
                    className="bg-gray-50 dark:bg-slate-800/50 text-gray-500"
                  />
                  <p className="text-[11px] text-gray-400">El email no se puede cambiar</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!isEditing}
                    placeholder="+598 99 123 456"
                    className={cn(!isEditing && 'bg-gray-50 dark:bg-slate-800/50')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium">Ubicación / Sucursal</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    disabled={!isEditing}
                    placeholder="Ej: Sucursal Centro"
                    className={cn(!isEditing && 'bg-gray-50 dark:bg-slate-800/50')}
                  />
                </div>
              </div>

              {/* Additional info (read-only) */}
              <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>Miembro desde <strong className="text-gray-900 dark:text-gray-200">{memberSince}</strong></span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                  <Wrench className="h-4 w-4 text-gray-400" />
                  <span><strong className="text-gray-900 dark:text-gray-200">{stats.total}</strong> reparaciones totales</span>
                </div>
              </div>

              {/* Save button */}
              {isEditing && (
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <Button variant="outline" onClick={handleCancelEdit} disabled={isLoading}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={isLoading} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    {isLoading ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ── Notifications Tab ── */}
            <TabsContent value="notifications" className="mt-0 space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Configura cómo y cuándo recibir notificaciones.
              </p>
              {[
                {
                  key: 'newAssignments' as const,
                  title: 'Nuevas asignaciones',
                  desc: 'Cuando se te asigne una nueva reparación',
                },
                {
                  key: 'statusUpdates' as const,
                  title: 'Actualizaciones de estado',
                  desc: 'Cuando un cliente apruebe un presupuesto o haya cambios',
                },
                {
                  key: 'weeklyReport' as const,
                  title: 'Resumen semanal',
                  desc: 'Reporte de rendimiento cada lunes por email',
                },
              ].map(item => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                  </div>
                  <Switch
                    checked={notifications[item.key]}
                    onCheckedChange={v => setNotifications(n => ({ ...n, [item.key]: v }))}
                  />
                </div>
              ))}
              <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-2">
                Las preferencias de notificación se guardan localmente por ahora.
              </p>
            </TabsContent>

            {/* ── Security Tab ── */}
            <TabsContent value="security" className="mt-0 space-y-4">
              {/* Password info */}
              <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-amber-800 dark:text-amber-300 text-sm">Cambiar contraseña</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
                      Para cambiar tu contraseña, usá la opción "Olvidé mi contraseña" en la pantalla de login o contactá al administrador.
                    </p>
                  </div>
                </div>
              </div>

              {/* Active session */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sesión activa</Label>
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Este dispositivo</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email} · Activo ahora</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">Actual</Badge>
                </div>
              </div>

              {/* Role info */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Rol y permisos</Label>
                <div className="p-3 rounded-lg border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user.role === 'admin' ? 'Administrador' : 'Técnico'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                    {user.role === 'admin'
                      ? 'Acceso completo al sistema, gestión de usuarios y configuración.'
                      : 'Acceso a reparaciones asignadas, agenda personal y perfil.'}
                  </p>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
