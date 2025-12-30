"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { 
  Shield, Users, Key, Lock, Unlock, Plus, Edit, Trash2, 
  Search, Filter, Eye, Settings, UserCheck, UserX,
  Crown, Star, AlertTriangle, CheckCircle, XCircle,
  Database, FileText, ShoppingCart, BarChart3, Cog
} from 'lucide-react'

interface Permission {
  id: string
  name: string
  description: string
  category: string
  resource: string
  action: string
  level: 'read' | 'write' | 'delete' | 'admin'
}

interface Role {
  id: string
  name: string
  description: string
  color: string
  level: number
  permissions: string[]
  userCount: number
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

interface User {
  id: string
  name: string
  email: string
  avatar: string
  roles: string[]
  status: 'active' | 'inactive' | 'suspended'
  lastLogin: Date
}

// Datos mock
const mockPermissions: Permission[] = [
  // Usuarios
  { id: '1', name: 'Ver Usuarios', description: 'Visualizar lista de usuarios', category: 'Usuarios', resource: 'users', action: 'read', level: 'read' },
  { id: '2', name: 'Crear Usuarios', description: 'Crear nuevos usuarios', category: 'Usuarios', resource: 'users', action: 'create', level: 'write' },
  { id: '3', name: 'Editar Usuarios', description: 'Modificar información de usuarios', category: 'Usuarios', resource: 'users', action: 'update', level: 'write' },
  { id: '4', name: 'Eliminar Usuarios', description: 'Eliminar usuarios del sistema', category: 'Usuarios', resource: 'users', action: 'delete', level: 'delete' },
  
  // Productos
  { id: '5', name: 'Ver Productos', description: 'Visualizar catálogo de productos', category: 'Productos', resource: 'products', action: 'read', level: 'read' },
  { id: '6', name: 'Gestionar Productos', description: 'Crear, editar y eliminar productos', category: 'Productos', resource: 'products', action: 'manage', level: 'write' },
  { id: '7', name: 'Gestionar Inventario', description: 'Controlar stock y movimientos', category: 'Productos', resource: 'inventory', action: 'manage', level: 'write' },
  
  // Ventas
  { id: '8', name: 'Ver Ventas', description: 'Visualizar historial de ventas', category: 'Ventas', resource: 'sales', action: 'read', level: 'read' },
  { id: '9', name: 'Procesar Ventas', description: 'Realizar y procesar ventas', category: 'Ventas', resource: 'sales', action: 'create', level: 'write' },
  { id: '10', name: 'Gestionar Pedidos', description: 'Administrar pedidos y devoluciones', category: 'Ventas', resource: 'orders', action: 'manage', level: 'write' },
  
  // Reportes
  { id: '11', name: 'Ver Reportes', description: 'Acceder a reportes básicos', category: 'Reportes', resource: 'reports', action: 'read', level: 'read' },
  { id: '12', name: 'Generar Reportes', description: 'Crear reportes personalizados', category: 'Reportes', resource: 'reports', action: 'create', level: 'write' },
  { id: '13', name: 'Exportar Datos', description: 'Exportar información del sistema', category: 'Reportes', resource: 'exports', action: 'create', level: 'write' },
  
  // Sistema
  { id: '14', name: 'Configuración Sistema', description: 'Acceder a configuración del sistema', category: 'Sistema', resource: 'system', action: 'read', level: 'admin' },
  { id: '15', name: 'Gestionar Roles', description: 'Crear y modificar roles', category: 'Sistema', resource: 'roles', action: 'manage', level: 'admin' },
  { id: '16', name: 'Logs del Sistema', description: 'Acceder a logs y auditoría', category: 'Sistema', resource: 'logs', action: 'read', level: 'admin' }
]

const mockRoles: Role[] = [
  {
    id: '1',
    name: 'Super Administrador',
    description: 'Acceso completo al sistema',
    color: 'red',
    level: 100,
    permissions: mockPermissions.map(p => p.id),
    userCount: 2,
    isSystem: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: 'Administrador',
    description: 'Gestión general del sistema',
    color: 'blue',
    level: 80,
    permissions: ['1', '2', '3', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
    userCount: 5,
    isSystem: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  {
    id: '3',
    name: 'Gerente de Ventas',
    description: 'Gestión de ventas y reportes',
    color: 'green',
    level: 60,
    permissions: ['1', '5', '8', '9', '10', '11', '12'],
    userCount: 8,
    isSystem: false,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date()
  },
  {
    id: '4',
    name: 'Vendedor',
    description: 'Procesamiento de ventas',
    color: 'yellow',
    level: 40,
    permissions: ['1', '5', '8', '9'],
    userCount: 15,
    isSystem: false,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date()
  },
  {
    id: '5',
    name: 'Almacenista',
    description: 'Gestión de inventario',
    color: 'purple',
    level: 30,
    permissions: ['5', '6', '7'],
    userCount: 6,
    isSystem: false,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date()
  },
  {
    id: '6',
    name: 'Visualizador',
    description: 'Solo lectura de información',
    color: 'gray',
    level: 10,
    permissions: ['1', '5', '8', '11'],
    userCount: 12,
    isSystem: false,
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date()
  }
]

const mockUsers: User[] = [
  {
    id: '1',
    name: 'Juan Pérez',
    email: 'juan@empresa.com',
    avatar: '/avatars/01.svg',
    roles: ['1'],
    status: 'active',
    lastLogin: new Date()
  },
  {
    id: '2',
    name: 'María García',
    email: 'maria@empresa.com',
    avatar: '/avatars/02.svg',
    roles: ['2'],
    status: 'active',
    lastLogin: new Date(Date.now() - 3600000)
  },
  {
    id: '3',
    name: 'Carlos López',
    email: 'carlos@empresa.com',
    avatar: '/avatars/03.svg',
    roles: ['3'],
    status: 'active',
    lastLogin: new Date(Date.now() - 86400000)
  }
]

export default function RolesPermissions() {
  const [roles, setRoles] = useState<Role[]>(mockRoles)
  const [permissions] = useState<Permission[]>(mockPermissions)
  const [users] = useState<User[]>(mockUsers)
  const [activeTab, setActiveTab] = useState('roles')
  const [searchTerm, setSearchTerm] = useState('')
  const [permissionSearch, setPermissionSearch] = useState('')
  const [permissionSearchDebounced, setPermissionSearchDebounced] = useState('')
  const [permissionCategory, setPermissionCategory] = useState<string>('all')
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false)
  const [isAssignRoleOpen, setIsAssignRoleOpen] = useState(false)

  const getPermissionsByCategory = (source?: Permission[]) => {
    const list = source ?? permissions
    const categories = list.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = []
      }
      acc[permission.category].push(permission)
      return acc
    }, {} as Record<string, Permission[]>)
    return categories
  }

  // Debounce de la búsqueda de permisos
  useEffect(() => {
    const t = setTimeout(() => setPermissionSearchDebounced(permissionSearch.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [permissionSearch])

  // Lista de permisos filtrada por categoría y búsqueda
  const filteredPermissions = useMemo(() => {
    const match = (p: Permission) => {
      if (permissionCategory !== 'all' && p.category !== permissionCategory) return false
      if (!permissionSearchDebounced) return true
      const haystack = `${p.name} ${p.description} ${p.resource} ${p.action}`.toLowerCase()
      return haystack.includes(permissionSearchDebounced)
    }
    return permissions.filter(match)
  }, [permissions, permissionCategory, permissionSearchDebounced])

  // Toggle de un permiso para un rol
  const toggleRolePermission = (roleId: string, permissionId: string, value: boolean) => {
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r
      const has = r.permissions.includes(permissionId)
      const nextPerms = value
        ? (has ? r.permissions : [...r.permissions, permissionId])
        : (has ? r.permissions.filter(id => id !== permissionId) : r.permissions)
      return { ...r, permissions: nextPerms, updatedAt: new Date() }
    }))
  }

  // Mantener el modal del rol sincronizado con cambios en roles
  useEffect(() => {
    if (!selectedRole) return
    const updated = roles.find(r => r.id === selectedRole.id)
    if (updated && updated !== selectedRole) {
      setSelectedRole(updated)
    }
  }, [roles, selectedRole])

  const getRoleColor = (color: string) => {
    const colors = {
      red: 'bg-red-100 text-red-800 border-red-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[color as keyof typeof colors] || colors.gray
  }

  const getRoleIcon = (level: number) => {
    if (level >= 90) return <Crown className="h-4 w-4" />
    if (level >= 70) return <Star className="h-4 w-4" />
    if (level >= 50) return <Shield className="h-4 w-4" />
    if (level >= 30) return <Key className="h-4 w-4" />
    return <Eye className="h-4 w-4" />
  }

  const getPermissionIcon = (category: string) => {
    const icons = {
      'Usuarios': <Users className="h-4 w-4" />,
      'Productos': <ShoppingCart className="h-4 w-4" />,
      'Ventas': <BarChart3 className="h-4 w-4" />,
      'Reportes': <FileText className="h-4 w-4" />,
      'Sistema': <Cog className="h-4 w-4" />
    }
    return icons[category as keyof typeof icons] || <Key className="h-4 w-4" />
  }

  const getLevelColor = (level: string) => {
    const colors = {
      read: 'bg-blue-100 text-blue-800',
      write: 'bg-green-100 text-green-800',
      delete: 'bg-red-100 text-red-800',
      admin: 'bg-purple-100 text-purple-800'
    }
    return colors[level as keyof typeof colors] || colors.read
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800'
    }
    return colors[status as keyof typeof colors] || colors.active
  }

  return (
    <div className="space-y-6">
      {/* Header simplificado */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center text-blue-700">
              <Shield className="h-6 w-6 mr-2 text-blue-700" />
              Roles y Permisos
            </h2>
            <p className="text-blue-700 mt-1">Gestiona roles, permisos y accesos del sistema</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Dialog open={isAssignRoleOpen} onOpenChange={setIsAssignRoleOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Asignar Roles
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Asignar Roles a Usuario</DialogTitle>
                  <DialogDescription>Selecciona el usuario y los roles a asignar</DialogDescription>
                </DialogHeader>
                {/* Contenido del diálogo */}
              </DialogContent>
            </Dialog>
            
            <Dialog open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Rol
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Rol</DialogTitle>
                  <DialogDescription>Define el nombre, descripción y permisos del rol</DialogDescription>
                </DialogHeader>
                {/* Contenido del diálogo */}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-blue-100 to-indigo-100 p-1">
          <TabsTrigger 
            value="roles" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white"
          >
            <Shield className="h-4 w-4 mr-2" />
            Roles
          </TabsTrigger>
          <TabsTrigger 
            value="permissions" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
          >
            <Key className="h-4 w-4 mr-2" />
            Permisos
          </TabsTrigger>
          <TabsTrigger 
            value="users" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
          >
            <Users className="h-4 w-4 mr-2" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger 
            value="matrix" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white"
          >
            <Database className="h-4 w-4 mr-2" />
            Matriz
          </TabsTrigger>
        </TabsList>

        {/* Tab: Roles */}
        <TabsContent value="roles" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => (
              <Card key={role.id} className={`border-2 shadow-lg hover:shadow-xl transition-all duration-300 ${getRoleColor(role.color)}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(role.level)}
                      <CardTitle className="text-lg">{role.name}</CardTitle>
                    </div>
                    {role.isSystem && (
                      <Badge variant="outline" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Sistema
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm">{role.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Nivel:</span>
                      <p className="font-medium">{role.level}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Usuarios:</span>
                      <p className="font-medium">{role.userCount}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Permisos:</span>
                      <p className="font-medium">{role.permissions.length}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Actualizado:</span>
                      <p className="font-medium text-xs">{role.updatedAt.toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-3 border-t">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedRole(role)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    {!role.isSystem && (
                      <>
                        <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800">
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Permisos */}
        <TabsContent value="permissions" className="space-y-6">
          {/* Filtros de permisos */}
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar permisos..."
                      value={permissionSearch}
                      onChange={(e) => setPermissionSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={permissionCategory} onValueChange={setPermissionCategory}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Filtrar por categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {Array.from(new Set(permissions.map(p => p.category))).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {Object.entries(getPermissionsByCategory(filteredPermissions)).map(([category, categoryPermissions]) => (
            <Card key={category} className="border-gray-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                <CardTitle className="text-gray-800 flex items-center">
                  {getPermissionIcon(category)}
                  <span className="ml-2">{category}</span>
                  <Badge variant="outline" className="ml-2">{categoryPermissions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-semibold text-gray-900">Permiso</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Descripción</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Recurso</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Acción</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Nivel</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Roles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryPermissions.map((permission) => {
                        const rolesWithPermission = roles.filter(role => 
                          role.permissions.includes(permission.id)
                        )
                        
                        return (
                          <tr key={permission.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-4">
                              <p className="font-medium text-gray-900">{permission.name}</p>
                            </td>
                            <td className="p-4">
                              <p className="text-sm text-gray-600">{permission.description}</p>
                            </td>
                            <td className="p-4">
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm">{permission.resource}</code>
                            </td>
                            <td className="p-4">
                              <code className="bg-blue-100 px-2 py-1 rounded text-sm text-blue-800">{permission.action}</code>
                            </td>
                            <td className="p-4">
                              <Badge className={getLevelColor(permission.level)}>
                                {permission.level}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1">
                                {rolesWithPermission.slice(0, 3).map((role) => (
                                  <Badge key={role.id} className={getRoleColor(role.color)} variant="outline">
                                    {role.name}
                                  </Badge>
                                ))}
                                {rolesWithPermission.length > 3 && (
                                  <Badge variant="outline">+{rolesWithPermission.length - 3}</Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Tab: Usuarios */}
        <TabsContent value="users" className="space-y-6">
          {/* Filtros */}
          <Card className="border-gray-200">
            <CardContent className="p-4">
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
                
                <Select>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar por rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Usuarios */}
          <Card className="border-gray-200 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-semibold text-gray-900">Usuario</th>
                      <th className="text-left p-4 font-semibold text-gray-900">Roles</th>
                      <th className="text-left p-4 font-semibold text-gray-900">Estado</th>
                      <th className="text-left p-4 font-semibold text-gray-900">Último Acceso</th>
                      <th className="text-left p-4 font-semibold text-gray-900">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const userRoles = roles.filter(role => user.roles.includes(role.id))
                      
                      return (
                        <tr key={user.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium">
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{user.name}</p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {userRoles.map((role) => (
                                <Badge key={role.id} className={getRoleColor(role.color)} variant="outline">
                                  {getRoleIcon(role.level)}
                                  <span className="ml-1">{role.name}</span>
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={getStatusBadge(user.status)}>
                              {user.status === 'active' ? 'Activo' : 
                               user.status === 'inactive' ? 'Inactivo' : 'Suspendido'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <p className="text-sm text-gray-600">
                              {user.lastLogin.toLocaleDateString()} {user.lastLogin.toLocaleTimeString()}
                            </p>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800">
                                <UserCheck className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800">
                                <UserX className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Matriz de Permisos */}
        <TabsContent value="matrix" className="space-y-6">
          <Card className="border-gray-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
              <CardTitle className="text-green-800">Matriz de Roles y Permisos</CardTitle>
              <CardDescription className="text-green-600">Vista general de permisos por rol</CardDescription>
            </CardHeader>
            <CardContent className="p-4 border-b">
              <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar permisos..."
                      value={permissionSearch}
                      onChange={(e) => setPermissionSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={permissionCategory} onValueChange={setPermissionCategory}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Filtrar por categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {Array.from(new Set(permissions.map(p => p.category))).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-900 sticky left-0 bg-gray-50">Permiso</th>
                      {roles.map((role) => (
                        <th key={role.id} className="text-center p-3 font-semibold text-gray-900 min-w-[120px]">
                          <div className="flex flex-col items-center">
                            <div className={`p-1 rounded-full ${getRoleColor(role.color)} mb-1`}>
                              {getRoleIcon(role.level)}
                            </div>
                            <span className="text-xs">{role.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(getPermissionsByCategory(filteredPermissions)).map(([category, categoryPermissions]) => (
                      <React.Fragment key={category}>
                        <tr className="bg-gray-100">
                          <td colSpan={roles.length + 1} className="p-3 font-semibold text-gray-800 border-b">
                            <div className="flex items-center">
                              {getPermissionIcon(category)}
                              <span className="ml-2">{category}</span>
                            </div>
                          </td>
                        </tr>
                        {categoryPermissions.map((permission) => (
                          <tr key={permission.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 sticky left-0 bg-white border-r">
                              <div>
                                <p className="font-medium text-gray-900">{permission.name}</p>
                                <p className="text-xs text-gray-500">{permission.description}</p>
                              </div>
                            </td>
                            {roles.map((role) => (
                              <td key={role.id} className="p-3 text-center">
                                <Checkbox
                                  checked={role.permissions.includes(permission.id)}
                                  disabled={role.isSystem}
                                  onCheckedChange={(checked) => toggleRolePermission(role.id, permission.id, Boolean(checked))}
                                  className="mx-auto"
                                />
                                {role.isSystem && (
                                  <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-center">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Sistema
                                  </div>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Detalles del Rol */}
      {selectedRole && (
        <Dialog open={!!selectedRole} onOpenChange={() => setSelectedRole(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                {getRoleIcon(selectedRole.level)}
                <span className="ml-2">{selectedRole.name}</span>
                {selectedRole.isSystem && (
                  <Badge variant="outline" className="ml-2">
                    <Lock className="h-3 w-3 mr-1" />
                    Sistema
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>{selectedRole.description}</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Nivel de Acceso:</span>
                  <p className="font-medium">{selectedRole.level}</p>
                </div>
                <div>
                  <span className="text-gray-500">Usuarios Asignados:</span>
                  <p className="font-medium">{selectedRole.userCount}</p>
                </div>
                <div>
                  <span className="text-gray-500">Total Permisos:</span>
                  <p className="font-medium">{selectedRole.permissions.length}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Permisos Asignados:</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {Object.entries(getPermissionsByCategory()).map(([category, categoryPermissions]) => {
                    const rolePermissions = categoryPermissions.filter(p => 
                      selectedRole.permissions.includes(p.id)
                    )
                    
                    if (rolePermissions.length === 0) return null
                    
                    return (
                      <div key={category} className="border rounded-lg p-3">
                        <h5 className="font-medium text-gray-800 flex items-center mb-2">
                          {getPermissionIcon(category)}
                          <span className="ml-2">{category}</span>
                          <Badge variant="outline" className="ml-2">{rolePermissions.length}</Badge>
                        </h5>
                        <div className="space-y-1">
                          {rolePermissions.map((permission) => (
                            <div key={permission.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{permission.name}</span>
                              <Badge className={getLevelColor(permission.level)}>
                                {permission.level}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}