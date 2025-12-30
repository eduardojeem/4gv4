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
  TrendingUp,
  Calendar,
  Star,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Download,
  Upload,
  Filter,
  Eye,
  Users,
  BarChart3,
  Truck,
  CreditCard,
  History,
  Settings,
  ExternalLink,
  Copy,
  Save,
  X
} from 'lucide-react'

// Interfaces
interface Supplier {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  website?: string
  taxId: string
  paymentTerms: string
  creditLimit: number
  currentDebt: number
  rating: number
  status: 'active' | 'inactive' | 'suspended'
  category: string
  notes?: string
  createdAt: Date
  lastOrder?: Date
  totalOrders: number
  totalValue: number
  averageDeliveryTime: number
  qualityRating: number
  logo?: string
}

interface SupplierProduct {
  id: string
  supplierId: string
  productName: string
  supplierSku: string
  ourSku: string
  cost: number
  minOrderQty: number
  leadTime: number
  lastOrderDate?: Date
  isActive: boolean
}

interface SupplierOrder {
  id: string
  supplierId: string
  orderNumber: string
  date: Date
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  totalAmount: number
  items: number
  expectedDelivery?: Date
  actualDelivery?: Date
}

const SupplierManagement: React.FC = () => {
  // Estados
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([])
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({})
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Datos mock
  const mockSuppliers: Supplier[] = [
    {
      id: '1',
      name: 'Apple Inc.',
      contactPerson: 'John Smith',
      email: 'orders@apple.com',
      phone: '+1-800-275-2273',
      address: 'One Apple Park Way',
      city: 'Cupertino, CA',
      country: 'Estados Unidos',
      website: 'https://www.apple.com',
      taxId: 'US123456789',
      paymentTerms: '30 días',
      creditLimit: 1000000,
      currentDebt: 250000,
      rating: 5,
      status: 'active',
      category: 'Tecnología',
      notes: 'Proveedor principal de productos Apple',
      createdAt: new Date('2023-01-15'),
      lastOrder: new Date('2024-01-20'),
      totalOrders: 45,
      totalValue: 2500000,
      averageDeliveryTime: 7,
      qualityRating: 4.9,
      logo: '/api/placeholder/100/100'
    },
    {
      id: '2',
      name: 'Samsung Electronics',
      contactPerson: 'Kim Lee',
      email: 'b2b@samsung.com',
      phone: '+82-2-2255-0114',
      address: '129 Samsung-ro, Yeongtong-gu',
      city: 'Suwon-si, Gyeonggi-do',
      country: 'Corea del Sur',
      website: 'https://www.samsung.com',
      taxId: 'KR987654321',
      paymentTerms: '45 días',
      creditLimit: 800000,
      currentDebt: 150000,
      rating: 4,
      status: 'active',
      category: 'Tecnología',
      notes: 'Excelente calidad en smartphones y tablets',
      createdAt: new Date('2023-02-10'),
      lastOrder: new Date('2024-01-18'),
      totalOrders: 32,
      totalValue: 1800000,
      averageDeliveryTime: 10,
      qualityRating: 4.7,
      logo: '/api/placeholder/100/100'
    },
    {
      id: '3',
      name: 'Lenovo Group',
      contactPerson: 'Zhang Wei',
      email: 'partners@lenovo.com',
      phone: '+86-10-5886-8888',
      address: 'No.6 Chuang Ye Road, Shangdi Information Industry Base',
      city: 'Beijing',
      country: 'China',
      website: 'https://www.lenovo.com',
      taxId: 'CN456789123',
      paymentTerms: '60 días',
      creditLimit: 600000,
      currentDebt: 80000,
      rating: 4,
      status: 'active',
      category: 'Computadoras',
      notes: 'Especialista en laptops y equipos empresariales',
      createdAt: new Date('2023-03-05'),
      lastOrder: new Date('2024-01-15'),
      totalOrders: 28,
      totalValue: 1200000,
      averageDeliveryTime: 14,
      qualityRating: 4.5,
      logo: '/api/placeholder/100/100'
    },
    {
      id: '4',
      name: 'Sony Corporation',
      contactPerson: 'Tanaka Hiroshi',
      email: 'business@sony.com',
      phone: '+81-3-6748-2111',
      address: '1-7-1 Konan, Minato-ku',
      city: 'Tokyo',
      country: 'Japón',
      website: 'https://www.sony.com',
      taxId: 'JP789123456',
      paymentTerms: '30 días',
      creditLimit: 400000,
      currentDebt: 45000,
      rating: 4,
      status: 'active',
      category: 'Audio/Video',
      notes: 'Productos de audio y entretenimiento de alta calidad',
      createdAt: new Date('2023-04-12'),
      lastOrder: new Date('2024-01-10'),
      totalOrders: 18,
      totalValue: 650000,
      averageDeliveryTime: 12,
      qualityRating: 4.8,
      logo: '/api/placeholder/100/100'
    },
    {
      id: '5',
      name: 'TechDistributor SA',
      contactPerson: 'María González',
      email: 'ventas@techdist.com',
      phone: '+54-11-4567-8900',
      address: 'Av. Corrientes 1234',
      city: 'Buenos Aires',
      country: 'Argentina',
      taxId: 'AR321654987',
      paymentTerms: '15 días',
      creditLimit: 200000,
      currentDebt: 25000,
      rating: 3,
      status: 'suspended',
      category: 'Distribuidor',
      notes: 'Problemas recientes con entregas tardías',
      createdAt: new Date('2023-06-20'),
      lastOrder: new Date('2023-12-15'),
      totalOrders: 12,
      totalValue: 180000,
      averageDeliveryTime: 21,
      qualityRating: 3.2,
      logo: '/api/placeholder/100/100'
    }
  ]

  const mockSupplierProducts: SupplierProduct[] = [
    {
      id: '1',
      supplierId: '1',
      productName: 'iPhone 15 Pro',
      supplierSku: 'APL-IP15P-128',
      ourSku: 'IPH15P-128',
      cost: 800,
      minOrderQty: 10,
      leadTime: 7,
      lastOrderDate: new Date('2024-01-20'),
      isActive: true
    },
    {
      id: '2',
      supplierId: '1',
      productName: 'MacBook Air M3',
      supplierSku: 'APL-MBA-M3-256',
      ourSku: 'MBA-M3-256',
      cost: 1200,
      minOrderQty: 5,
      leadTime: 10,
      lastOrderDate: new Date('2024-01-18'),
      isActive: true
    },
    {
      id: '3',
      supplierId: '2',
      productName: 'Galaxy S24 Ultra',
      supplierSku: 'SAM-GS24U-512',
      ourSku: 'SGS24U-512',
      cost: 950,
      minOrderQty: 8,
      leadTime: 12,
      lastOrderDate: new Date('2024-01-15'),
      isActive: true
    }
  ]

  const mockSupplierOrders: SupplierOrder[] = [
    {
      id: '1',
      supplierId: '1',
      orderNumber: 'PO-2024-001',
      date: new Date('2024-01-20'),
      status: 'delivered',
      totalAmount: 45000,
      items: 50,
      expectedDelivery: new Date('2024-01-27'),
      actualDelivery: new Date('2024-01-26')
    },
    {
      id: '2',
      supplierId: '2',
      orderNumber: 'PO-2024-002',
      date: new Date('2024-01-18'),
      status: 'shipped',
      totalAmount: 32000,
      items: 25,
      expectedDelivery: new Date('2024-01-25')
    },
    {
      id: '3',
      supplierId: '1',
      orderNumber: 'PO-2024-003',
      date: new Date('2024-01-22'),
      status: 'confirmed',
      totalAmount: 28000,
      items: 20,
      expectedDelivery: new Date('2024-01-29')
    }
  ]

  // Efectos
  useEffect(() => {
    setSuppliers(mockSuppliers)
    setSupplierProducts(mockSupplierProducts)
    setSupplierOrders(mockSupplierOrders)
  }, [])

  // Funciones utilitarias
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'suspended': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'shipped': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ))
  }

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || supplier.status === filterStatus
    const matchesCategory = filterCategory === 'all' || supplier.category === filterCategory
    
    return matchesSearch && matchesStatus && matchesCategory
  })

  const categories = Array.from(new Set(suppliers.map(s => s.category)))

  // Handlers
  const handleAddSupplier = async () => {
    const validationErrors: Record<string, string> = {}
    
    if (!newSupplier.name?.trim()) validationErrors.name = 'El nombre es requerido'
    if (!newSupplier.email?.trim()) validationErrors.email = 'El email es requerido'
    if (!newSupplier.phone?.trim()) validationErrors.phone = 'El teléfono es requerido'
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    const supplier: Supplier = {
      id: Date.now().toString(),
      name: newSupplier.name!,
      contactPerson: newSupplier.contactPerson || '',
      email: newSupplier.email!,
      phone: newSupplier.phone!,
      address: newSupplier.address || '',
      city: newSupplier.city || '',
      country: newSupplier.country || '',
      website: newSupplier.website,
      taxId: newSupplier.taxId || '',
      paymentTerms: newSupplier.paymentTerms || '30 días',
      creditLimit: newSupplier.creditLimit || 0,
      currentDebt: 0,
      rating: 3,
      status: 'active',
      category: newSupplier.category || 'General',
      notes: newSupplier.notes,
      createdAt: new Date(),
      totalOrders: 0,
      totalValue: 0,
      averageDeliveryTime: 0,
      qualityRating: 0
    }

    setSuppliers(prev => [supplier, ...prev])
    setNewSupplier({})
    setErrors({})
    setIsAddDialogOpen(false)
  }

  const handleEditSupplier = async () => {
    if (!editingSupplier.id) return

    const validationErrors: Record<string, string> = {}
    
    if (!editingSupplier.name?.trim()) validationErrors.name = 'El nombre es requerido'
    if (!editingSupplier.email?.trim()) validationErrors.email = 'El email es requerido'
    if (!editingSupplier.phone?.trim()) validationErrors.phone = 'El teléfono es requerido'
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSuppliers(prev => prev.map(supplier => 
      supplier.id === editingSupplier.id 
        ? { ...supplier, ...editingSupplier }
        : supplier
    ))

    setEditingSupplier({})
    setErrors({})
    setIsEditDialogOpen(false)
  }

  const handleDeleteSupplier = (supplierId: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== supplierId))
  }

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setIsEditDialogOpen(true)
  }

  const openDetailDialog = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setIsDetailDialogOpen(true)
  }

  const getSupplierProducts = (supplierId: string) => {
    return supplierProducts.filter(p => p.supplierId === supplierId)
  }

  const getSupplierOrders = (supplierId: string) => {
    return supplierOrders.filter(o => o.supplierId === supplierId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Proveedores</h2>
          <p className="text-gray-600">Administra la información de contacto y productos de tus proveedores</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Proveedor
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Proveedores</p>
                <p className="text-2xl font-bold text-blue-600">{suppliers.length}</p>
              </div>
              <Building className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Proveedores Activos</p>
                <p className="text-2xl font-bold text-green-600">
                  {suppliers.filter(s => s.status === 'active').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Deuda Total</p>
                <p className="text-2xl font-bold text-red-600">
                  ${suppliers.reduce((sum, s) => sum + s.currentDebt, 0).toLocaleString()}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Total Órdenes</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${suppliers.reduce((sum, s) => sum + s.totalValue, 0).toLocaleString()}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar proveedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48">
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
              <SelectTrigger className="w-full sm:w-48">
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
          <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={supplier.logo} alt={supplier.name} />
                    <AvatarFallback>
                      {supplier.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{supplier.name}</CardTitle>
                    <p className="text-sm text-gray-600">{supplier.contactPerson}</p>
                  </div>
                </div>
                <Badge className={getStatusColor(supplier.status)}>
                  {supplier.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  {supplier.email}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {supplier.phone}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  {supplier.city}, {supplier.country}
                </div>
                {supplier.website && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Globe className="h-4 w-4 mr-2" />
                    <a href={supplier.website} target="_blank" rel="noopener noreferrer" 
                       className="text-blue-600 hover:underline">
                      Sitio web
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-1">
                <span className="text-sm text-gray-600">Calificación:</span>
                <div className="flex">{getRatingStars(supplier.rating)}</div>
                <span className="text-sm text-gray-600">({supplier.rating}/5)</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Órdenes</p>
                  <p className="font-semibold">{supplier.totalOrders}</p>
                </div>
                <div>
                  <p className="text-gray-600">Valor Total</p>
                  <p className="font-semibold">${supplier.totalValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Deuda Actual</p>
                  <p className={`font-semibold ${supplier.currentDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${supplier.currentDebt.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Tiempo Entrega</p>
                  <p className="font-semibold">{supplier.averageDeliveryTime} días</p>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => openDetailDialog(supplier)}>
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEditDialog(supplier)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleDeleteSupplier(supplier.id)}
                  className="text-red-600 hover:text-red-700"
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Proveedor</DialogTitle>
            <DialogDescription>
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
              />
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label>Persona de Contacto</Label>
              <Input
                value={newSupplier.contactPerson || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, contactPerson: e.target.value }))}
                placeholder="Ej: John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={newSupplier.email || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contacto@empresa.com"
              />
              {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input
                value={newSupplier.phone || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1-800-123-4567"
              />
              {errors.phone && <p className="text-sm text-red-600">{errors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={newSupplier.address || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Dirección completa"
              />
            </div>

            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input
                value={newSupplier.city || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Ciudad, Estado"
              />
            </div>

            <div className="space-y-2">
              <Label>País</Label>
              <Input
                value={newSupplier.country || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, country: e.target.value }))}
                placeholder="País"
              />
            </div>

            <div className="space-y-2">
              <Label>Sitio Web</Label>
              <Input
                value={newSupplier.website || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://www.empresa.com"
              />
            </div>

            <div className="space-y-2">
              <Label>ID Fiscal</Label>
              <Input
                value={newSupplier.taxId || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, taxId: e.target.value }))}
                placeholder="Número de identificación fiscal"
              />
            </div>

            <div className="space-y-2">
              <Label>Términos de Pago</Label>
              <Select 
                value={newSupplier.paymentTerms || ''} 
                onValueChange={(value) => setNewSupplier(prev => ({ ...prev, paymentTerms: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar términos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15 días">15 días</SelectItem>
                  <SelectItem value="30 días">30 días</SelectItem>
                  <SelectItem value="45 días">45 días</SelectItem>
                  <SelectItem value="60 días">60 días</SelectItem>
                  <SelectItem value="90 días">90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Límite de Crédito</Label>
              <Input
                type="number"
                value={newSupplier.creditLimit || ''}
                onChange={(e) => setNewSupplier(prev => ({ ...prev, creditLimit: Number(e.target.value) }))}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select 
                value={newSupplier.category || ''} 
                onValueChange={(value) => setNewSupplier(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
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

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={newSupplier.notes || ''}
              onChange={(e) => setNewSupplier(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Información adicional sobre el proveedor..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddSupplier}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Proveedor */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Proveedor</DialogTitle>
            <DialogDescription>
              Modifica la información del proveedor
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre de la Empresa *</Label>
              <Input
                value={editingSupplier.name || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Apple Inc."
              />
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label>Persona de Contacto</Label>
              <Input
                value={editingSupplier.contactPerson || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, contactPerson: e.target.value }))}
                placeholder="Ej: John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={editingSupplier.email || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contacto@empresa.com"
              />
              {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input
                value={editingSupplier.phone || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1-800-123-4567"
              />
              {errors.phone && <p className="text-sm text-red-600">{errors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select 
                value={editingSupplier.status || ''} 
                onValueChange={(value) => setEditingSupplier(prev => ({ ...prev, status: value as any }))}
              >
                <SelectTrigger>
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
                value={editingSupplier.creditLimit || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, creditLimit: Number(e.target.value) }))}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSupplier}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalle del Proveedor */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Building className="h-5 w-5 mr-2" />
              {selectedSupplier?.name}
            </DialogTitle>
            <DialogDescription>
              Información detallada del proveedor
            </DialogDescription>
          </DialogHeader>

          {selectedSupplier && (
            <Tabs defaultValue="info" className="space-y-4">
              <TabsList>
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="products">Productos</TabsTrigger>
                <TabsTrigger value="orders">Órdenes</TabsTrigger>
                <TabsTrigger value="stats">Estadísticas</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Información de Contacto</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-500" />
                        <span>{selectedSupplier.email}</span>
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-gray-500" />
                        <span>{selectedSupplier.phone}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                        <span>{selectedSupplier.address}, {selectedSupplier.city}, {selectedSupplier.country}</span>
                      </div>
                      {selectedSupplier.website && (
                        <div className="flex items-center">
                          <Globe className="h-4 w-4 mr-2 text-gray-500" />
                          <a href={selectedSupplier.website} target="_blank" rel="noopener noreferrer" 
                             className="text-blue-600 hover:underline">
                            {selectedSupplier.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Información Comercial</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">ID Fiscal:</span>
                        <span>{selectedSupplier.taxId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Términos de Pago:</span>
                        <span>{selectedSupplier.paymentTerms}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Límite de Crédito:</span>
                        <span>${selectedSupplier.creditLimit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Deuda Actual:</span>
                        <span className={selectedSupplier.currentDebt > 0 ? 'text-red-600' : 'text-green-600'}>
                          ${selectedSupplier.currentDebt.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Estado:</span>
                        <Badge className={getStatusColor(selectedSupplier.status)}>
                          {selectedSupplier.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedSupplier.notes && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Notas</h4>
                    <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedSupplier.notes}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="products">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Productos Suministrados</h4>
                  <div className="space-y-3">
                    {getSupplierProducts(selectedSupplier.id).map(product => (
                      <div key={product.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-medium">{product.productName}</h5>
                            <p className="text-sm text-gray-600">SKU Proveedor: {product.supplierSku}</p>
                            <p className="text-sm text-gray-600">Nuestro SKU: {product.ourSku}</p>
                          </div>
                          <Badge variant={product.isActive ? 'default' : 'secondary'}>
                            {product.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                          <div>
                            <span className="text-gray-600">Costo:</span>
                            <p className="font-semibold">${product.cost.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Cantidad Mínima:</span>
                            <p className="font-semibold">{product.minOrderQty}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Tiempo de Entrega:</span>
                            <p className="font-semibold">{product.leadTime} días</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="orders">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Órdenes Recientes</h4>
                  <div className="space-y-3">
                    {getSupplierOrders(selectedSupplier.id).map(order => (
                      <div key={order.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-medium">{order.orderNumber}</h5>
                            <p className="text-sm text-gray-600">
                              {order.date.toLocaleDateString()} • {order.items} productos
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={getOrderStatusColor(order.status)}>
                              {order.status.toUpperCase()}
                            </Badge>
                            <p className="text-lg font-semibold mt-1">
                              ${order.totalAmount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {order.expectedDelivery && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span>Entrega esperada: {order.expectedDelivery.toLocaleDateString()}</span>
                            {order.actualDelivery && (
                              <span className="ml-4">
                                Entregado: {order.actualDelivery.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="stats">
                <div className="space-y-6">
                  <h4 className="font-semibold text-gray-900">Estadísticas de Rendimiento</h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{selectedSupplier.totalOrders}</p>
                      <p className="text-sm text-gray-600">Total Órdenes</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        ${selectedSupplier.totalValue.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">Valor Total</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">{selectedSupplier.averageDeliveryTime}</p>
                      <p className="text-sm text-gray-600">Días Promedio Entrega</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{selectedSupplier.qualityRating}</p>
                      <p className="text-sm text-gray-600">Calificación Calidad</p>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium mb-3">Calificación General</h5>
                    <div className="flex items-center space-x-2">
                      <div className="flex">{getRatingStars(selectedSupplier.rating)}</div>
                      <span className="text-lg font-semibold">{selectedSupplier.rating}/5</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SupplierManagement
