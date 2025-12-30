'use client'

import React, { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { 
  Users, 
  Shield, 
  Edit, 
  Trash2, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal,
  UserCheck,
  UserX,
  Crown,
  Key,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Mail,
  Phone,
  MapPin,
  Activity
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { UserRole, ROLE_PERMISSIONS, PERMISSIONS } from '@/lib/auth/roles-permissions'
import { format } from 'date-fns'

// Tipos para usuarios
export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  role: UserRole
  is_active: boolean
  last_sign_in?: Date
  created_at: Date
  updated_at: Date
  phone?: string
  location?: string
  department?: string
  permissions?: string[]
}

// Datos de ejemplo para usuarios
const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@empresa.com',
    name: 'Juan Pérez',
    avatar_url: '/avatars/01.svg',
    role: 'super_admin',
    is_active: true,
    last_sign_in: new Date('2024-01-15T10:30:00'),
    created_at: new Date('2024-01-01T00:00:00'),
    updated_at: new Date('2024-01-15T10:30:00'),
    phone: '+1234567890',
    location: 'Madrid, España',
    department: 'Administración'
  },
  {
    id: '2',
    email: 'manager@empresa.com',
    name: 'María García',
    avatar_url: '/avatars/02.svg',
    role: 'manager',
    is_active: true,
    last_sign_in: new Date('2024-01-15T09:15:00'),
    created_at: new Date('2024-01-02T00:00:00'),
    updated_at: new Date('2024-01-15T09:15:00'),
    phone: '+1234567891',
    location: 'Barcelona, España',
    department: 'Ventas'
  },
  {
    id: '3',
    email: 'empleado@empresa.com',
    name: 'Carlos López',
    avatar_url: '/avatars/03.svg',
    role: 'employee',
    is_active: true,
    last_sign_in: new Date('2024-01-14T16:45:00'),
    created_at: new Date('2024-01-03T00:00:00'),
    updated_at: new Date('2024-01-14T16:45:00'),
    phone: '+1234567892',
    location: 'Valencia, España',
    department: 'Almacén'
  },
  {
    id: '4',
    email: 'viewer@empresa.com',
    name: 'Ana Martín',
    avatar_url: '/avatars/04.svg',
    role: 'viewer',
    is_active: false,
    last_sign_in: new Date('2024-01-10T14:20:00'),
    created_at: new Date('2024-01-04T00:00:00'),
    updated_at: new Date('2024-01-10T14:20:00'),
    phone: '+1234567893',
    location: 'Sevilla, España',
    department: 'Contabilidad'
  }
]

// Componente para mostrar el rol con icono
function RoleBadge({ role }: { role: UserRole }) {
  const roleConfig = {
    super_admin: { 
      label: 'Super Admin', 
      color: 'bg-red-100 text-red-800 border-red-200', 
      icon: Crown 
    },
    admin: { 
      label: 'Administrador', 
      color: 'bg-purple-100 text-purple-800 border-purple-200', 
      icon: Shield 
    },
    manager: { 
      label: 'Gerente', 
      color: 'bg-blue-100 text-blue-800 border-blue-200', 
      icon: UserCheck 
    },
    employee: { 
      label: 'Empleado', 
      color: 'bg-green-100 text-green-800 border-green-200', 
      icon: Users 
    },
    viewer: { 
      label: 'Visualizador', 
      color: 'bg-gray-100 text-gray-800 border-gray-200', 
      icon: Eye 
    }
  }

  const config = roleConfig[role]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`${config.color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

// Componente para editar usuario
function EditUserDialog({ 
  user, 
  open, 
  onOpenChange, 
  onSave 
}: { 
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (user: User) => void 
}) {
  const [formData, setFormData] = useState<Partial<User>>({})
  const { canManageUser } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      setFormData(user)
    }
  }, [user])

  const handleSave = () => {
    if (!user || !formData.role) return

    if (!canManageUser(user.role)) {
      toast({
        title: 'Error',
        description: 'No tienes permisos para editar este usuario',
        variant: 'destructive'
      })
      return
    }

    onSave({ ...user, ...formData } as User)
    onOpenChange(false)
    toast({
      title: 'Usuario actualizado',
      description: 'Los cambios se han guardado correctamente'
    })
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Modifica la información y permisos del usuario
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Visualizador</SelectItem>
                <SelectItem value="employee">Empleado</SelectItem>
                <SelectItem value="manager">Gerente</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Departamento</Label>
            <Input
              id="department"
              value={formData.department || ''}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Usuario activo</Label>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Guardar Cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Componente para mostrar permisos de un rol
function RolePermissions({ role }: { role: UserRole }) {
  const roleData = ROLE_PERMISSIONS[role]
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Permisos del Rol: {roleData.description}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roleData.permissions.map((permission) => (
            <div key={permission.id} className="flex items-center gap-2 p-2 border rounded">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="font-medium text-sm">{permission.name}</p>
                <p className="text-xs text-gray-500">{permission.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente principal de gestión de usuarios
export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer')
  
  const { hasPermission, canManageUser } = useAuth()
  const { toast } = useToast()

  // Filtrar usuarios
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name?.toLowerCase().includes(deferredSearch.toLowerCase()) ||
                           user.email.toLowerCase().includes(deferredSearch.toLowerCase())
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'active' && user.is_active) ||
                           (statusFilter === 'inactive' && !user.is_active)
      
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, deferredSearch, roleFilter, statusFilter])

  // Estadísticas de usuarios
  const userStats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.is_active).length,
      inactive: users.filter(u => !u.is_active).length,
      byRole: {
        super_admin: users.filter(u => u.role === 'super_admin').length,
        admin: users.filter(u => u.role === 'admin').length,
        manager: users.filter(u => u.role === 'manager').length,
        employee: users.filter(u => u.role === 'employee').length,
        viewer: users.filter(u => u.role === 'viewer').length
      }
    }
  }, [users])

  const handleEditUser = (user: User) => {
    if (!canManageUser(user.role)) {
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para editar este usuario',
        variant: 'destructive'
      })
      return
    }
    setSelectedUser(user)
    setEditDialogOpen(true)
  }

  const handleSaveUser = (updatedUser: User) => {
    setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u))
  }

  const handleToggleUserStatus = (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (!user || !canManageUser(user.role)) {
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para modificar este usuario',
        variant: 'destructive'
      })
      return
    }

    setUsers(users.map(u => 
      u.id === userId ? { ...u, is_active: !u.is_active } : u
    ))
    
    toast({
      title: 'Estado actualizado',
      description: `Usuario ${user.is_active ? 'desactivado' : 'activado'} correctamente`
    })
  }

  if (!hasPermission('users.read')) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Acceso Denegado</h3>
          <p className="text-gray-500">No tienes permisos para ver la gestión de usuarios</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestión de Usuarios
              </CardTitle>
              <CardDescription>
                Administra usuarios, roles y permisos del sistema
              </CardDescription>
            </div>
            {hasPermission('users.create') && (
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Usuario
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Usuarios</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
                <p className="text-2xl font-bold text-green-600">{userStats.active}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Usuarios Inactivos</p>
                <p className="text-2xl font-bold text-red-600">{userStats.inactive}</p>
              </div>
              <UserX className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Administradores</p>
                <p className="text-2xl font-bold text-purple-600">
                  {userStats.byRole.admin + userStats.byRole.super_admin}
                </p>
              </div>
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenido principal */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="roles">Roles y Permisos</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar usuarios..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRole | 'all')}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="employee">Empleado</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de usuarios */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último acceso</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback>
                              {user.name?.charAt(0) || user.email.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name || 'Sin nombre'}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={user.role} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.last_sign_in ? (
                          <div className="text-sm">
                            <p>{format(user.last_sign_in, 'dd/MM/yyyy')}</p>
                            <p className="text-gray-500">{format(user.last_sign_in, 'HH:mm')}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">Nunca</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{user.department || 'No asignado'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleUserStatus(user.id)}>
                              {user.is_active ? (
                                <>
                                  <UserX className="h-4 w-4 mr-2" />
                                  Desactivar
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Activar
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Seleccionar Rol para Ver Permisos</CardTitle>
                <CardDescription>
                  Explora los permisos asociados a cada rol del sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                    <SelectItem value="employee">Empleado</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <RolePermissions role={selectedRole} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de edición */}
      <EditUserDialog
        user={selectedUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveUser}
      />
    </div>
  )
}