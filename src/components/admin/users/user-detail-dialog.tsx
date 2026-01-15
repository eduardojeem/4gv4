'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Clock,
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { SupabaseUser } from '@/hooks/use-users-optimized'
import { UserActivityTimeline } from './user-activity-timeline'
import { createClient } from '@/lib/supabase/client'

interface UserDetailDialogProps {
  user: SupabaseUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface UserPermissions {
  [key: string]: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
}

export function UserDetailDialog({ user, open, onOpenChange }: UserDetailDialogProps) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false)

  useEffect(() => {
    if (user && open) {
      loadPermissions()
    }
  }, [user, open])

  const loadPermissions = async () => {
    if (!user) return
    
    setIsLoadingPermissions(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_user_permissions', {
        p_user_id: user.id
      })

      if (!error && data) {
        setPermissions(data)
      }
    } catch (err) {
      console.error('Error loading permissions:', err)
    } finally {
      setIsLoadingPermissions(false)
    }
  }

  if (!user) return null

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'supervisor': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300'
      case 'tecnico': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
      case 'vendedor': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300'
      case 'inactive': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300'
      case 'suspended': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getPermissionIcon = (hasPermission: boolean) => {
    return hasPermission ? (
      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
    ) : (
      <XCircle className="h-4 w-4 text-gray-400 dark:text-gray-600" />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt={user.name} 
                  className="h-full w-full rounded-full object-cover" 
                />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl">{user.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                  {user.role}
                </Badge>
                <Badge variant="outline" className={getStatusBadgeColor(user.status)}>
                  {user.status === 'active' ? 'Activo' : user.status === 'inactive' ? 'Inactivo' : 'Suspendido'}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">
              <User className="h-4 w-4 mr-2" />
              Información
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="h-4 w-4 mr-2" />
              Actividad
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <Shield className="h-4 w-4 mr-2" />
              Permisos
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            <TabsContent value="info" className="space-y-6">
              {/* Información de Contacto */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Información de Contacto
                </h3>
                <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.email}</p>
                    </div>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Teléfono</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.phone}</p>
                      </div>
                    </div>
                  )}
                  {user.department && (
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Departamento</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.department}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Información de Cuenta */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Información de Cuenta
                </h3>
                <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fecha de Creación</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {new Date(user.createdAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Último Acceso</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.lastLogin 
                          ? new Date(user.lastLogin).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Nunca'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">ID de Usuario</p>
                      <p className="text-xs font-mono text-gray-600 dark:text-gray-400">{user.id}</p>
                    </div>
                  </div>
                </div>
              </div>

              {user.notes && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Notas
                    </h3>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{user.notes}</p>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="activity">
              <UserActivityTimeline 
                logs={undefined}
                className="h-[450px]"
                limit={50}
              />
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              {isLoadingPermissions ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : permissions ? (
                <div className="space-y-4">
                  {Object.entries(permissions).map(([resource, perms]) => (
                    <div key={resource} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 capitalize">
                        {resource}
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          {getPermissionIcon(perms.create)}
                          <span className="text-sm text-gray-700 dark:text-gray-300">Crear</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPermissionIcon(perms.read)}
                          <span className="text-sm text-gray-700 dark:text-gray-300">Leer</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPermissionIcon(perms.update)}
                          <span className="text-sm text-gray-700 dark:text-gray-300">Actualizar</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPermissionIcon(perms.delete)}
                          <span className="text-sm text-gray-700 dark:text-gray-300">Eliminar</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No se pudieron cargar los permisos</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
