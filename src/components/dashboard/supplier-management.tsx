'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Supplier {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  taxId: string
  isActive: boolean
  rating: number
  paymentTerms: string
  deliveryTime: number
  minimumOrder: number
  lastSync: Date
  syncStatus: 'success' | 'error' | 'pending' | 'never'
  products: number
  notes: string
  createdAt: Date
  updatedAt: Date
}

interface SupplierFormData {
  name: string
  contact: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  taxId: string
  isActive: boolean
  rating: number
  paymentTerms: string
  deliveryTime: number
  minimumOrder: number
  notes: string
}

const mockSuppliers: Supplier[] = [
  {
    id: '1',
    name: 'TechDistribuidor SA',
    contact: 'Juan Pérez',
    email: 'juan@techdist.com',
    phone: '+1234567890',
    address: 'Av. Principal 123',
    city: 'Ciudad de México',
    country: 'México',
    taxId: 'RFC123456789',
    isActive: true,
    rating: 4.5,
    paymentTerms: '30 días',
    deliveryTime: 5,
    minimumOrder: 1000,
    lastSync: new Date('2024-01-15T10:30:00'),
    syncStatus: 'success',
    products: 245,
    notes: 'Proveedor confiable con buenos precios',
    createdAt: new Date('2023-06-01'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: '2',
    name: 'Electrónicos del Norte',
    contact: 'María García',
    email: 'maria@electronicos.com',
    phone: '+1234567891',
    address: 'Calle Comercio 456',
    city: 'Monterrey',
    country: 'México',
    taxId: 'RFC987654321',
    isActive: true,
    rating: 4.2,
    paymentTerms: '15 días',
    deliveryTime: 3,
    minimumOrder: 500,
    lastSync: new Date('2024-01-14T15:45:00'),
    syncStatus: 'success',
    products: 189,
    notes: 'Especialista en accesorios',
    createdAt: new Date('2023-08-15'),
    updatedAt: new Date('2024-01-14')
  },
  {
    id: '3',
    name: 'Importadora Global',
    contact: 'Carlos López',
    email: 'carlos@global.com',
    phone: '+1234567892',
    address: 'Zona Industrial 789',
    city: 'Guadalajara',
    country: 'México',
    taxId: 'RFC456789123',
    isActive: false,
    rating: 3.8,
    paymentTerms: '45 días',
    deliveryTime: 10,
    minimumOrder: 2000,
    lastSync: new Date('2024-01-10T08:20:00'),
    syncStatus: 'error',
    products: 67,
    notes: 'Problemas recientes con entregas',
    createdAt: new Date('2023-04-20'),
    updatedAt: new Date('2024-01-10')
  },
  {
    id: '4',
    name: 'Mayorista Central',
    contact: 'Ana Rodríguez',
    email: 'ana@mayorista.com',
    phone: '+1234567893',
    address: 'Centro Comercial 321',
    city: 'Puebla',
    country: 'México',
    taxId: 'RFC789123456',
    isActive: true,
    rating: 4.8,
    paymentTerms: '20 días',
    deliveryTime: 2,
    minimumOrder: 300,
    lastSync: new Date('2024-01-16T12:00:00'),
    syncStatus: 'success',
    products: 312,
    notes: 'Excelente servicio y rapidez',
    createdAt: new Date('2023-09-10'),
    updatedAt: new Date('2024-01-16')
  }
]

export function SupplierManagement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [syncFilter, setSyncFilter] = useState<'all' | 'success' | 'error' | 'pending' | 'never'>('all')
  const [isSyncing, setIsSyncing] = useState<string | null>(null)

  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'México',
    taxId: '',
    isActive: true,
    rating: 5,
    paymentTerms: '30 días',
    deliveryTime: 5,
    minimumOrder: 1000,
    notes: ''
  })

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && supplier.isActive) ||
                         (statusFilter === 'inactive' && !supplier.isActive)
    
    const matchesSync = syncFilter === 'all' || supplier.syncStatus === syncFilter

    return matchesSearch && matchesStatus && matchesSync
  })

  const resetForm = () => {
    setFormData({
      name: '',
      contact: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'México',
      taxId: '',
      isActive: true,
      rating: 5,
      paymentTerms: '30 días',
      deliveryTime: 5,
      minimumOrder: 1000,
      notes: ''
    })
  }

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      contact: supplier.contact,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      city: supplier.city,
      country: supplier.country,
      taxId: supplier.taxId,
      isActive: supplier.isActive,
      rating: supplier.rating,
      paymentTerms: supplier.paymentTerms,
      deliveryTime: supplier.deliveryTime,
      minimumOrder: supplier.minimumOrder,
      notes: supplier.notes
    })
    setSelectedSupplier(supplier)
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isEditing && selectedSupplier) {
      // Actualizar proveedor existente
      setSuppliers(prev => prev.map(supplier => 
        supplier.id === selectedSupplier.id 
          ? { ...supplier, ...formData, updatedAt: new Date() }
          : supplier
      ))
    } else {
      // Crear nuevo proveedor
      const newSupplier: Supplier = {
        id: Date.now().toString(),
        ...formData,
        lastSync: new Date(),
        syncStatus: 'never',
        products: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      setSuppliers(prev => [...prev, newSupplier])
    }

    setIsDialogOpen(false)
    setIsEditing(false)
    setSelectedSupplier(null)
    resetForm()
  }

  const handleDelete = (supplierId: string) => {
    setSuppliers(prev => prev.filter(supplier => supplier.id !== supplierId))
  }

  const handleSync = async (supplierId: string) => {
    setIsSyncing(supplierId)
    
    // Simular sincronización
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setSuppliers(prev => prev.map(supplier => 
      supplier.id === supplierId 
        ? { 
            ...supplier, 
            lastSync: new Date(), 
            syncStatus: Math.random() > 0.2 ? 'success' : 'error',
            updatedAt: new Date()
          }
        : supplier
    ))
    
    setIsSyncing(null)
  }

  const handleSyncAll = async () => {
    setIsSyncing('all')
    
    // Simular sincronización de todos
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    setSuppliers(prev => prev.map(supplier => ({
      ...supplier,
      lastSync: new Date(),
      syncStatus: Math.random() > 0.1 ? 'success' : 'error' as const,
      updatedAt: new Date()
    })))
    
    setIsSyncing(null)
  }

  const getSyncStatusIcon = (status: Supplier['syncStatus']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'never':
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const getSyncStatusBadge = (status: Supplier['syncStatus']) => {
    const variants = {
      success: 'default',
      error: 'destructive',
      pending: 'secondary',
      never: 'outline'
    } as const

    const labels = {
      success: 'Sincronizado',
      error: 'Error',
      pending: 'Pendiente',
      never: 'Sin sincronizar'
    }

    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Proveedores</h2>
          <p className="text-muted-foreground">
            Administra y sincroniza la información de tus proveedores
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSyncAll}
            disabled={isSyncing === 'all'}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing === 'all' ? 'animate-spin' : ''}`} />
            Sincronizar Todo
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsEditing(false); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Proveedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                </DialogTitle>
                <DialogDescription>
                  {isEditing ? 'Modifica la información del proveedor' : 'Completa la información del nuevo proveedor'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <Tabs defaultValue="basic" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Información Básica</TabsTrigger>
                    <TabsTrigger value="contact">Contacto</TabsTrigger>
                    <TabsTrigger value="terms">Términos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre de la Empresa *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Nombre del proveedor"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contact">Persona de Contacto *</Label>
                        <Input
                          id="contact"
                          value={formData.contact}
                          onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                          placeholder="Nombre del contacto"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="taxId">RFC/Tax ID</Label>
                        <Input
                          id="taxId"
                          value={formData.taxId}
                          onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                          placeholder="RFC o Tax ID"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="rating">Calificación</Label>
                        <Select value={formData.rating.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, rating: parseInt(value) }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Muy Malo</SelectItem>
                            <SelectItem value="2">2 - Malo</SelectItem>
                            <SelectItem value="3">3 - Regular</SelectItem>
                            <SelectItem value="4">4 - Bueno</SelectItem>
                            <SelectItem value="5">5 - Excelente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                      />
                      <Label htmlFor="isActive">Proveedor activo</Label>
                    </div>
                  </TabsContent>

                  <TabsContent value="contact" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="email@proveedor.com"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+52 55 1234 5678"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city">Ciudad</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          placeholder="Ciudad"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="country">País</Label>
                        <Input
                          id="country"
                          value={formData.country}
                          onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                          placeholder="País"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Dirección</Label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Dirección completa"
                        rows={2}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="terms" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="paymentTerms">Términos de Pago</Label>
                        <Select value={formData.paymentTerms} onValueChange={(value) => setFormData(prev => ({ ...prev, paymentTerms: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Contado">Contado</SelectItem>
                            <SelectItem value="15 días">15 días</SelectItem>
                            <SelectItem value="30 días">30 días</SelectItem>
                            <SelectItem value="45 días">45 días</SelectItem>
                            <SelectItem value="60 días">60 días</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="deliveryTime">Tiempo de Entrega (días)</Label>
                        <Input
                          id="deliveryTime"
                          type="number"
                          value={formData.deliveryTime}
                          onChange={(e) => setFormData(prev => ({ ...prev, deliveryTime: parseInt(e.target.value) || 0 }))}
                          placeholder="5"
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="minimumOrder">Pedido Mínimo ($)</Label>
                        <Input
                          id="minimumOrder"
                          type="number"
                          value={formData.minimumOrder}
                          onChange={(e) => setFormData(prev => ({ ...prev, minimumOrder: parseInt(e.target.value) || 0 }))}
                          placeholder="1000"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notas</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Notas adicionales sobre el proveedor..."
                        rows={3}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {isEditing ? 'Actualizar' : 'Crear'} Proveedor
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar proveedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={syncFilter} onValueChange={(value: any) => setSyncFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sincronización" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Sincronizado</SelectItem>
                <SelectItem value="error">Con Error</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="never">Sin Sincronizar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Proveedores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Proveedores ({filteredSuppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Sincronización</TableHead>
                <TableHead>Última Sync</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{supplier.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {supplier.city}, {supplier.country}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{supplier.contact}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {supplier.email}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {supplier.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                      {supplier.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>{supplier.products}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getSyncStatusIcon(supplier.syncStatus)}
                      {getSyncStatusBadge(supplier.syncStatus)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {supplier.lastSync.toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {supplier.lastSync.toLocaleTimeString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(supplier.id)}
                        disabled={isSyncing === supplier.id}
                      >
                        <RefreshCw className={`h-4 w-4 ${isSyncing === supplier.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(supplier)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(supplier.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Proveedores</p>
                <p className="text-2xl font-bold">{suppliers.length}</p>
              </div>
              <Building className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Activos</p>
                <p className="text-2xl font-bold text-green-600">
                  {suppliers.filter(s => s.isActive).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sincronizados</p>
                <p className="text-2xl font-bold text-blue-600">
                  {suppliers.filter(s => s.syncStatus === 'success').length}
                </p>
              </div>
              <RefreshCw className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Con Errores</p>
                <p className="text-2xl font-bold text-red-600">
                  {suppliers.filter(s => s.syncStatus === 'error').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}export default SupplierManagement
