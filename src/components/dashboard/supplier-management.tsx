'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
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
  Building, 
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  MapPin
} from 'lucide-react'
import { toast } from 'sonner'
import { useInventory, Supplier } from '@/hooks/use-inventory'

export function SupplierManagement() {
  const { 
    suppliers, 
    loading, 
    createSupplier, 
    updateSupplier, 
    deleteSupplier, 
    refreshSuppliers 
  } = useInventory()

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'México',
    tax_id: '',
    status: 'active',
    rating: 5,
    payment_terms: '30 días',
    credit_limit: 0,
    notes: ''
  })

  const filteredSuppliers = suppliers.filter(supplier => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = 
      supplier.name.toLowerCase().includes(searchLower) ||
      (supplier.contact_person || '').toLowerCase().includes(searchLower) ||
      (supplier.email || '').toLowerCase().includes(searchLower)
    
    const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'México',
      tax_id: '',
      status: 'active',
      rating: 5,
      payment_terms: '30 días',
      credit_limit: 0,
      notes: ''
    })
  }

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      ...supplier
    })
    setSelectedSupplier(supplier)
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      if (isEditing && selectedSupplier) {
        const result = await updateSupplier(selectedSupplier.id, formData)
        if (result.success) {
          toast.success('Proveedor actualizado correctamente')
          setIsDialogOpen(false)
        } else {
          toast.error('Error al actualizar proveedor: ' + result.error)
        }
      } else {
        const result = await createSupplier(formData)
        if (result.success) {
          toast.success('Proveedor creado correctamente')
          setIsDialogOpen(false)
        } else {
          toast.error('Error al crear proveedor: ' + result.error)
        }
      }
    } catch (error) {
      toast.error('Ocurrió un error inesperado')
      console.error(error)
    } finally {
      setIsSubmitting(false)
      if (!isEditing) resetForm()
    }
  }

  const handleDelete = async (supplierId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este proveedor?')) {
      const result = await deleteSupplier(supplierId)
      if (result.success) {
        toast.success('Proveedor eliminado correctamente')
      } else {
        toast.error('Error al eliminar proveedor: ' + result.error)
      }
    }
  }

  const getStatusBadge = (status: string = 'active') => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300">Activo</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactivo</Badge>
      case 'suspended':
        return <Badge variant="destructive">Suspendido</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Proveedores</h2>
          <p className="text-muted-foreground">
            Administra la información de tus proveedores
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refreshSuppliers()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              setIsEditing(false)
              resetForm()
            }
          }}>
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
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Información Básica</TabsTrigger>
                    <TabsTrigger value="details">Detalles y Contacto</TabsTrigger>
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
                        <Label htmlFor="contact">Persona de Contacto</Label>
                        <Input
                          id="contact"
                          value={formData.contact_person || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                          placeholder="Nombre del contacto"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="taxId">RFC/Tax ID</Label>
                        <Input
                          id="taxId"
                          value={formData.tax_id || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, tax_id: e.target.value }))}
                          placeholder="RFC o Tax ID"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Estado</Label>
                        <Select 
                          value={formData.status} 
                          onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                            <SelectItem value="suspended">Suspendido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="details" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="email@proveedor.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                          id="phone"
                          value={formData.phone || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+52 55 1234 5678"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city">Ciudad</Label>
                        <Input
                          id="city"
                          value={formData.city || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          placeholder="Ciudad"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="country">País</Label>
                        <Input
                          id="country"
                          value={formData.country || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                          placeholder="País"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Dirección</Label>
                      <Textarea
                        id="address"
                        value={formData.address || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Dirección completa"
                        rows={2}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                        <Label htmlFor="payment_terms">Términos de Pago</Label>
                        <Input
                          id="payment_terms"
                          value={formData.payment_terms || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                          placeholder="Ej. 30 días"
                        />
                      </div>
                       <div className="space-y-2">
                        <Label htmlFor="credit_limit">Límite de Crédito</Label>
                        <Input
                          id="credit_limit"
                          type="number"
                          value={formData.credit_limit || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, credit_limit: Number(e.target.value) }))}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                     <div className="space-y-2">
                      <Label htmlFor="notes">Notas</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Notas adicionales..."
                        rows={2}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditing ? 'Actualizar' : 'Crear'} Proveedor
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar proveedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
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
                <SelectItem value="suspended">Suspendidos</SelectItem>
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
          {loading ? (
             <div className="flex justify-center p-8">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Crédito / Deuda</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No se encontraron proveedores
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{supplier.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {[supplier.city, supplier.country].filter(Boolean).join(', ')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{supplier.contact_person || '-'}</div>
                          {supplier.email && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {supplier.email}
                            </div>
                          )}
                          {supplier.phone && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {supplier.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(supplier.status)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{supplier.productCount || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>Límite: ${supplier.credit_limit?.toLocaleString() || '0'}</p>
                          <p className={(supplier.current_debt || 0) > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                            Deuda: ${supplier.current_debt?.toLocaleString() || '0'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(supplier)}
                          >
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(supplier.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
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
                  {suppliers.filter(s => s.status === 'active').length}
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
                <p className="text-sm font-medium text-muted-foreground">Deuda Total</p>
                <p className="text-2xl font-bold text-red-600">
                  ${suppliers.reduce((sum, s) => sum + (s.current_debt || 0), 0).toLocaleString()}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SupplierManagement
