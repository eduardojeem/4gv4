'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, Edit, Trash2, Save, X, Package, Tag, Building2, Settings2, 
  Search, Filter, Download, Upload, Eye, EyeOff, AlertCircle, 
  CheckCircle, Globe, Phone, Mail, MapPin, Users, TrendingUp,
  MoreHorizontal, Copy, Archive, Star, ArrowLeft, ShoppingBag
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

// Tipos de datos mejorados
interface Category {
  id: string
  name: string
  description: string
  subcategories: string[]
  productCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  color?: string
}

interface Brand {
  id: string
  name: string
  description: string
  website: string
  productCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  logo?: string
  rating?: number
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
  createdAt: string
  updatedAt: string
  rating?: number
  paymentTerms?: string
  notes?: string
}

// Datos mock eliminados para usar Supabase



import { createClient } from '@/lib/supabase/client'

export function ProductConfiguration() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Estados principales
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  
  // Cargar datos desde Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('*')
        
        if (categoriesError) throw categoriesError
        
        if (categoriesData) {
          const formattedCategories: Category[] = categoriesData.map(cat => ({
            id: cat.id,
            name: cat.name,
            description: cat.description || '',
            subcategories: [], // TODO: Implement subcategories logic
            productCount: 0, // TODO: Implement product count
            isActive: cat.is_active ?? true,
            createdAt: cat.created_at || new Date().toISOString(),
            updatedAt: cat.updated_at || new Date().toISOString(),
            color: '#3B82F6' // Default color
          }))
          setCategories(formattedCategories)
        }

        // Fetch Suppliers
        const { data: suppliersData, error: suppliersError } = await supabase
          .from('suppliers')
          .select('*')
        
        if (suppliersError) throw suppliersError

        if (suppliersData) {
          const formattedSuppliers: Supplier[] = suppliersData.map(sup => ({
            id: sup.id,
            name: sup.name,
            contact: sup.contact_name || '',
            email: sup.contact_email || '',
            phone: sup.phone || '',
            address: sup.address || '',
            productCount: 0,
            isActive: sup.is_active ?? true,
            createdAt: sup.created_at || new Date().toISOString(),
            updatedAt: sup.updated_at || new Date().toISOString(),
            rating: 5,
            paymentTerms: '',
            notes: ''
          }))
          setSuppliers(formattedSuppliers)
        }

        // Fetch Brands (derived from products)
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('brand')
          .not('brand', 'is', null)
        
        if (productsError) throw productsError

        if (productsData) {
          const uniqueBrands = Array.from(new Set(productsData.map(p => p.brand).filter(Boolean))) as string[]
          const formattedBrands: Brand[] = uniqueBrands.map((brandName, index) => ({
            id: `brand-${index}`,
            name: brandName,
            description: '',
            website: '',
            productCount: 0,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }))
          setBrands(formattedBrands)
        }

      } catch (error) {
        console.error('Error fetching configuration data:', error)
        toast.error('Error al cargar datos de configuración')
      }
    }

    fetchData()
  }, [supabase])
  
  const [activeTab, setActiveTab] = useState('categories')
  
  // Estados de UI
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  
  // Estados de formularios
  const [newCategory, setNewCategory] = useState({ 
    name: '', description: '', subcategories: '', color: '#3B82F6' 
  })
  const [newBrand, setBrand] = useState({ 
    name: '', description: '', website: '' 
  })
  const [newSupplier, setNewSupplier] = useState({ 
    name: '', contact: '', email: '', phone: '', address: '', paymentTerms: '', notes: '' 
  })
  
  // Estados de validación
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Funciones de validación
  const validateCategory = useCallback((category: any) => {
    const newErrors: Record<string, string> = {}
    
    if (!category.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    } else if (category.name.length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres'
    }
    
    if (!category.description.trim()) {
      newErrors.description = 'La descripción es requerida'
    }
    
    return newErrors
  }, [])

  const validateBrand = useCallback((brand: any) => {
    const newErrors: Record<string, string> = {}
    
    if (!brand.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    }
    
    if (brand.website && !brand.website.match(/^https?:\/\/.+/)) {
      newErrors.website = 'URL inválida'
    }
    
    return newErrors
  }, [])

  const validateSupplier = useCallback((supplier: any) => {
    const newErrors: Record<string, string> = {}
    
    if (!supplier.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    }
    
    if (!supplier.email.trim()) {
      newErrors.email = 'El email es requerido'
    } else if (!supplier.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = 'Email inválido'
    }
    
    if (!supplier.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido'
    }
    
    return newErrors
  }, [])

  // Datos filtrados
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cat.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = showInactive || cat.isActive
      return matchesSearch && matchesStatus
    })
  }, [categories, searchTerm, showInactive])

  const filteredBrands = useMemo(() => {
    return brands.filter(brand => {
      const matchesSearch = brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           brand.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = showInactive || brand.isActive
      return matchesSearch && matchesStatus
    })
  }, [brands, searchTerm, showInactive])

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => {
      const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           supplier.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           supplier.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = showInactive || supplier.isActive
      return matchesSearch && matchesStatus
    })
  }, [suppliers, searchTerm, showInactive])

  // Estadísticas
  const stats = useMemo(() => {
    return {
      totalCategories: categories.length,
      activeCategories: categories.filter(c => c.isActive).length,
      totalBrands: brands.length,
      activeBrands: brands.filter(b => b.isActive).length,
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter(s => s.isActive).length,
      totalProducts: categories.reduce((sum, cat) => sum + cat.productCount, 0)
    }
  }, [categories, brands, suppliers])

  // Handlers para categorías
  const handleAddCategory = useCallback(() => {
    const validationErrors = validateCategory(newCategory)
    setErrors(validationErrors)
    
    if (Object.keys(validationErrors).length === 0) {
      const category: Category = {
        id: Date.now().toString(),
        name: newCategory.name,
        description: newCategory.description,
        subcategories: newCategory.subcategories.split(',').map(s => s.trim()).filter(s => s),
        productCount: 0,
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        color: newCategory.color
      }
      setCategories(prev => [...prev, category])
      setNewCategory({ name: '', description: '', subcategories: '', color: '#3B82F6' })
      setIsDialogOpen(false)
      toast.success('Categoría agregada exitosamente')
    }
  }, [newCategory, validateCategory])

  const handleEditCategory = useCallback((category: Category) => {
    setEditingItem(category)
    setNewCategory({
      name: category.name,
      description: category.description,
      subcategories: category.subcategories.join(', '),
      color: category.color || '#3B82F6'
    })
    setIsDialogOpen(true)
  }, [])

  const handleUpdateCategory = useCallback(() => {
    const validationErrors = validateCategory(newCategory)
    setErrors(validationErrors)
    
    if (Object.keys(validationErrors).length === 0 && editingItem) {
      setCategories(prev => prev.map(cat => 
        cat.id === editingItem.id 
          ? {
              ...cat,
              name: newCategory.name,
              description: newCategory.description,
              subcategories: newCategory.subcategories.split(',').map(s => s.trim()).filter(s => s),
              color: newCategory.color,
              updatedAt: new Date().toISOString().split('T')[0]
            }
          : cat
      ))
      setEditingItem(null)
      setNewCategory({ name: '', description: '', subcategories: '', color: '#3B82F6' })
      setIsDialogOpen(false)
      toast.success('Categoría actualizada exitosamente')
    }
  }, [newCategory, editingItem, validateCategory])

  const handleDeleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== id))
    setDeleteConfirmOpen(false)
    setItemToDelete(null)
    toast.success('Categoría eliminada exitosamente')
  }, [])

  const handleToggleCategoryStatus = useCallback((id: string) => {
    setCategories(prev => prev.map(cat => 
      cat.id === id 
        ? { ...cat, isActive: !cat.isActive, updatedAt: new Date().toISOString().split('T')[0] }
        : cat
    ))
  }, [])

  // Handlers para marcas
  const handleAddBrand = useCallback(() => {
    const validationErrors = validateBrand(newBrand)
    setErrors(validationErrors)
    
    if (Object.keys(validationErrors).length === 0) {
      const brand: Brand = {
        id: Date.now().toString(),
        name: newBrand.name,
        description: newBrand.description,
        website: newBrand.website,
        productCount: 0,
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      }
      setBrands(prev => [...prev, brand])
      setBrand({ name: '', description: '', website: '' })
      setIsDialogOpen(false)
      toast.success('Marca agregada exitosamente')
    }
  }, [newBrand, validateBrand])

  const handleDeleteBrand = useCallback((id: string) => {
    setBrands(prev => prev.filter(brand => brand.id !== id))
    setDeleteConfirmOpen(false)
    setItemToDelete(null)
    toast.success('Marca eliminada exitosamente')
  }, [])

  // Handlers para proveedores
  const handleAddSupplier = useCallback(() => {
    const validationErrors = validateSupplier(newSupplier)
    setErrors(validationErrors)
    
    if (Object.keys(validationErrors).length === 0) {
      const supplier: Supplier = {
        id: Date.now().toString(),
        name: newSupplier.name,
        contact: newSupplier.contact,
        email: newSupplier.email,
        phone: newSupplier.phone,
        address: newSupplier.address,
        productCount: 0,
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        paymentTerms: newSupplier.paymentTerms,
        notes: newSupplier.notes
      }
      setSuppliers(prev => [...prev, supplier])
      setNewSupplier({ name: '', contact: '', email: '', phone: '', address: '', paymentTerms: '', notes: '' })
      setIsDialogOpen(false)
      toast.success('Proveedor agregado exitosamente')
    }
  }, [newSupplier, validateSupplier])

  const handleDeleteSupplier = useCallback((id: string) => {
    setSuppliers(prev => prev.filter(supplier => supplier.id !== id))
    setDeleteConfirmOpen(false)
    setItemToDelete(null)
    toast.success('Proveedor eliminado exitosamente')
  }, [])

  // Handlers generales
  const handleConfirmDelete = useCallback(() => {
    if (itemToDelete) {
      switch (activeTab) {
        case 'categories':
          handleDeleteCategory(itemToDelete.id)
          break
        case 'brands':
          handleDeleteBrand(itemToDelete.id)
          break
        case 'suppliers':
          handleDeleteSupplier(itemToDelete.id)
          break
      }
    }
  }, [itemToDelete, activeTab, handleDeleteCategory, handleDeleteBrand, handleDeleteSupplier])

  const openDeleteDialog = useCallback((item: any) => {
    setItemToDelete(item)
    setDeleteConfirmOpen(true)
  }, [])

  const handleExport = useCallback(() => {
    const data = { categories, brands, suppliers }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product-configuration.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Configuración exportada exitosamente')
  }, [categories, brands, suppliers])

  const resetForm = useCallback(() => {
    setNewCategory({ name: '', description: '', subcategories: '', color: '#3B82F6' })
    setBrand({ name: '', description: '', website: '' })
    setNewSupplier({ name: '', contact: '', email: '', phone: '', address: '', paymentTerms: '', notes: '' })
    setEditingItem(null)
    setErrors({})
  }, [])

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false)
    resetForm()
  }, [resetForm])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      resetForm()
    }
  }, [resetForm])

  // Funciones de navegación
  const handleBackToProducts = useCallback(() => {
    router.push('/dashboard/products')
  }, [router])

  const handleGoToNewProduct = useCallback(() => {
    router.push('/dashboard/products')
  }, [router])

  return (
    <div className="space-y-6">
      {/* Header mejorado con navegación */}
      <div className="flex flex-col gap-4">
        {/* Breadcrumb y navegación */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="navigation" aria-label="Navegación de productos">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackToProducts}
            className="gap-2 text-muted-foreground hover:text-foreground p-0 h-auto font-normal"
            aria-label="Regresar a la página principal de productos"
            title="Regresar a la página principal de productos"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Productos
          </Button>
          <span aria-hidden="true">/</span>
          <span className="text-foreground font-medium" aria-current="page">Configuración</span>
        </div>

        {/* Header principal */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Settings2 className="h-6 w-6 text-primary" />
              </div>
              Configuración de Productos
            </h2>
            <p className="text-muted-foreground mt-1">
              Gestiona categorías, marcas y proveedores para organizar tu inventario de manera eficiente
            </p>
          </div>
          
          <div className="flex items-center gap-2">
             {/* Botones de navegación */}
             <Button 
               variant="outline" 
               onClick={handleBackToProducts}
               className="gap-2"
               aria-label="Ir a la página principal de productos"
               title="Ver todos los productos del inventario"
             >
               <ShoppingBag className="h-4 w-4" aria-hidden="true" />
               Ver Productos
             </Button>
             <Button 
               onClick={handleGoToNewProduct}
               className="gap-2"
               aria-label="Crear un nuevo producto"
               title="Agregar un nuevo producto al inventario"
             >
               <Plus className="h-4 w-4" aria-hidden="true" />
               Nuevo Producto
             </Button>
            
            {/* Separador visual */}
            <div className="w-px h-6 bg-border mx-1" />
            
            {/* Botones de configuración */}
            <Button variant="outline" onClick={handleExport} className="gap-2" aria-label="Exportar configuración" title="Exportar configuración a JSON">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Importar configuración"
              title="Importar configuración desde JSON"
            >
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <input 
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const text = await file.text()
                  const data = JSON.parse(text)
                  const { categories: c, brands: b, suppliers: s } = data || {}
                  if (Array.isArray(c)) setCategories(c)
                  if (Array.isArray(b)) setBrands(b)
                  if (Array.isArray(s)) setSuppliers(s)
                  toast.success('Configuración importada exitosamente')
                } catch (err) {
                  toast.error('Archivo inválido. Verifique el JSON de configuración')
                } finally {
                  e.currentTarget.value = ''
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Productos</p>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categorías</p>
                <p className="text-2xl font-bold">{stats.activeCategories}/{stats.totalCategories}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Marcas</p>
                <p className="text-2xl font-bold">{stats.activeBrands}/{stats.totalBrands}</p>
              </div>
              <Tag className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Proveedores</p>
                <p className="text-2xl font-bold">{stats.activeSuppliers}/{stats.totalSuppliers}</p>
              </div>
              <Building2 className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles de búsqueda y filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, descripción o contacto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              aria-label="Buscar categorías, marcas y proveedores"
            />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <Label htmlFor="show-inactive" className="text-sm">
                  Mostrar inactivos
                </Label>
              </div>
              
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Categorías ({filteredCategories.length})
          </TabsTrigger>
          <TabsTrigger value="brands" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Marcas ({filteredBrands.length})
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Proveedores ({filteredSuppliers.length})
          </TabsTrigger>
        </TabsList>

        {/* Pestaña de Categorías mejorada */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Categorías de Productos
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Organiza tus productos en categorías para una mejor gestión
                </p>
              </div>
              <Dialog open={isDialogOpen && activeTab === 'categories'} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button className="gap-2" aria-label="Nueva categoría" title="Agregar nueva categoría">
                    <Plus className="h-4 w-4" />
                    Nueva Categoría
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Editar Categoría' : 'Agregar Nueva Categoría'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingItem 
                        ? 'Modifica los datos de la categoría existente'
                        : 'Crea una nueva categoría para organizar tus productos'
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="categoryName">Nombre *</Label>
                      <Input
                        id="categoryName"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                        placeholder="Nombre de la categoría"
                        className={errors.name ? 'border-red-500' : ''}
                      />
                      {errors.name && (
                        <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.name}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="categoryDescription">Descripción *</Label>
                      <Textarea
                        id="categoryDescription"
                        value={newCategory.description}
                        onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                        placeholder="Descripción de la categoría"
                        className={errors.description ? 'border-red-500' : ''}
                      />
                      {errors.description && (
                        <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.description}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="subcategories">Subcategorías</Label>
                      <Input
                        id="subcategories"
                        value={newCategory.subcategories}
                        onChange={(e) => setNewCategory({...newCategory, subcategories: e.target.value})}
                        placeholder="Subcategoría 1, Subcategoría 2, ..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Separar con comas
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="categoryColor">Color</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="categoryColor"
                          type="color"
                          value={newCategory.color}
                          onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                          className="w-16 h-10 p-1 border rounded"
                        />
                        <Input
                          value={newCategory.color}
                          onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                          placeholder="#3B82F6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleDialogClose}>
                      Cancelar
                    </Button>
                    <Button onClick={editingItem ? handleUpdateCategory : handleAddCategory}>
                      {editingItem ? 'Actualizar' : 'Agregar'} Categoría
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Subcategorías</TableHead>
                      <TableHead>Productos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Última actualización</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No se encontraron categorías
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCategories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: category.color }}
                              />
                              <div>
                                <p className="font-medium">{category.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {category.description}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {category.subcategories.slice(0, 3).map((sub, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {sub}
                                </Badge>
                              ))}
                              {category.subcategories.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{category.subcategories.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Package className="h-3 w-3" />
                              {category.productCount}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={category.isActive ? "default" : "secondary"}
                                className="gap-1"
                              >
                                {category.isActive ? (
                                  <CheckCircle className="h-3 w-3" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                                {category.isActive ? 'Activa' : 'Inactiva'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {category.updatedAt}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" aria-label="Abrir menú de acciones" title="Abrir acciones de categoría">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditCategory(category)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleCategoryStatus(category.id)}>
                                  {category.isActive ? (
                                    <>
                                      <EyeOff className="h-4 w-4 mr-2" />
                                      Desactivar
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-4 w-4 mr-2" />
                                      Activar
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => openDeleteDialog(category)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Marcas mejorada */}
        <TabsContent value="brands" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Marcas de Productos
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Gestiona las marcas de tus productos
                </p>
              </div>
              <Dialog open={isDialogOpen && activeTab === 'brands'} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button className="gap-2" aria-label="Nueva marca" title="Agregar nueva marca">
                    <Plus className="h-4 w-4" />
                    Nueva Marca
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Agregar Nueva Marca</DialogTitle>
                    <DialogDescription>
                      Registra una nueva marca para tus productos
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="brandName">Nombre *</Label>
                      <Input
                        id="brandName"
                        value={newBrand.name}
                        onChange={(e) => setBrand({...newBrand, name: e.target.value})}
                        placeholder="Nombre de la marca"
                        className={errors.name ? 'border-red-500' : ''}
                      />
                      {errors.name && (
                        <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="brandDescription">Descripción</Label>
                      <Textarea
                        id="brandDescription"
                        value={newBrand.description}
                        onChange={(e) => setBrand({...newBrand, description: e.target.value})}
                        placeholder="Descripción de la marca"
                      />
                    </div>
                    <div>
                      <Label htmlFor="brandWebsite">Sitio Web</Label>
                      <Input
                        id="brandWebsite"
                        value={newBrand.website}
                        onChange={(e) => setBrand({...newBrand, website: e.target.value})}
                        placeholder="https://ejemplo.com"
                        className={errors.website ? 'border-red-500' : ''}
                      />
                      {errors.website && (
                        <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.website}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleDialogClose}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddBrand}>
                      Agregar Marca
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>Sitio Web</TableHead>
                      <TableHead>Productos</TableHead>
                      <TableHead>Calificación</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBrands.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No se encontraron marcas
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBrands.map((brand) => (
                        <TableRow key={brand.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{brand.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {brand.description}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {brand.website && (
                              <a 
                                href={brand.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Globe className="h-3 w-3" />
                                {brand.website.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Package className="h-3 w-3" />
                              {brand.productCount}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {brand.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-sm">{brand.rating}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={brand.isActive ? "default" : "secondary"}
                              className="gap-1"
                            >
                              {brand.isActive ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                              {brand.isActive ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" aria-label="Abrir menú de acciones" title="Abrir acciones de marca">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => openDeleteDialog(brand)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Proveedores mejorada */}
        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Proveedores
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Administra tu red de proveedores
                </p>
              </div>
              <Dialog open={isDialogOpen && activeTab === 'suppliers'} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button className="gap-2" aria-label="Nuevo proveedor" title="Agregar nuevo proveedor">
                    <Plus className="h-4 w-4" />
                    Nuevo Proveedor
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Agregar Nuevo Proveedor</DialogTitle>
                    <DialogDescription>
                      Registra un nuevo proveedor para tus productos
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplierName">Nombre de la Empresa *</Label>
                      <Input
                        id="supplierName"
                        value={newSupplier.name}
                        onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                        placeholder="Nombre del proveedor"
                        className={errors.name ? 'border-red-500' : ''}
                      />
                      {errors.name && (
                        <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="supplierContact">Contacto</Label>
                      <Input
                        id="supplierContact"
                        value={newSupplier.contact}
                        onChange={(e) => setNewSupplier({...newSupplier, contact: e.target.value})}
                        placeholder="Nombre del contacto"
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplierEmail">Email *</Label>
                      <Input
                        id="supplierEmail"
                        type="email"
                        value={newSupplier.email}
                        onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                        placeholder="email@ejemplo.com"
                        className={errors.email ? 'border-red-500' : ''}
                      />
                      {errors.email && (
                        <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.email}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="supplierPhone">Teléfono *</Label>
                      <Input
                        id="supplierPhone"
                        value={newSupplier.phone}
                        onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                        placeholder="+1234567890"
                        className={errors.phone ? 'border-red-500' : ''}
                      />
                      {errors.phone && (
                        <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.phone}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="supplierPaymentTerms">Términos de Pago</Label>
                      <Input
                        id="supplierPaymentTerms"
                        value={newSupplier.paymentTerms}
                        onChange={(e) => setNewSupplier({...newSupplier, paymentTerms: e.target.value})}
                        placeholder="30 días, 15 días, etc."
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="supplierAddress">Dirección</Label>
                      <Textarea
                        id="supplierAddress"
                        value={newSupplier.address}
                        onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                        placeholder="Dirección completa del proveedor"
                        rows={2}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="supplierNotes">Notas</Label>
                      <Textarea
                        id="supplierNotes"
                        value={newSupplier.notes}
                        onChange={(e) => setNewSupplier({...newSupplier, notes: e.target.value})}
                        placeholder="Información adicional sobre el proveedor"
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleDialogClose}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddSupplier}>
                      Agregar Proveedor
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Productos</TableHead>
                      <TableHead>Calificación</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
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
                              <p className="font-medium">{supplier.name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3" />
                                {supplier.address}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{supplier.contact}</p>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {supplier.email}
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {supplier.phone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Package className="h-3 w-3" />
                              {supplier.productCount}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {supplier.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-sm">{supplier.rating}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={supplier.isActive ? "default" : "secondary"}
                              className="gap-1"
                            >
                              {supplier.isActive ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                              {supplier.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" aria-label="Abrir menú de acciones" title="Abrir acciones de proveedor">
                                  <MoreHorizontal className="h-4 w-4" />
                                 </Button>
                               </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Users className="h-4 w-4 mr-2" />
                                  Ver productos
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => openDeleteDialog(supplier)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente{' '}
              {itemToDelete?.name} y todos los datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}