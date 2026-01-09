'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Shield, User, DollarSign, FileText, Download,
  Eye, Settings, AlertTriangle, CheckCircle, Save
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext, UserPermissions } from '../contexts/CashRegisterContext'
import { toast } from 'sonner'

interface PermissionsModalProps {
  isOpen: boolean
  onClose: () => void
}

const PERMISSION_GROUPS = {
  basic: {
    title: 'Operaciones Básicas',
    icon: User,
    permissions: [
      { key: 'canOpenRegister', label: 'Abrir caja', description: 'Permite iniciar un turno de caja' },
      { key: 'canCloseRegister', label: 'Cerrar caja', description: 'Permite finalizar un turno de caja' }
    ]
  },
  cash: {
    title: 'Movimientos de Efectivo',
    icon: DollarSign,
    permissions: [
      { key: 'canAddCashIn', label: 'Ingresos de caja', description: 'Permite agregar dinero a la caja' },
      { key: 'canAddCashOut', label: 'Egresos de caja', description: 'Permite retirar dinero de la caja' }
    ]
  },
  reports: {
    title: 'Reportes y Datos',
    icon: FileText,
    permissions: [
      { key: 'canViewReports', label: 'Ver reportes', description: 'Permite acceder a reportes financieros' },
      { key: 'canExportData', label: 'Exportar datos', description: 'Permite descargar reportes en CSV' }
    ]
  },
  audit: {
    title: 'Auditoría y Seguridad',
    icon: Eye,
    permissions: [
      { key: 'canViewAuditLog', label: 'Ver log de auditoría', description: 'Permite acceder al registro de actividades' },
      { key: 'canManagePermissions', label: 'Gestionar permisos', description: 'Permite modificar permisos de usuarios' }
    ]
  }
}

const USER_ROLES = {
  cashier: {
    name: 'Cajero',
    description: 'Operaciones básicas de caja',
    permissions: {
      canOpenRegister: true,
      canCloseRegister: false,
      canAddCashIn: true,
      canAddCashOut: false,
      canViewReports: false,
      canExportData: false,
      canViewAuditLog: false,
      canManagePermissions: false,
      maxCashOutAmount: 50000,
      requiresApprovalForLargeAmounts: true
    }
  },
  supervisor: {
    name: 'Supervisor',
    description: 'Operaciones completas y reportes',
    permissions: {
      canOpenRegister: true,
      canCloseRegister: true,
      canAddCashIn: true,
      canAddCashOut: true,
      canViewReports: true,
      canExportData: true,
      canViewAuditLog: true,
      canManagePermissions: false,
      maxCashOutAmount: 500000,
      requiresApprovalForLargeAmounts: true
    }
  },
  admin: {
    name: 'Administrador',
    description: 'Acceso completo al sistema',
    permissions: {
      canOpenRegister: true,
      canCloseRegister: true,
      canAddCashIn: true,
      canAddCashOut: true,
      canViewReports: true,
      canExportData: true,
      canViewAuditLog: true,
      canManagePermissions: true,
      maxCashOutAmount: undefined,
      requiresApprovalForLargeAmounts: false
    }
  }
}

export function PermissionsModal({ isOpen, onClose }: PermissionsModalProps) {
  const { userPermissions, setUserPermissions, checkPermission } = useCashRegisterContext()
  const [tempPermissions, setTempPermissions] = useState<UserPermissions>(userPermissions)
  const [selectedRole, setSelectedRole] = useState<string>('')

  const canManagePermissions = checkPermission('canManagePermissions')

  const handlePermissionChange = (key: keyof UserPermissions, value: boolean | number | undefined) => {
    setTempPermissions(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const applyRolePermissions = (roleKey: string) => {
    const role = USER_ROLES[roleKey as keyof typeof USER_ROLES]
    if (role) {
      setTempPermissions(role.permissions)
      setSelectedRole(roleKey)
      toast.success(`Permisos de ${role.name} aplicados`)
    }
  }

  const savePermissions = () => {
    setUserPermissions(tempPermissions)
    toast.success('Permisos actualizados correctamente')
    onClose()
  }

  const resetPermissions = () => {
    setTempPermissions(userPermissions)
    setSelectedRole('')
  }

  const getCurrentRole = () => {
    for (const [key, role] of Object.entries(USER_ROLES)) {
      const matches = Object.entries(role.permissions).every(([permKey, permValue]) => {
        return tempPermissions[permKey as keyof UserPermissions] === permValue
      })
      if (matches) return { key, ...role }
    }
    return null
  }

  const currentRole = getCurrentRole()
  const hasChanges = JSON.stringify(tempPermissions) !== JSON.stringify(userPermissions)

  if (!canManagePermissions) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-5 w-5 text-red-500" />
              Acceso Denegado
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-muted-foreground">
              No tienes permisos para gestionar permisos de usuarios.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-primary" />
            Gestión de Permisos
            {currentRole && (
              <Badge variant="outline" className="ml-2">
                {currentRole.name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Quick Role Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Roles Predefinidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {Object.entries(USER_ROLES).map(([key, role]) => (
                  <div
                    key={key}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedRole === key 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => applyRolePermissions(key)}
                  >
                    <div className="font-medium">{role.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {role.description}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Permission Groups */}
          <div className="space-y-4">
            {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => {
              const GroupIcon = group.icon
              return (
                <Card key={groupKey}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GroupIcon className="h-4 w-4" />
                      {group.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {group.permissions.map((permission) => (
                      <div key={permission.key} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={permission.key} className="font-medium">
                              {permission.label}
                            </Label>
                            {tempPermissions[permission.key as keyof UserPermissions] && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {permission.description}
                          </p>
                        </div>
                        <Switch
                          id={permission.key}
                          checked={tempPermissions[permission.key as keyof UserPermissions] as boolean}
                          onCheckedChange={(checked) => 
                            handlePermissionChange(permission.key as keyof UserPermissions, checked)
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Configuración Avanzada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maxCashOut">Monto máximo de egreso</Label>
                  <Input
                    id="maxCashOut"
                    type="number"
                    value={tempPermissions.maxCashOutAmount || ''}
                    onChange={(e) => handlePermissionChange(
                      'maxCashOutAmount', 
                      e.target.value ? parseInt(e.target.value) : undefined
                    )}
                    placeholder="Sin límite"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dejar vacío para sin límite
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="requiresApproval">Requiere aprobación para montos grandes</Label>
                    <Switch
                      id="requiresApproval"
                      checked={tempPermissions.requiresApprovalForLargeAmounts || false}
                      onCheckedChange={(checked) => 
                        handlePermissionChange('requiresApprovalForLargeAmounts', checked)
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Solicita confirmación adicional para operaciones grandes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Permissions Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen de Permisos Actuales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {Object.entries(tempPermissions).map(([key, value]) => {
                  if (typeof value === 'boolean') {
                    return (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="capitalize">
                          {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </span>
                        <Badge variant={value ? "default" : "secondary"}>
                          {value ? 'Permitido' : 'Denegado'}
                        </Badge>
                      </div>
                    )
                  } else if (key === 'maxCashOutAmount' && value) {
                    return (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span>Límite de egreso</span>
                        <Badge variant="outline">
                          {formatCurrency(value)}
                        </Badge>
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={resetPermissions} disabled={!hasChanges}>
            Restablecer
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={savePermissions} disabled={!hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}