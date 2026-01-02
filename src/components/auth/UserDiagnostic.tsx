'use client'

import React, { useState, useEffect } from 'react'
import { motion  } from '../ui/motion'
import { 
  User, Shield, Database, CheckCircle, XCircle, 
  RefreshCw, AlertTriangle, Settings, Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { usePermissions } from '@/hooks/use-permissions'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface DiagnosticData {
  user_id: string
  email: string
  auth_role?: string
  user_roles_table?: any
  profiles_table?: any
  user_metadata?: any
  computed_permissions?: string[]
  can_access_categories?: boolean
}

export function UserDiagnostic() {
  const { user, refreshUser } = useAuth()
  const { canAccessRoute, hasPermission, getUserPermissions } = usePermissions()
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null)
  const [loading, setLoading] = useState(false)

  const runDiagnostic = async () => {
    if (!user) return

    setLoading(true)
    try {
      const supabase = createClient()

      // Obtener datos de user_roles
      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)

      // Obtener datos de profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)

      // Compilar diagnóstico
      const diagnosticData: DiagnosticData = {
        user_id: user.id,
        email: user.email || 'No email',
        auth_role: user.role,
        user_roles_table: userRoles?.[0] || null,
        profiles_table: profiles?.[0] || null,
        user_metadata: user.user_metadata || {},
        computed_permissions: getUserPermissions().map(p => p.id),
        can_access_categories: canAccessRoute('/dashboard/categories')
      }

      setDiagnostic(diagnosticData)

      console.log('🔍 Diagnóstico completo:', diagnosticData)
      console.log('❌ Errores encontrados:', { userRolesError, profilesError })

    } catch (error) {
      console.error('Error en diagnóstico:', error)
      toast.error('Error al ejecutar diagnóstico')
    } finally {
      setLoading(false)
    }
  }

  const fixUserRole = async () => {
    if (!user) return

    setLoading(true)
    try {
      // Primero intentar sincronización
      const syncResponse = await fetch('/api/auth/sync-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const syncResult = await syncResponse.json()

      if (syncResponse.ok) {
        toast.success('Rol sincronizado correctamente')
        console.log('🔄 Resultado de sincronización:', syncResult)
      } else {
        console.warn('⚠️ Sincronización falló, intentando asignación directa')
        
        // Si la sincronización falla, intentar asignación directa
        const assignResponse = await fetch('/api/auth/assign-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'admin' })
        })

        const assignResult = await assignResponse.json()

        if (assignResponse.ok) {
          toast.success('Rol admin asignado correctamente')
        } else {
          toast.error(`Error: ${assignResult.error}`)
          return
        }
      }

      // Refrescar usuario y diagnóstico
      await refreshUser()
      setTimeout(() => {
        runDiagnostic()
      }, 1000)

    } catch (error) {
      toast.error('Error al reparar rol')
      console.error('💥 Error en reparación:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyDiagnostic = () => {
    if (diagnostic) {
      const text = JSON.stringify(diagnostic, null, 2)
      navigator.clipboard.writeText(text)
      toast.success('Diagnóstico copiado al portapapeles')
    }
  }

  useEffect(() => {
    if (user) {
      runDiagnostic()
    }
  }, [user])

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No hay usuario autenticado
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Diagnóstico de Permisos de Usuario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runDiagnostic} 
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Ejecutar Diagnóstico
            </Button>
            
            <Button 
              onClick={fixUserRole} 
              disabled={loading}
              variant="default"
            >
              <Settings className="h-4 w-4 mr-2" />
              Sincronizar Rol
            </Button>

            <Button 
              onClick={async () => {
                setLoading(true)
                await refreshUser()
                await runDiagnostic()
                setLoading(false)
                toast.success('Usuario actualizado')
              }} 
              disabled={loading}
              variant="outline"
            >
              <User className="h-4 w-4 mr-2" />
              Refrescar Usuario
            </Button>

            {diagnostic && (
              <Button 
                onClick={copyDiagnostic} 
                variant="outline"
                size="sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            )}
          </div>

          {diagnostic && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Información Básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Información Básica</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">ID:</span>
                      <code className="text-xs">{diagnostic.user_id.slice(0, 8)}...</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Email:</span>
                      <span className="text-sm">{diagnostic.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Rol Auth:</span>
                      <Badge variant={diagnostic.auth_role === 'admin' ? 'default' : 'secondary'}>
                        {diagnostic.auth_role || 'No definido'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Estado de Acceso</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Acceso a Categorías:</span>
                      {diagnostic.can_access_categories ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Permiso products.read:</span>
                      {hasPermission('products.read') ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tablas de Base de Datos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Tabla user_roles
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {diagnostic.user_roles_table ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Rol:</span>
                          <Badge>{diagnostic.user_roles_table.role}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Activo:</span>
                          {diagnostic.user_roles_table.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Actualizado:</span>
                          <span className="text-xs">
                            {new Date(diagnostic.user_roles_table.updated_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">No encontrado</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Tabla profiles
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {diagnostic.profiles_table ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Rol:</span>
                          <Badge>{diagnostic.profiles_table.role}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Nombre:</span>
                          <span className="text-sm">{diagnostic.profiles_table.full_name || 'N/A'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">No encontrado</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Permisos Computados */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Permisos Computados</CardTitle>
                </CardHeader>
                <CardContent>
                  {diagnostic.computed_permissions && diagnostic.computed_permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {diagnostic.computed_permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">Sin permisos</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recomendaciones */}
              {!diagnostic.can_access_categories && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-red-700 dark:text-red-300">
                      Problema Detectado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      No tienes acceso a categorías. Posibles causas:
                    </p>
                    <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 ml-4">
                      <li>• Rol no está en user_roles o profiles</li>
                      <li>• Rol está inactivo</li>
                      <li>• Desincronización entre tablas</li>
                      <li>• Cache de permisos desactualizado</li>
                    </ul>
                    <Button 
                      onClick={fixUserRole} 
                      disabled={loading}
                      className="mt-3"
                      size="sm"
                    >
                      Reparar Automáticamente
                    </Button>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}