'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Package, Building2, Users, Search, Filter, MoreVertical, Edit, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCategories } from '@/hooks/useCategories'
import { useSuppliers } from '@/hooks/useSuppliers'
import { 
  Category, 
  Brand, 
  CatalogItemType, 
  ModalMode, 
  CatalogFilters,
  DEFAULT_CATEGORIES,
  DEFAULT_BRANDS
} from '@/lib/types/catalog'
import { CategoryModal } from './category-modal'
import { BrandModal } from './brand-modal'
import { SupplierModal } from './supplier-modal'
import { Supplier } from '@/lib/types/supplier'

interface CatalogManagerProps {
  className?: string
  onCategoryChange?: (categories: Category[]) => void
  onBrandChange?: (brands: Brand[]) => void
  onSupplierChange?: (suppliers: Supplier[]) => void
}

export function CatalogManager({
  className,
  onCategoryChange,
  onBrandChange,
  onSupplierChange
}: CatalogManagerProps) {
  // Hook para categorías
  const {
    categories: dbCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    loading: isLoadingCategories
  } = useCategories()

  // Transformar categorías de DB a UI
  const categories: Category[] = useMemo(() => {
    return dbCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description || '',
      subcategories: [], // TODO: Implementar subcategorías
      color: '#3B82F6', // Color por defecto
      isActive: cat.is_active,
      productCount: 0, // TODO: Implementar conteo
      createdAt: cat.created_at,
      updatedAt: cat.updated_at,
      parentId: cat.parent_id || undefined,
      icon: 'Package' // Icono por defecto
    }))
  }, [dbCategories])

  // Notificar cambios al padre
  useEffect(() => {
    onCategoryChange?.(categories)
  }, [categories, onCategoryChange])

  // Estados para datos
  const [brands, setBrands] = useState<Brand[]>(DEFAULT_BRANDS.map((b, i) => ({
    ...b,
    id: `brand_${i}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })))
  
  const {
    suppliers: dbSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    loading: isLoadingSuppliers
  } = useSuppliers()

  const suppliers: Supplier[] = useMemo(() => {
    return dbSuppliers.map(s => ({
      id: s.id,
      name: s.name,
      contact_person: s.contact_name || '',
      email: s.contact_email || '',
      phone: s.phone || '',
      address: s.address || '',
      city: '',
      country: 'Chile',
      tax_id: s.tax_id || '',
      postal_code: '',
      website: '',
      business_type: 'distributor',
      industry: 'General',
      company_size: 'small',
      status: s.is_active ? 'active' : 'inactive',
      rating: 5,
      reliability_score: 100,
      quality_score: 100,
      delivery_score: 100,
      payment_terms: '30 días',
      currency: 'CLP',
      lead_time_days: 1,
      minimum_order_amount: 0,
      products_count: 0,
      categories: [],
      specialties: [],
      total_orders: 0,
      total_amount: 0,
      avg_order_value: 0,
      on_time_delivery_rate: 100,
      defect_rate: 0,
      response_time_hours: 1,
      preferred_contact_method: 'email',
      communication_language: 'Español',
      time_zone: 'UTC-4',
      certifications: [],
      compliance_status: 'compliant',
      tags: [],
      created_at: s.created_at,
      updated_at: s.updated_at,
      created_by: 'system',
      last_modified_by: 'system',
      sync_status: 'synced',
      risk_level: 'low',
      risk_factors: [],
      performance_trend: 'stable'
    }))
  }, [dbSuppliers])

  // Notificar cambios de proveedores
  useEffect(() => {
    onSupplierChange?.(suppliers)
  }, [suppliers, onSupplierChange])


  // Estados para modales
  const [categoryModal, setCategoryModal] = useState<{
    isOpen: boolean
    mode: ModalMode
    category?: Category
  }>({ isOpen: false, mode: 'add' })

  const [brandModal, setBrandModal] = useState<{
    isOpen: boolean
    mode: ModalMode
    brand?: Brand
  }>({ isOpen: false, mode: 'add' })

  const [supplierModal, setSupplierModal] = useState<{
    isOpen: boolean
    mode: ModalMode
    supplier?: Supplier
  }>({ isOpen: false, mode: 'add' })

  // Estados para filtros y búsqueda
  const [activeTab, setActiveTab] = useState<CatalogItemType>('categories')
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<CatalogFilters>({
    status: 'all',
    sortBy: 'name',
    sortOrder: 'asc'
  })



  // Funciones para manejar categorías
  const handleCategoryAdd = () => {
    setCategoryModal({ isOpen: true, mode: 'add' })
  }

  const handleCategoryEdit = (category: Category) => {
    setCategoryModal({ isOpen: true, mode: 'edit', category })
  }

  const handleCategoryDelete = async (categoryId: string) => {
    const res = await deleteCategory(categoryId)
    if (res.success) {
      toast.success('Categoría eliminada exitosamente')
    } else {
      toast.error(res.error || 'Error al eliminar categoría')
    }
  }

  const handleCategoryToggleStatus = async (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    if (cat) {
      const res = await updateCategory(categoryId, { is_active: !cat.isActive })
      if (res.success) {
        toast.success('Estado de categoría actualizado')
      } else {
        toast.error(res.error || 'Error al actualizar estado')
      }
    }
  }

  const handleCategorySave = async (category: Category) => {
    try {
      if (categoryModal.mode === 'add') {
        const res = await createCategory({
          name: category.name,
          description: category.description,
          is_active: category.isActive,
          parent_id: category.parentId || null
        })
        if (res.success) {
          toast.success('Categoría creada exitosamente')
          setCategoryModal({ isOpen: false, mode: 'add' })
        } else {
          toast.error(res.error || 'Error al crear categoría')
        }
      } else {
        const res = await updateCategory(category.id, {
          name: category.name,
          description: category.description,
          is_active: category.isActive,
          parent_id: category.parentId || null
        })
        if (res.success) {
          toast.success('Categoría actualizada exitosamente')
          setCategoryModal({ isOpen: false, mode: 'add' })
        } else {
          toast.error(res.error || 'Error al actualizar categoría')
        }
      }
    } catch (e) {
      toast.error('Ocurrió un error inesperado')
    }
  }

  // Funciones para manejar marcas
  const handleBrandAdd = () => {
    setBrandModal({ isOpen: true, mode: 'add' })
  }

  const handleBrandEdit = (brand: Brand) => {
    setBrandModal({ isOpen: true, mode: 'edit', brand })
  }

  const handleBrandDelete = (brandId: string) => {
    const updatedBrands = brands.filter(b => b.id !== brandId)
    setBrands(updatedBrands)
    onBrandChange?.(updatedBrands)
    toast.success('Marca eliminada exitosamente')
  }

  const handleBrandToggleStatus = (brandId: string) => {
    const updatedBrands = brands.map(b =>
      b.id === brandId ? { ...b, isActive: !b.isActive } : b
    )
    setBrands(updatedBrands)
    onBrandChange?.(updatedBrands)
    toast.success('Estado de marca actualizado')
  }

  const handleBrandSave = (brand: Brand) => {
    let updatedBrands: Brand[]
    
    if (brandModal.mode === 'add') {
      updatedBrands = [...brands, brand]
    } else {
      updatedBrands = brands.map(b => b.id === brand.id ? brand : b)
    }
    
    setBrands(updatedBrands)
    onBrandChange?.(updatedBrands)
    setBrandModal({ isOpen: false, mode: 'add' })
  }

  // Funciones para manejar proveedores
  const handleSupplierAdd = () => {
    setSupplierModal({ isOpen: true, mode: 'add' })
  }

  const handleSupplierEdit = (supplier: Supplier) => {
    setSupplierModal({ isOpen: true, mode: 'edit', supplier })
  }

  const handleSupplierDelete = async (supplierId: string) => {
    const res = await deleteSupplier(supplierId)
    if (res.success) {
      toast.success('Proveedor eliminado exitosamente')
    } else {
      toast.error(res.error || 'Error al eliminar proveedor')
    }
  }

  const handleSupplierSave = async (supplier: any) => {
    try {
      if (supplierModal.mode === 'add') {
        const res = await createSupplier({
          name: supplier.name,
          contact_name: supplier.contact_person,
          contact_email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          tax_id: supplier.tax_id,
          is_active: supplier.status === 'active'
        })
        if (res.success) {
          toast.success('Proveedor creado exitosamente')
          setSupplierModal({ isOpen: false, mode: 'add' })
        } else {
          toast.error(res.error || 'Error al crear proveedor')
        }
      } else {
        const res = await updateSupplier(supplier.id, {
          name: supplier.name,
          contact_name: supplier.contact_person,
          contact_email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          tax_id: supplier.tax_id,
          is_active: supplier.status === 'active'
        })
        if (res.success) {
          toast.success('Proveedor actualizado exitosamente')
          setSupplierModal({ isOpen: false, mode: 'add' })
        } else {
          toast.error(res.error || 'Error al actualizar proveedor')
        }
      }
    } catch (e) {
      toast.error('Ocurrió un error inesperado')
    }
  }

  // Funciones de filtrado
  const getFilteredItems = () => {
    let items: any[] = []
    
    switch (activeTab) {
      case 'categories':
        items = categories
        break
      case 'brands':
        items = brands
        break
      case 'suppliers':
        items = suppliers
        break
    }

    // Filtrar por término de búsqueda
    if (searchTerm) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Filtrar por estado
    if (filters.status !== 'all') {
      if (activeTab === 'suppliers') {
        items = items.filter(item => item.status === filters.status)
      } else {
        items = items.filter(item => 
          filters.status === 'active' ? item.isActive : !item.isActive
        )
      }
    }

    // Ordenar
    items.sort((a, b) => {
      let aValue = a[filters.sortBy]
      let bValue = b[filters.sortBy]
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (filters.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    return items
  }

  const renderItemCard = (item: any, type: CatalogItemType) => {
    const isActive = type === 'suppliers' ? item.status === 'active' : item.isActive

    return (
      <Card key={item.id} className={cn(
        "transition-all duration-200 hover:shadow-md",
        !isActive && "opacity-60"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {type === 'categories' && <Package className="w-5 h-5 text-blue-600" />}
              {type === 'brands' && <Building2 className="w-5 h-5 text-green-600" />}
              {type === 'suppliers' && <Users className="w-5 h-5 text-purple-600" />}
              <div>
                <CardTitle className="text-lg">{item.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {item.description || (type === 'suppliers' ? item.email : 'Sin descripción')}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isActive ? 'default' : 'secondary'}>
                {isActive ? 'Activo' : 'Inactivo'}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    if (type === 'categories') handleCategoryEdit(item)
                    else if (type === 'brands') handleBrandEdit(item)
                    else handleSupplierEdit(item)
                  }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  {type !== 'suppliers' && (
                    <DropdownMenuItem onClick={() => {
                      if (type === 'categories') handleCategoryToggleStatus(item.id)
                      else handleBrandToggleStatus(item.id)
                    }}>
                      {isActive ? <ToggleLeft className="w-4 h-4 mr-2" /> : <ToggleRight className="w-4 h-4 mr-2" />}
                      {isActive ? 'Desactivar' : 'Activar'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-red-600"
                    onClick={() => {
                      if (type === 'categories') handleCategoryDelete(item.id)
                      else if (type === 'brands') handleBrandDelete(item.id)
                      else handleSupplierDelete(item.id)
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        {(type === 'categories' && item.subcategories?.length > 0) && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1">
              {item.subcategories.slice(0, 3).map((sub: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {sub}
                </Badge>
              ))}
              {item.subcategories.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{item.subcategories.length - 3} más
                </Badge>
              )}
            </div>
          </CardContent>
        )}
        {type === 'brands' && item.country && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              📍 {item.country} {item.foundedYear && `• Fundada en ${item.foundedYear}`}
            </p>
          </CardContent>
        )}
        {type === 'suppliers' && (
          <CardContent className="pt-0">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>📧 {item.email}</p>
              <p>📞 {item.phone}</p>
              <p>🏢 {item.category}</p>
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  const filteredItems = getFilteredItems()

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Catálogo</h2>
          <p className="text-muted-foreground">
            Administra categorías, marcas y proveedores de tu inventario
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CatalogItemType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Categorías ({categories.length})
          </TabsTrigger>
          <TabsTrigger value="brands" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Marcas ({brands.length})
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Proveedores ({suppliers.length})
          </TabsTrigger>
        </TabsList>

        {/* Filtros y búsqueda */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={`Buscar ${activeTab === 'categories' ? 'categorías' : activeTab === 'brands' ? 'marcas' : 'proveedores'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as CatalogFilters['status'] }))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.sortBy} onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value as CatalogFilters['sortBy'] }))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="createdAt">Fecha</SelectItem>
              {activeTab === 'brands' && <SelectItem value="country">País</SelectItem>}
              {activeTab === 'suppliers' && <SelectItem value="category">Categoría</SelectItem>}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              if (activeTab === 'categories') handleCategoryAdd()
              else if (activeTab === 'brands') handleBrandAdd()
              else handleSupplierAdd()
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar {activeTab === 'categories' ? 'Categoría' : activeTab === 'brands' ? 'Marca' : 'Proveedor'}
          </Button>
        </div>

        {/* Contenido de tabs */}
        <TabsContent value={activeTab} className="space-y-4">
          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">
                    No se encontraron {activeTab === 'categories' ? 'categorías' : activeTab === 'brands' ? 'marcas' : 'proveedores'}
                  </p>
                  <p className="text-muted-foreground">
                    {searchTerm ? 'Intenta con otros términos de búsqueda' : `Comienza agregando tu primer ${activeTab === 'categories' ? 'categoría' : activeTab === 'brands' ? 'marca' : 'proveedor'}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => renderItemCard(item, activeTab))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modales */}
      <CategoryModal
        isOpen={categoryModal.isOpen}
        onClose={() => setCategoryModal({ isOpen: false, mode: 'add' })}
        mode={categoryModal.mode}
        category={categoryModal.category}
        onSave={handleCategorySave}
        existingCategories={categories}
      />

      <BrandModal
        isOpen={brandModal.isOpen}
        onClose={() => setBrandModal({ isOpen: false, mode: 'add' })}
        mode={brandModal.mode}
        brand={brandModal.brand}
        onSave={handleBrandSave}
        existingBrands={brands}
      />

      <SupplierModal
        isOpen={supplierModal.isOpen}
        onClose={() => setSupplierModal({ isOpen: false, mode: 'add' })}
        mode={supplierModal.mode}
        supplier={supplierModal.supplier}
        onSave={handleSupplierSave}
      />
    </div>
  )
}