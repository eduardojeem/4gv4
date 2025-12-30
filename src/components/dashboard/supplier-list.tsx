'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye, 
  Star,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  SortAsc,
  SortDesc,
  Grid,
  List
} from 'lucide-react'

interface SupplierData {
  id: string
  name: string
  businessName?: string
  taxId?: string
  email?: string
  phone?: string
  website?: string
  description?: string
  category?: string
  status?: string
  rating?: number
  addresses?: Array<{
    street: string
    city: string
    state: string
    zipCode: string
    country: string
    type: string
  }>
  contacts?: Array<{
    name: string
    email: string
    phone: string
    position: string
  }>
  tags?: string[]
  paymentTerms?: string
  creditLimit?: number
  createdAt?: string
  updatedAt?: string
}

interface SupplierListProps {
  suppliers?: SupplierData[]
  onSupplierCreate?: (supplier: SupplierData) => void
  onSupplierUpdate?: (supplier: SupplierData) => void
  onSupplierDelete?: (supplierId: string) => void
  onSupplierSelect?: (supplier: SupplierData) => void
}

// Mock data para demostración
const mockSuppliers: SupplierData[] = [
  {
    id: '1',
    name: 'TechDistributor SA',
    businessName: 'TechDistributor S.A. de C.V.',
    taxId: 'TDS123456789',
    email: 'ventas@techdistributor.com',
    phone: '+52 55 1234 5678',
    website: 'https://techdistributor.com',
    description: 'Distribuidor especializado en productos tecnológicos y electrónicos',
    category: 'Tecnología',
    status: 'active',
    rating: 4.5,
    addresses: [{
      street: 'Av. Insurgentes Sur 1234, Col. Del Valle',
      city: 'Ciudad de México',
      state: 'CDMX',
      zipCode: '03100',
      country: 'México',
      type: 'both'
    }],
    contacts: [{
      id: '1',
      name: 'Juan Pérez',
      position: 'Gerente de Ventas',
      email: 'juan.perez@techdistributor.com',
      phone: '+52 55 1234 5678',
      isPrimary: true
    }],
    paymentTerms: {
      paymentMethod: 'transfer',
      creditLimit: 100000,
      paymentDays: 30,
      discountPercent: 2,
      discountDays: 10,
      currency: 'MXN'
    },
    tags: ['Tecnología', 'Electrónicos', 'Confiable'],
    notes: 'Proveedor principal para productos tecnológicos',
    isActive: true,
    createdAt: '2024-01-15',
    updatedAt: '2024-01-20'
  },
  {
    id: '2',
    name: 'Moda Express',
    businessName: 'Moda Express S.A. de C.V.',
    taxId: 'MEX987654321',
    email: 'contacto@modaexpress.com',
    phone: '+52 55 9876 5432',
    website: 'https://modaexpress.com',
    description: 'Proveedor de ropa y accesorios de moda',
    category: 'Ropa y Accesorios',
    status: 'active',
    rating: 4.2,
    addresses: [{
      street: 'Calle Madero 567, Centro Histórico',
      city: 'Ciudad de México',
      state: 'CDMX',
      zipCode: '06000',
      country: 'México',
      type: 'both'
    }],
    contacts: [{
      id: '1',
      name: 'María González',
      position: 'Directora Comercial',
      email: 'maria.gonzalez@modaexpress.com',
      phone: '+52 55 9876 5432',
      isPrimary: true
    }],
    paymentTerms: {
      paymentMethod: 'credit',
      creditLimit: 50000,
      paymentDays: 45,
      discountPercent: 1.5,
      discountDays: 15,
      currency: 'MXN'
    },
    tags: ['Moda', 'Ropa', 'Accesorios'],
    notes: 'Buena calidad y precios competitivos',
    isActive: true,
    createdAt: '2024-01-10',
    updatedAt: '2024-01-18'
  },
  {
    id: '3',
    name: 'HomeStyle Imports',
    businessName: 'HomeStyle Imports S.A. de C.V.',
    taxId: 'HSI456789123',
    email: 'info@homestyle.com',
    phone: '+52 55 5555 1234',
    website: 'https://homestyle.com',
    description: 'Importador de productos para el hogar y decoración',
    category: 'Hogar y Jardín',
    status: 'pending',
    rating: 3.8,
    addresses: [{
      street: 'Blvd. Manuel Ávila Camacho 890, Lomas de Chapultepec',
      city: 'Ciudad de México',
      state: 'CDMX',
      zipCode: '11000',
      country: 'México',
      type: 'both'
    }],
    contacts: [{
      id: '1',
      name: 'Carlos Rodríguez',
      position: 'Gerente General',
      email: 'carlos.rodriguez@homestyle.com',
      phone: '+52 55 5555 1234',
      isPrimary: true
    }],
    paymentTerms: {
      paymentMethod: 'check',
      creditLimit: 25000,
      paymentDays: 60,
      discountPercent: 0,
      discountDays: 0,
      currency: 'USD'
    },
    tags: ['Hogar', 'Decoración', 'Importación'],
    notes: 'En proceso de evaluación',
    isActive: false,
    createdAt: '2024-01-05',
    updatedAt: '2024-01-12'
  }
]

const supplierCategories = [
  'Todos',
  'Tecnología',
  'Ropa y Accesorios',
  'Hogar y Jardín',
  'Deportes',
  'Salud y Belleza',
  'Automotriz',
  'Libros y Medios',
  'Juguetes',
  'Alimentos y Bebidas',
  'Oficina y Papelería',
  'Otro'
]

const statusOptions = [
  { value: 'all', label: 'Todos los Estados', icon: null },
  { value: 'active', label: 'Activo', icon: CheckCircle },
  { value: 'inactive', label: 'Inactivo', icon: AlertCircle },
  { value: 'pending', label: 'Pendiente', icon: Clock }
]

export default function SupplierList({ 
  suppliers = mockSuppliers, 
  onSupplierCreate, 
  onSupplierUpdate, 
  onSupplierDelete,
  onSupplierSelect 
}: SupplierListProps) {
  // Reemplazar la línea: const [searchTerm, setSearchTerm] = useState('')
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearchDebounce('', 300)
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'createdAt'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierData | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const filteredAndSortedSuppliers = useMemo(() => {
    const filtered = suppliers.filter(supplier => {
      const matchesSearch = supplier.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           supplier.businessName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           supplier.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           supplier.tags?.some((tag: string) => tag.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
      
      const matchesCategory = selectedCategory === 'Todos' || supplier.category === selectedCategory
      const matchesStatus = selectedStatus === 'all' || supplier.status === selectedStatus

      return matchesSearch && matchesCategory && matchesStatus
    })

    // Ordenar
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'rating':
          aValue = a.rating
          bValue = b.rating
          break
        case 'createdAt':
          aValue = new Date(a.createdAt || '').getTime()
          bValue = new Date(b.createdAt || '').getTime()
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    return filtered
  }, [suppliers, debouncedSearchTerm, selectedCategory, selectedStatus, sortBy, sortOrder])

  const handleCreateSupplier = useCallback((supplierData: SupplierData) => {
    onSupplierCreate?.(supplierData)
    setShowCreateDialog(false)
  }, [onSupplierCreate])

  const handleUpdateSupplier = useCallback((supplierData: SupplierData) => {
    onSupplierUpdate?.(supplierData)
    setShowEditDialog(false)
    setSelectedSupplier(null)
  }, [onSupplierUpdate])

  const handleDeleteSupplier = useCallback((supplierId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
      onSupplierDelete?.(supplierId)
    }
  }, [onSupplierDelete])

  const handleEditSupplier = useCallback((supplier: SupplierData) => {
    setSelectedSupplier(supplier)
    setShowEditDialog(true)
  }, [])

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Activo</Badge>
      case 'inactive':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Inactivo</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendiente</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }, [])

  const getRatingStars = useCallback((rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        <span className="ml-1 text-sm text-muted-foreground">({rating})</span>
      </div>
    )
  }, [])



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Proveedores</h2>
          <p className="text-muted-foreground">
            Gestiona tu red de proveedores
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Filtros y Búsqueda */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar proveedores..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {supplierCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center">
                        {option.icon && <option.icon className="h-4 w-4 mr-2" />}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: 'name' | 'rating' | 'createdAt') => setSortBy(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="rating">Calificación</SelectItem>
                  <SelectItem value="createdAt">Fecha</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>

              <Separator orientation="vertical" className="h-10" />

              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>

              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Proveedores</p>
                <p className="text-2xl font-bold">{suppliers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Activos</p>
                <p className="text-2xl font-bold">
                  {suppliers.filter(s => s.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Pendientes</p>
                <p className="text-2xl font-bold">
                  {suppliers.filter(s => s.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-400" />
              <div>
                <p className="text-sm font-medium">Calificación Promedio</p>
                <p className="text-2xl font-bold">
                  {(suppliers.reduce((acc, s) => acc + s.rating, 0) / suppliers.length).toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Proveedores */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {filteredAndSortedSuppliers.length} de {suppliers.length} proveedores
          </p>
        </div>

        {filteredAndSortedSuppliers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No se encontraron proveedores</h3>
              <p className="text-muted-foreground mb-4">
                No hay proveedores que coincidan con los filtros seleccionados.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Proveedor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={
             viewMode === 'grid' 
               ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
               : "space-y-2"
           }>
             {filteredAndSortedSuppliers.map((supplier) => (
               viewMode === 'grid' 
                 ? <div key={supplier.id} className="p-4 border rounded-lg">
                     <h3 className="font-medium">{supplier.name}</h3>
                     <p className="text-sm text-muted-foreground">{supplier.email}</p>
                   </div>
                 : <div key={supplier.id} className="p-2 border rounded">
                     <span className="font-medium">{supplier.name}</span>
                   </div>
             ))}
           </div>
        )}
      </div>
    </div>
  )
}