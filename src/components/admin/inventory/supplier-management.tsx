'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Building, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  Globe, 
  Package, 
  BarChart3,
  CreditCard,
  Eye,
  CheckCircle,
  Save,
  Star
} from 'lucide-react'
import { useInventory, Supplier, Product } from '@/hooks/use-inventory'
import { createClient } from '@/lib/supabase/client'

// Interfaces for UI state (extending the hook interface if needed)
// We will use the Supplier interface from the hook directly

interface SupplierProduct {
  id: string
  name: string
  sku: string
  cost: number
  stock: number
  status: string
}

const SupplierManagement: React.FC = () => {
  const { 
    suppliers, 
    loading, 
    createSupplier, 
    updateSupplier, 
    deleteSupplier,
    refreshSuppliers 
  } = useInventory()

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({})
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [productsLoading, setProductsLoading] = useState(false)

  const supabase = createClient()

  // Funciones utilitarias
  const getStatusColor = (status: string = 'active') => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
      case 'suspended': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
    }
  }

  const getRatingStars = (rating: number = 0) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
      />
    ))
  }

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (supplier.contact_person || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (supplier.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || supplier.status === filterStatus
    const matchesCategory = filterCategory === 'all' || supplier.category === filterCategory
    
    return matchesSearch && matchesStatus && matchesCategory
  })

  const categories = Array.from(new Set(suppliers.map(s => s.category).filter(Boolean))) as string[]

  // Handlers
  const handleAddSupplier = async () => {
    const validationErrors: Record<string, string> = {}
    
    if (!newSupplier.name?.trim()) validationErrors.name = 'El nombre es requerido'
    if (!newSupplier.email?.trim()) validationErrors.email = 'El email es requerido'
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    const supplierData = {
      ...newSupplier,
      status: newSupplier.status || 'active',
      rating: newSupplier.rating || 3,
      current_debt: 0,
      productCount: 0
    }

    const result = await createSupplier(supplierData)
    
    if (result.success) {
      setNewSupplier({})
      setErrors({})
      setIsAddDialogOpen(false)
    } else {
      setErrors({ form: result.error || 'Error al crear proveedor' })
    }
  }

  const handleEditSupplier = async () => {
    if (!editingSupplier.id) return

    const validationErrors: Record<string, string> = {}
    
    if (!editingSupplier.name?.trim()) validationErrors.name = 'El nombre es requerido'
    if (!editingSupplier.email?.trim()) validationErrors.email = 'El email es requerido'
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    const result = await updateSupplier(editingSupplier.id, editingSupplier)

    if (result.success) {
      setEditingSupplier({})
      setErrors({})
      setIsEditDialogOpen(false)
    } else {
      setErrors({ form: result.error || 'Error al actualizar proveedor' })
    }
  }

  const handleDeleteSupplier = async (supplierId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este proveedor?')) {
      await deleteSupplier(supplierId)
    }
  }

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setIsEditDialogOpen(true)
  }

  const openDetailDialog = async (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setIsDetailDialogOpen(true)
    
    // Fetch products for this supplier
    setProductsLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, purchase_price, stock_quantity, status')
        .eq('supplier_id', supplier.id)
      
      if (data) {
        setSupplierProducts(data.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          cost: p.purchase_price,
          stock: p.stock_quantity,
          status: p.status
        })))
      }
    } catch (err) {
      console.error('Error fetching supplier products:', err)
    } finally {
      setProductsLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Cargando proveedores...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Proveedores</h2>
          <p className="text-gray-600 dark:text-gray-400">Administra la información de contacto y productos de tus proveedores</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Proveedor
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Proveedores</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{suppliers.length}</p>
              </div>
              <Building className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Proveedores Activos</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {suppliers.filter(s => s.status === 'active').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Deuda Total</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ${suppliers.reduce((sum, s) => sum + (s.current_debt || 0), 0).toLocaleString()}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Productos Vinculados</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {suppliers.reduce((sum, s) => sum + (s.productCount || 0), 0)}
                </p>
              </div>
              <Package className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar proveedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
                <SelectItem value="suspended">Suspendido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-48 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Proveedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSuppliers.map(supplier => (
          <Card key={supplier.id} className="hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                      {supplier.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg dark:text-white">{supplier.name}</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{supplier.contact_person}</p>
                  </div>
                </div>
                <Badge className={getStatusColor(supplier.status)}>
                  {(supplier.status || 'active').toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="h-4 w-4 mr-2" />
                  {supplier.email}
                </div>
                {supplier.phone && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="h-4 w-4 mr-2" />
                    {supplier.phone}
                  </div>
                )}
                {(supplier.city || supplier.country) && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="h-4 w-4 mr-2" />
                    {[supplier.city, supplier.country].filter(Boolean).join(', ')}
                  </div>
                )}
                {supplier.website && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Globe className="h-4 w-4 mr-2" />
                    <a href={supplier.website} target="_blank" rel="noopener noreferrer" 
                       className="text-blue-600 hover:underline dark:text-blue-400">
                      Sitio web
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Calificación:</span>
                <div className="flex">{getRatingStars(supplier.rating)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Productos</p>
                  <p className="font-semibold dark:text-white">{supplier.productCount || 0}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Deuda Actual</p>
                  <p className={`font-semibold ${(supplier.current_debt || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    ${(supplier.current_debt || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => openDetailDialog(supplier)} className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEditDialog(supplier)} className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleDeleteSupplier(supplier.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400 dark:border-gray-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog: Agregar Proveedor */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Proveedor</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Completa la información del proveedor
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre de la Empresa *</Label>
              <Input
                value={newSupplier.name || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Apple Inc."
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label>Persona de Contacto</Label>
              <Input
                value={newSupplier.contact_person || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, contact_person: e.target.value }))}
                placeholder="Ej: John Smith"
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={newSupplier.email || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contacto@empresa.com"
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={newSupplier.phone || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1-800-123-4567"
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={newSupplier.address || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Dirección completa"
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input
                value={newSupplier.city || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Ciudad"
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label>País</Label>
              <Input
                value={newSupplier.country || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, country: e.target.value }))}
                placeholder="País"
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label>ID Fiscal</Label>
              <Input
                value={newSupplier.tax_id || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, tax_id: e.target.value }))}
                placeholder="Número de identificación fiscal"
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label>Límite de Crédito</Label>
              <Input
                type="number"
                value={newSupplier.credit_limit || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, credit_limit: Number(e.target.value) }))}
                placeholder="0"
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select 
                value={newSupplier.category || ''} 
                onValueChange={(value) => setNewSupplier(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tecnología">Tecnología</SelectItem>
                  <SelectItem value="Computadoras">Computadoras</SelectItem>
                  <SelectItem value="Audio/Video">Audio/Video</SelectItem>
                  <SelectItem value="Distribuidor">Distribuidor</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
              Cancelar
            </Button>
            <Button onClick={handleAddSupplier} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />
              Guardar Proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Proveedor */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <DialogHeader>
            <DialogTitle>Editar Proveedor</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Modifica la información del proveedor
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre de la Empresa *</Label>
              <Input
                value={editingSupplier.name || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, name: e.target.value }))}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label>Persona de Contacto</Label>
              <Input
                value={editingSupplier.contact_person || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, contact_person: e.target.value }))}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={editingSupplier.email || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, email: e.target.value }))}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={editingSupplier.phone || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, phone: e.target.value }))}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select 
                value={editingSupplier.status || ''} 
                onValueChange={(value) => setEditingSupplier(prev => ({ ...prev, status: value as any }))}
              >
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Límite de Crédito</Label>
              <Input
                type="number"
                value={editingSupplier.credit_limit || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, credit_limit: Number(e.target.value) }))}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
              Cancelar
            </Button>
            <Button onClick={handleEditSupplier} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalle del Proveedor */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Building className="h-5 w-5 mr-2" />
              {selectedSupplier?.name}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Información detallada del proveedor
            </DialogDescription>
          </DialogHeader>

          {selectedSupplier && (
            <Tabs defaultValue="info" className="space-y-4">
              <TabsList className="dark:bg-gray-700">
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="products">Productos</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white">Información de Contacto</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                        <span>{selectedSupplier.email}</span>
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                        <span>{selectedSupplier.phone || 'No registrado'}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                        <span>{[selectedSupplier.address, selectedSupplier.city, selectedSupplier.country].filter(Boolean).join(', ') || 'No registrado'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white">Información Comercial</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">ID Fiscal:</span>
                        <span>{selectedSupplier.tax_id || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Términos de Pago:</span>
                        <span>{selectedSupplier.payment_terms || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Límite de Crédito:</span>
                        <span>${(selectedSupplier.credit_limit || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Deuda Actual:</span>
                        <span className={(selectedSupplier.current_debt || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                          ${(selectedSupplier.current_debt || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Estado:</span>
                        <Badge className={getStatusColor(selectedSupplier.status)}>
                          {(selectedSupplier.status || 'active').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="products">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Productos Suministrados</h4>
                  {productsLoading ? (
                    <div className="text-center py-4">Cargando productos...</div>
                  ) : supplierProducts.length > 0 ? (
                    <div className="space-y-3">
                      {supplierProducts.map(product => (
                        <div key={product.id} className="border rounded-lg p-4 dark:border-gray-700 dark:bg-gray-800/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium dark:text-white">{product.name}</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">SKU: {product.sku}</p>
                            </div>
                            <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                              {product.status === 'active' ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Costo:</span>
                              <p className="font-semibold dark:text-white">${product.cost.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Stock:</span>
                              <p className="font-semibold dark:text-white">{product.stock}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      Este proveedor no tiene productos asignados.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)} className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SupplierManagement