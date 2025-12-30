'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, User, Crown, Briefcase, Settings, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { UserRole } from '@/lib/auth/roles-permissions'

interface RoleOption {
  role: UserRole
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  permissions: string[]
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'admin',
    title: 'Administrador',
    description: 'Acceso completo al sistema, incluyendo gestión de usuarios y configuraciones',
    icon: Crown,
    color: 'bg-purple-500',
    permissions: [
      'Gestión completa de productos y categorías',
      'Acceso a reportes y análisis',
      'Administración de usuarios',
      'Configuración del sistema',
      'Punto de venta avanzado'
    ]
  },
  {
    role: 'vendedor',
    title: 'Vendedor',
    description: 'Acceso a ventas, productos, categorías y reportes básicos',
    icon: Briefcase,
    color: 'bg-blue-500',
    permissions: [
      'Gestión de productos y categorías',
      'Punto de venta',
      'Gestión de clientes',
      'Reportes de ventas',
      'Inventario básico'
    ]
  },
  {
    role: 'tecnico',
    title: 'Técnico',
    description: 'Acceso a reparaciones, inventario y productos (solo lectura)',
    icon: Settings,
    color: 'bg-green-500',
    permissions: [
      'Gestión de reparaciones',
      'Consulta de productos',
      'Inventario básico',
      'Panel técnico',
      'Reportes básicos'
    ]
  }
]

export function RoleAssignment() {
  const { user, updateUserRole } = useAuth()
  const [loading, setLoading] = useState<UserRole | null>(null)
  const [assigned, setAssigned] = useState(false)

  const handleAssignRole = async (role: UserRole) => {
    if (!user) return

    setLoading(role)
    try {
      const response = await fetch('/api/auth/assign-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(`Error al asignar rol: ${result.error}`)
        return
      }

      toast.success(`Rol de ${ROLE_OPTIONS.find(r => r.role === role)?.title} asignado correctamente`)
      setAssigned(true)
      
      // Recargar la página después de un breve delay para que se actualicen los permisos
      setTimeout(() => {
        window.location.reload()
      }, 1500)

    } catch (error) {
      toast.error('Error inesperado al asignar rol')
      console.error('Error assigning role:', error)
    } finally {
      setLoading(null)
    }
  }

  if (assigned) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold">¡Rol Asignado!</h2>
          <p className="text-muted-foreground">Recargando la página para aplicar los cambios...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Configuración de Acceso</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Para acceder a la sección de categorías, necesitas asignarte un rol apropiado. 
            Selecciona el rol que mejor se adapte a tus necesidades.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ROLE_OPTIONS.map((option) => {
            const Icon = option.icon
            const isLoading = loading === option.role
            
            return (
              <motion.div
                key={option.role}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: ROLE_OPTIONS.indexOf(option) * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-all duration-200 cursor-pointer group">
                  <CardHeader className="text-center pb-4">
                    <div className={`w-12 h-12 mx-auto rounded-lg ${option.color} flex items-center justify-center mb-3`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl">{option.title}</CardTitle>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {option.description}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Permisos incluidos:</h4>
                      <ul className="space-y-1">
                        {option.permissions.map((permission, index) => (
                          <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                            {permission}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      onClick={() => handleAssignRole(option.role)}
                      disabled={isLoading}
                      className="w-full"
                      variant={option.role === 'admin' ? 'default' : 'outline'}
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Asignando...
                        </>
                      ) : (
                        <>
                          <User className="h-4 w-4 mr-2" />
                          Asignar Rol
                        </>
                      )}
                    </Button>

                    {option.role === 'admin' && (
                      <Badge variant="secondary" className="w-full justify-center">
                        Recomendado para acceso completo
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Nota:</strong> Puedes cambiar tu rol más tarde desde la configuración de usuario.
          </p>
          <p>
            Para acceder a <strong>categorías</strong>, necesitas el rol de <Badge variant="outline">Admin</Badge> o <Badge variant="outline">Vendedor</Badge>.
          </p>
        </div>
      </motion.div>
    </div>
  )
}