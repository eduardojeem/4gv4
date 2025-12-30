'use client'

 import { useState } from 'react'
 import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
 import { Button } from '@/components/ui/button'
 import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
 import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import AdvancedSearch from '@/components/admin/advanced-search'
import StockControl from '@/components/admin/inventory/stock-control'
import InventoryReports from '@/components/admin/reports/inventory-reports'
import { SupplierManagement } from '@/components/dashboard/supplier-management'
 import {
   Package,
   Plus,
   Upload,
   Download,
   CheckCircle,
   Archive,
   TrendingUp,
   Tag,
   Users,
   Search,
   Eye,
   ArrowUpDown,
   BarChart3,
   XCircle,
   AlertTriangle,
   X,
   RefreshCw,
   Save,
   Trash2,
   Edit
 } from 'lucide-react'

 interface Category {
   id: string
   name: string
   description: string
   productCount: number
   isActive: boolean
 }

 interface Product {
   id: string
   name: string
   sku: string
   category: string
   price: number
   cost: number
   stock: number
   minStock: number
   maxStock: number
   supplier: string
   description: string
   status: 'active' | 'inactive' | 'discontinued'
   lastUpdated: Date
   sales: number
   revenue: number
   barcode?: string
   weight?: number
   dimensions?: string
 }

interface Supplier {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  address: string
  productCount: number
  isActive: boolean
  rating: number
}

interface StockMovement {
  id: string
  productId: string
  type: 'sale' | 'restock' | 'adjustment' | 'return' | 'transfer'
  quantity: number
  previousStock: number
  newStock: number
  timestamp: Date
  reference: string
  notes: string
  userId: string
}

interface ValidationError {
  field: string
  message: string
}

// Datos mock mejorados
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'iPhone 15 Pro',
    sku: 'IPH15P-128',
    category: 'Electrónicos',
    price: 1299,
    cost: 899,
    stock: 15,
    minStock: 5,
    maxStock: 50,
    supplier: 'Apple Inc.',
    description: 'iPhone 15 Pro con 128GB de almacenamiento, cámara profesional y chip A17 Pro',
    status: 'active',
    lastUpdated: new Date(),
    sales: 45,
    revenue: 58455,
    barcode: '123456789012',
    weight: 0.187,
    dimensions: '146.6 x 70.6 x 8.25 mm'
  },
  {
    id: '2',
    name: 'Samsung Galaxy S24',
    sku: 'SGS24-256',
    category: 'Electrónicos',
    price: 1199,
    cost: 799,
    stock: 3,
    minStock: 5,
    maxStock: 40,
    supplier: 'Samsung',
    description: 'Samsung Galaxy S24 con 256GB, pantalla Dynamic AMOLED 2X',
    status: 'active',
    lastUpdated: new Date(),
    sales: 32,
    revenue: 38368,
    barcode: '123456789013',
    weight: 0.168,
    dimensions: '147.0 x 70.6 x 7.6 mm'
  },
  {
    id: '3',
    name: 'MacBook Pro 14"',
    sku: 'MBP14-512',
    category: 'Computadoras',
    price: 2499,
    cost: 1899,
    stock: 8,
    minStock: 3,
    maxStock: 20,
    supplier: 'Apple Inc.',
    description: 'MacBook Pro 14" con chip M3, 512GB SSD, pantalla Liquid Retina XDR',
    status: 'active',
    lastUpdated: new Date(),
    sales: 18,
    revenue: 44982,
    barcode: '123456789014',
    weight: 1.6,
    dimensions: '312.6 x 221.2 x 15.5 mm'
  },
  {
    id: '4',
    name: 'AirPods Pro',
    sku: 'APP-GEN2',
    category: 'Accesorios',
    price: 249,
    cost: 149,
    stock: 25,
    minStock: 10,
    maxStock: 100,
    supplier: 'Apple Inc.',
    description: 'AirPods Pro 2da generación con cancelación activa de ruido',
    status: 'active',
    lastUpdated: new Date(),
    sales: 67,
    revenue: 16683,
    barcode: '123456789015',
    weight: 0.056,
    dimensions: '30.9 x 21.8 x 24.0 mm'
  },
  {
    id: '5',
    name: 'iPad Air',
    sku: 'IPA-64GB',
    category: 'Tablets',
    price: 599,
    cost: 399,
    stock: 0,
    minStock: 5,
    maxStock: 30,
    supplier: 'Apple Inc.',
    description: 'iPad Air con 64GB, chip M1, pantalla Liquid Retina de 10.9"',
    status: 'active',
    lastUpdated: new Date(),
    sales: 23,
    revenue: 13777,
    barcode: '123456789016',
    weight: 0.461,
    dimensions: '247.6 x 178.5 x 6.1 mm'
  }
]

const mockCategories: Category[] = [
  { id: '1', name: 'Electrónicos', description: 'Smartphones y dispositivos electrónicos', productCount: 45, isActive: true },
  { id: '2', name: 'Computadoras', description: 'Laptops, desktops y accesorios', productCount: 23, isActive: true },
  { id: '3', name: 'Accesorios', description: 'Accesorios para dispositivos', productCount: 67, isActive: true },
  { id: '4', name: 'Tablets', description: 'Tablets y e-readers', productCount: 12, isActive: true }
]

const mockSuppliers: Supplier[] = [
  {
    id: '1',
    name: 'Apple Inc.',
    contact: 'John Smith',
    email: 'orders@apple.com',
    phone: '+1-800-APL-CARE',
    address: 'One Apple Park Way, Cupertino, CA 95014',
    productCount: 89,
    isActive: true,
    rating: 4.9
  },
  {
    id: '2',
    name: 'Samsung',
    contact: 'Maria Garcia',
    email: 'b2b@samsung.com',
    phone: '+1-800-SAMSUNG',
    address: '1301 E Lookout Dr, Richardson, TX 75082',
    productCount: 34,
    isActive: true,
    rating: 4.7
  },
  {
    id: '3',
    name: 'Microsoft',
    contact: 'David Johnson',
    email: 'enterprise@microsoft.com',
    phone: '+1-800-MSFT',
    address: 'One Microsoft Way, Redmond, WA 98052',
    productCount: 23,
    isActive: true,
    rating: 4.6
  },
  {
    id: '4',
    name: 'Dell Technologies',
    contact: 'Sarah Wilson',
    email: 'sales@dell.com',
    phone: '+1-800-DELL',
    address: 'One Dell Way, Round Rock, TX 78682',
    productCount: 45,
    isActive: true,
    rating: 4.5
  }
]

const mockStockMovements: StockMovement[] = [
  {
    id: '1',
    productId: '1',
    type: 'sale',
    quantity: -2,
    previousStock: 17,
    newStock: 15,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    reference: 'SALE-001',
    notes: 'Venta en tienda física',
    userId: 'user1'
  },
  {
    id: '2',
    productId: '2',
    type: 'restock',
    quantity: 10,
    previousStock: 3,
    newStock: 13,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    reference: 'PO-2024-001',
    notes: 'Reabastecimiento programado',
    userId: 'user2'
  }
]

export default function InventoryManagement() {
  const [products, setProducts] = useState<Product[]>(mockProducts)
  const [categories, setCategories] = useState<Category[]>(mockCategories)
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers)
  const [stockMovements] = useState<StockMovement[]>(mockStockMovements)

  // Estados de filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedSupplier, setSelectedSupplier] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('products')

  // Estados de modales y formularios
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Estados del formulario
  const [formData, setFormData] = useState<Partial<Product>>({})
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [successMessage, setSuccessMessage] = useState('')

  // Funciones de validación
  const validateProduct = (data: Partial<Product>): ValidationError[] => {
    const errors: ValidationError[] = []

    if (!data.name?.trim()) {
      errors.push({ field: 'name', message: 'El nombre del producto es requerido' })
    }

    if (!data.sku?.trim()) {
      errors.push({ field: 'sku', message: 'El SKU es requerido' })
    } else if (products.some(p => p.sku === data.sku && p.id !== data.id)) {
      errors.push({ field: 'sku', message: 'El SKU ya existe' })
    }

    if (!data.category) {
      errors.push({ field: 'category', message: 'La categoría es requerida' })
    }

    if (!data.supplier) {
      errors.push({ field: 'supplier', message: 'El proveedor es requerido' })
    }

    if (!data.price || data.price <= 0) {
      errors.push({ field: 'price', message: 'El precio debe ser mayor a 0' })
    }

    if (!data.cost || data.cost <= 0) {
      errors.push({ field: 'cost', message: 'El costo debe ser mayor a 0' })
    }

    if (data.price && data.cost && data.price <= data.cost) {
      errors.push({ field: 'price', message: 'El precio debe ser mayor al costo' })
    }

    if (data.stock === undefined || data.stock < 0) {
      errors.push({ field: 'stock', message: 'El stock no puede ser negativo' })
    }

    if (!data.minStock || data.minStock < 0) {
      errors.push({ field: 'minStock', message: 'El stock mínimo debe ser mayor o igual a 0' })
    }

    if (!data.maxStock || data.maxStock <= 0) {
      errors.push({ field: 'maxStock', message: 'El stock máximo debe ser mayor a 0' })
    }

    if (data.minStock && data.maxStock && data.minStock >= data.maxStock) {
      errors.push({ field: 'maxStock', message: 'El stock máximo debe ser mayor al mínimo' })
    }

    return errors
  }

  // Funciones de utilidad
  const getStockStatus = (product: Product) => {
    if (product.stock === 0) return { status: 'out', color: 'bg-red-100 text-red-800 border-red-200', text: 'Agotado', icon: XCircle }
    if (product.stock <= product.minStock) return { status: 'low', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: 'Stock Bajo', icon: AlertTriangle }
    if (product.stock >= product.maxStock) return { status: 'high', color: 'bg-blue-100 text-blue-800 border-blue-200', text: 'Stock Alto', icon: TrendingUp }
    return { status: 'normal', color: 'bg-green-100 text-green-800 border-green-200', text: 'Normal', icon: CheckCircle }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      discontinued: 'bg-red-100 text-red-800 border-red-200'
    }
    return colors[status as keyof typeof colors] || colors.active
  }

  const getMarginPercentage = (price: number, cost: number) => {
    return ((price - cost) / price * 100).toFixed(1)
  }

  // Filtros avanzados
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    const matchesStatus = selectedStatus === 'all' || product.status === selectedStatus
    const matchesSupplier = selectedSupplier === 'all' || product.supplier === selectedSupplier

    let matchesStock = true
    if (stockFilter === 'low') matchesStock = product.stock <= product.minStock && product.stock > 0
    else if (stockFilter === 'out') matchesStock = product.stock === 0
    else if (stockFilter === 'normal') matchesStock = product.stock > product.minStock && product.stock < product.maxStock
    else if (stockFilter === 'high') matchesStock = product.stock >= product.maxStock

    return matchesSearch && matchesCategory && matchesStatus && matchesSupplier && matchesStock
  })

  // Estadísticas
  const lowStockProducts = products.filter(p => p.stock <= p.minStock && p.stock > 0)
  const outOfStockProducts = products.filter(p => p.stock === 0)
  const totalValue = products.reduce((sum, p) => sum + (p.stock * p.cost), 0)
  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0)
  const averageMargin = products.length > 0 ?
    products.reduce((sum, p) => sum + parseFloat(getMarginPercentage(p.price, p.cost)), 0) / products.length : 0

  // Funciones CRUD
  const handleAddProduct = async () => {
    setIsLoading(true)
    const errors = validateProduct(formData)

    if (errors.length > 0) {
      setValidationErrors(errors)
      setIsLoading(false)
      return
    }

    try {
      // Simular API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      const newProduct: Product = {
        id: Date.now().toString(),
        name: formData.name!,
        sku: formData.sku!,
        category: formData.category!,
        price: formData.price!,
        cost: formData.cost!,
        stock: formData.stock || 0,
        minStock: formData.minStock!,
        maxStock: formData.maxStock!,
        supplier: formData.supplier!,
        description: formData.description || '',
        status: 'active',
        lastUpdated: new Date(),
        sales: 0,
        revenue: 0,
        barcode: formData.barcode,
        weight: formData.weight,
        dimensions: formData.dimensions
      }

      setProducts([...products, newProduct])
      setFormData({})
      setValidationErrors([])
      setSuccessMessage('Producto agregado exitosamente')
      setIsAddDialogOpen(false)

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Error adding product:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditProduct = async () => {
    if (!selectedProduct) return

    setIsLoading(true)
    const errors = validateProduct({ ...formData, id: selectedProduct.id })

    if (errors.length > 0) {
      setValidationErrors(errors)
      setIsLoading(false)
      return
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const updatedProducts = products.map(p =>
        p.id === selectedProduct.id
          ? { ...p, ...formData, lastUpdated: new Date() }
          : p
      )

      setProducts(updatedProducts)
      setFormData({})
      setValidationErrors([])
      setSelectedProduct(null)
      setSuccessMessage('Producto actualizado exitosamente')
      setIsEditDialogOpen(false)

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Error updating product:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return

    setIsLoading(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))

      setProducts(products.filter(p => p.id !== selectedProduct.id))
      setSelectedProduct(null)
      setSuccessMessage('Producto eliminado exitosamente')
      setIsDeleteDialogOpen(false)

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Error deleting product:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product)
    setFormData(product)
    setValidationErrors([])
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (product: Product) => {
    setSelectedProduct(product)
    setIsDeleteDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({})
    setValidationErrors([])
    setSelectedProduct(null)
  }

  const getFieldError = (field: string) => {
    return validationErrors.find(error => error.field === field)?.message
  }

  return (
    <div className="space-y-6">
      {/* Mensaje de éxito */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Header mejorado */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center">
              <Package className="h-8 w-8 mr-3 text-blue-600" />
              Sistema de Gestión de Inventario
            </h2>
            <p className="text-blue-600 mt-2 text-lg">Control completo de productos, stock y proveedores</p>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Datos
            </Button>

            <Button
              variant="outline"
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>

            <Button
              onClick={() => {
                resetForm()
                setIsAddDialogOpen(true)
              }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards mejorados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-blue-50">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900">{products.length}</p>
                <p className="text-sm text-blue-600">Total Productos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-yellow-50">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yellow-900">{lowStockProducts.length}</p>
                <p className="text-sm text-yellow-600">Stock Bajo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-red-50">
                <Archive className="h-6 w-6 text-red-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-900">{outOfStockProducts.length}</p>
                <p className="text-sm text-red-600">Agotados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-green-50">
                <GSIcon className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-900">${totalValue.toLocaleString()}</p>
                <p className="text-sm text-green-600">Valor Inventario</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-purple-50">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-900">{averageMargin.toFixed(1)}%</p>
                <p className="text-sm text-purple-600">Margen Promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 bg-gradient-to-r from-green-100 to-emerald-100 p-1">
          <TabsTrigger
            value="products"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white text-xs sm:text-sm"
          >
            <Package className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Productos</span>
            <span className="sm:hidden">Prod.</span>
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white text-xs sm:text-sm"
          >
            <Tag className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Categorías</span>
            <span className="sm:hidden">Cat.</span>
          </TabsTrigger>
          <TabsTrigger
            value="suppliers"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-xs sm:text-sm"
          >
            <Users className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Proveedores</span>
            <span className="sm:hidden">Prov.</span>
          </TabsTrigger>
          <TabsTrigger
            value="search"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white text-xs sm:text-sm"
          >
            <Search className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Búsqueda</span>
            <span className="sm:hidden">Busq.</span>
          </TabsTrigger>
          <TabsTrigger
            value="stock-control"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-xs sm:text-sm"
          >
            <ArrowUpDown className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Control Stock</span>
            <span className="sm:hidden">Stock</span>
          </TabsTrigger>
          <TabsTrigger
            value="alerts"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white text-xs sm:text-sm"
          >
            <AlertTriangle className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Alertas</span>
            <span className="sm:hidden">Alert.</span>
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-teal-600 data-[state=active]:text-white text-xs sm:text-sm"
          >
            <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Reportes</span>
            <span className="sm:hidden">Rep.</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Productos */}
        <TabsContent value="products" className="space-y-6">
          {/* Filtros */}
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="discontinued">Descontinuado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Productos */}
          <Card className="border-gray-200 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-semibold text-gray-900">Producto</th>
                      <th className="text-left p-4 font-semibold text-gray-900">SKU</th>
                      <th className="text-left p-4 font-semibold text-gray-900">Categoría</th>
                      <th className="text-left p-4 font-semibold text-gray-900">Precio</th>
                      <th className="text-left p-4 font-semibold text-gray-900">Stock</th>
                      <th className="text-left p-4 font-semibold text-gray-900">Estado</th>
                      <th className="text-left p-4 font-semibold text-gray-900">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const stockStatus = getStockStatus(product)

                      return (
                        <tr key={product.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <div>
                              <p className="font-medium text-gray-900">{product.name}</p>
                              <p className="text-sm text-gray-500">{product.description}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <code className="bg-gray-100 px-2 py-1 rounded text-sm">{product.sku}</code>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{product.category}</Badge>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="font-medium">${product.price.toLocaleString()}</p>
                              <p className="text-sm text-gray-500">Costo: ${product.cost.toLocaleString()}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{product.stock} unidades</p>
                              <Badge className={stockStatus.color}>{stockStatus.text}</Badge>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={getStatusBadge(product.status)}>
                              {product.status === 'active' ? 'Activo' :
                                product.status === 'inactive' ? 'Inactivo' : 'Descontinuado'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800">
                                <Trash2 className="h-4 w-4" />
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

        {/* Tab: Categorías */}
        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <Card key={category.id} className="border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                  <CardTitle className="text-blue-800 flex items-center">
                    <Tag className="h-5 w-5 mr-2 text-blue-600" />
                    {category.name}
                  </CardTitle>
                  <CardDescription className="text-blue-600">{category.description}</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-blue-900">{category.productCount}</p>
                      <p className="text-sm text-blue-600">Productos</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm" className="text-blue-600">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Proveedores */}
        <TabsContent value="suppliers" className="space-y-6">
          <SupplierManagement />
        </TabsContent>

        {/* Tab: Alertas */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock Bajo */}
            <Card className="border-yellow-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-b border-yellow-200">
                <CardTitle className="text-yellow-800 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
                  Stock Bajo ({lowStockProducts.length})
                </CardTitle>
                <CardDescription className="text-yellow-600">Productos que necesitan reabastecimiento</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {lowStockProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="font-medium text-yellow-900">{product.name}</p>
                        <p className="text-sm text-yellow-600">Stock: {product.stock} / Mínimo: {product.minStock}</p>
                      </div>
                      <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white">
                        Reabastecer
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Productos Agotados */}
            <Card className="border-red-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
                <CardTitle className="text-red-800 flex items-center">
                  <Archive className="h-5 w-5 mr-2 text-red-600" />
                  Productos Agotados ({outOfStockProducts.length})
                </CardTitle>
                <CardDescription className="text-red-600">Productos sin stock disponible</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {outOfStockProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium text-red-900">{product.name}</p>
                        <p className="text-sm text-red-600">SKU: {product.sku}</p>
                      </div>
                      <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                        Urgente
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Búsqueda Avanzada */}
        <TabsContent value="search" className="space-y-6">
          <AdvancedSearch
            onSearch={(filters) => {
              // Implementar lógica de búsqueda con filtros
              console.log('Filtros aplicados:', filters)
            }}
            onClearFilters={() => {
              // Limpiar filtros
              console.log('Filtros limpiados')
            }}
            results={filteredProducts.map(product => ({
              id: product.id,
              name: product.name,
              sku: product.sku,
              category: product.category,
              supplier: product.supplier,
              price: product.price,
              stock: product.stock,
              status: product.status,
              lastMovement: new Date()
            }))}
          />
        </TabsContent>

        {/* Tab: Control de Stock */}
        <TabsContent value="stock-control" className="space-y-6">
          <StockControl />
        </TabsContent>

        {/* Tab: Reportes */}
        <TabsContent value="reports" className="space-y-6">
          <InventoryReports />
        </TabsContent>
      </Tabs>

      {/* Dialog: Agregar Producto */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-green-900 flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Agregar Producto
            </DialogTitle>
            <DialogDescription>
              Ingrese la información del producto
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Información Básica */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 border-b pb-2">Información Básica</h4>

              <div className="space-y-2">
                <Label htmlFor="add-name">Nombre del Producto *</Label>
                <Input
                  id="add-name"
                  placeholder="Ej: iPhone 15 Pro"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={getFieldError('name') ? 'border-red-300' : ''}
                />
                {getFieldError('name') && (
                  <p className="text-sm text-red-600">{getFieldError('name')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-sku">SKU *</Label>
                <Input
                  id="add-sku"
                  placeholder="Ej: IPH15P-128"
                  value={formData.sku || ''}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  className={getFieldError('sku') ? 'border-red-300' : ''}
                />
                {getFieldError('sku') && (
                  <p className="text-sm text-red-600">{getFieldError('sku')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-category">Categoría *</Label>
                <Select
                  value={formData.category || ''}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className={getFieldError('category') ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getFieldError('category') && (
                  <p className="text-sm text-red-600">{getFieldError('category')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-supplier">Proveedor *</Label>
                <Select
                  value={formData.supplier || ''}
                  onValueChange={(value) => setFormData({ ...formData, supplier: value })}
                >
                  <SelectTrigger className={getFieldError('supplier') ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(sup => (
                      <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getFieldError('supplier') && (
                  <p className="text-sm text-red-600">{getFieldError('supplier')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-description">Descripción</Label>
                <Textarea
                  id="add-description"
                  placeholder="Descripción detallada del producto"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            {/* Precios y Stock */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 border-b pb-2">Precios y Stock</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-cost">Costo *</Label>
                  <Input
                    id="add-cost"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.cost || ''}
                    onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                    className={getFieldError('cost') ? 'border-red-300' : ''}
                  />
                  {getFieldError('cost') && (
                    <p className="text-sm text-red-600">{getFieldError('cost')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-price">Precio de Venta *</Label>
                  <Input
                    id="add-price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className={getFieldError('price') ? 'border-red-300' : ''}
                  />
                  {getFieldError('price') && (
                    <p className="text-sm text-red-600">{getFieldError('price')}</p>
                  )}
                </div>
              </div>

              {formData.price && formData.cost && formData.price > formData.cost && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    Margen de ganancia: <span className="font-semibold">{getMarginPercentage(formData.price, formData.cost)}%</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-stock">Stock Inicial *</Label>
                  <Input
                    id="add-stock"
                    type="number"
                    placeholder="0"
                    value={formData.stock || ''}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className={getFieldError('stock') ? 'border-red-300' : ''}
                  />
                  {getFieldError('stock') && (
                    <p className="text-sm text-red-600">{getFieldError('stock')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-minStock">Stock Mínimo *</Label>
                  <Input
                    id="add-minStock"
                    type="number"
                    placeholder="0"
                    value={formData.minStock || ''}
                    onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                    className={getFieldError('minStock') ? 'border-red-300' : ''}
                  />
                  {getFieldError('minStock') && (
                    <p className="text-sm text-red-600">{getFieldError('minStock')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-maxStock">Stock Máximo *</Label>
                  <Input
                    id="add-maxStock"
                    type="number"
                    placeholder="0"
                    value={formData.maxStock || ''}
                    onChange={(e) => setFormData({ ...formData, maxStock: parseInt(e.target.value) || 0 })}
                    className={getFieldError('maxStock') ? 'border-red-300' : ''}
                  />
                  {getFieldError('maxStock') && (
                    <p className="text-sm text-red-600">{getFieldError('maxStock')}</p>
                  )}
                </div>
              </div>

              <h4 className="font-semibold text-gray-900 border-b pb-2 pt-4">Información Adicional</h4>

              <div className="space-y-2">
                <Label htmlFor="add-barcode">Código de Barras</Label>
                <Input
                  id="add-barcode"
                  placeholder="123456789012"
                  value={formData.barcode || ''}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-weight">Peso (kg)</Label>
                  <Input
                    id="add-weight"
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={formData.weight || ''}
                    onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || undefined })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-dimensions">Dimensiones</Label>
                  <Input
                    id="add-dimensions"
                    placeholder="L x W x H mm"
                    value={formData.dimensions || ''}
                    onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                resetForm()
              }}
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Guardando...' : 'Guardar Producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog: Editar Producto */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-green-900 flex items-center">
              <Edit className="h-5 w-5 mr-2" />
              Editar Producto: {selectedProduct?.name}
            </DialogTitle>
            <DialogDescription>
              Modifica la información del producto
            </DialogDescription>
          </DialogHeader>

          {/* Mismo formulario que agregar pero con datos precargados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Información Básica */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 border-b pb-2">Información Básica</h4>

              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre del Producto *</Label>
                <Input
                  id="edit-name"
                  placeholder="Ej: iPhone 15 Pro"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={getFieldError('name') ? 'border-red-300' : ''}
                />
                {getFieldError('name') && (
                  <p className="text-sm text-red-600">{getFieldError('name')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU *</Label>
                <Input
                  id="edit-sku"
                  placeholder="Ej: IPH15P-128"
                  value={formData.sku || ''}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  className={getFieldError('sku') ? 'border-red-300' : ''}
                />
                {getFieldError('sku') && (
                  <p className="text-sm text-red-600">{getFieldError('sku')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoría *</Label>
                <Select
                  value={formData.category || ''}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className={getFieldError('category') ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getFieldError('category') && (
                  <p className="text-sm text-red-600">{getFieldError('category')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-supplier">Proveedor *</Label>
                <Select
                  value={formData.supplier || ''}
                  onValueChange={(value) => setFormData({ ...formData, supplier: value })}
                >
                  <SelectTrigger className={getFieldError('supplier') ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(sup => (
                      <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getFieldError('supplier') && (
                  <p className="text-sm text-red-600">{getFieldError('supplier')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  placeholder="Descripción detallada del producto"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            {/* Precios y Stock */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 border-b pb-2">Precios y Stock</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-cost">Costo *</Label>
                  <Input
                    id="edit-cost"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.cost || ''}
                    onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                    className={getFieldError('cost') ? 'border-red-300' : ''}
                  />
                  {getFieldError('cost') && (
                    <p className="text-sm text-red-600">{getFieldError('cost')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-price">Precio de Venta *</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className={getFieldError('price') ? 'border-red-300' : ''}
                  />
                  {getFieldError('price') && (
                    <p className="text-sm text-red-600">{getFieldError('price')}</p>
                  )}
                </div>
              </div>

              {formData.price && formData.cost && formData.price > formData.cost && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    Margen de ganancia: <span className="font-semibold">{getMarginPercentage(formData.price, formData.cost)}%</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-stock">Stock Actual *</Label>
                  <Input
                    id="edit-stock"
                    type="number"
                    placeholder="0"
                    value={formData.stock || ''}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className={getFieldError('stock') ? 'border-red-300' : ''}
                  />
                  {getFieldError('stock') && (
                    <p className="text-sm text-red-600">{getFieldError('stock')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-minStock">Stock Mínimo *</Label>
                  <Input
                    id="edit-minStock"
                    type="number"
                    placeholder="0"
                    value={formData.minStock || ''}
                    onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                    className={getFieldError('minStock') ? 'border-red-300' : ''}
                  />
                  {getFieldError('minStock') && (
                    <p className="text-sm text-red-600">{getFieldError('minStock')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-maxStock">Stock Máximo *</Label>
                  <Input
                    id="edit-maxStock"
                    type="number"
                    placeholder="0"
                    value={formData.maxStock || ''}
                    onChange={(e) => setFormData({ ...formData, maxStock: parseInt(e.target.value) || 0 })}
                    className={getFieldError('maxStock') ? 'border-red-300' : ''}
                  />
                  {getFieldError('maxStock') && (
                    <p className="text-sm text-red-600">{getFieldError('maxStock')}</p>
                  )}
                </div>
              </div>

              <h4 className="font-semibold text-gray-900 border-b pb-2 pt-4">Información Adicional</h4>

              <div className="space-y-2">
                <Label htmlFor="edit-barcode">Código de Barras</Label>
                <Input
                  id="edit-barcode"
                  placeholder="123456789012"
                  value={formData.barcode || ''}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-weight">Peso (kg)</Label>
                  <Input
                    id="edit-weight"
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={formData.weight || ''}
                    onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || undefined })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-dimensions">Dimensiones</Label>
                  <Input
                    id="edit-dimensions"
                    placeholder="L x W x H mm"
                    value={formData.dimensions || ''}
                    onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                resetForm()
              }}
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleEditProduct}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Actualizando...' : 'Actualizar Producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-900 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este producto?
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h4 className="font-semibold text-red-900">{selectedProduct.name}</h4>
              <p className="text-sm text-red-700">SKU: {selectedProduct.sku}</p>
              <p className="text-sm text-red-700">Stock actual: {selectedProduct.stock} unidades</p>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setSelectedProduct(null)
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteProduct}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Eliminando...' : 'Eliminar Producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
import { GSIcon } from '@/components/ui/standardized-components'
