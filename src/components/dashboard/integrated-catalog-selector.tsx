'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Package, Building2, Users, ChevronDown, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useCatalogSync } from '@/hooks/use-catalog-sync'
import { CategoryModal } from './category-modal'
import { BrandModal } from './brand-modal'
import { SupplierModal } from './supplier-modal'
import { Category, Brand, ModalMode } from '@/lib/types/catalog'
import { Supplier } from '@/lib/types/supplier'
import { UISupplier } from '@/lib/types/supplier-ui'

interface IntegratedCatalogSelectorProps {
  // Valores seleccionados
  selectedCategory?: string
  selectedSubcategory?: string
  selectedBrand?: string
  selectedSupplier?: string
  
  // Callbacks para cambios
  onCategoryChange?: (categoryId: string, subcategory?: string) => void
  onBrandChange?: (brandId: string) => void
  onSupplierChange?: (supplierId: string) => void
  
  // Configuración
  showQuickAdd?: boolean
  compact?: boolean
  className?: string
}

export function IntegratedCatalogSelector({
  selectedCategory,
  selectedSubcategory,
  selectedBrand,
  selectedSupplier,
  onCategoryChange,
  onBrandChange,
  onSupplierChange,
  showQuickAdd = true,
  compact = false,
  className
}: IntegratedCatalogSelectorProps) {
  const {
    categories,
    brands,
    suppliers,
    addCategory,
    addBrand,
    addSupplier,
    getCategoryOptions,
    getBrandOptions,
    getSupplierOptions
  } = useCatalogSync()

  // Estados para modales
  const [categoryModal, setCategoryModal] = useState<{
    isOpen: boolean
    mode: ModalMode
  }>({ isOpen: false, mode: 'add' })

  const [brandModal, setBrandModal] = useState<{
    isOpen: boolean
    mode: ModalMode
  }>({ isOpen: false, mode: 'add' })

  const [supplierModal, setSupplierModal] = useState<{
    isOpen: boolean
    mode: ModalMode
  }>({ isOpen: false, mode: 'add' })

  // Estados para popovers
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [brandOpen, setBrandOpen] = useState(false)
  const [supplierOpen, setSupplierOpen] = useState(false)

  // Obtener datos formateados
  const categoryOptions = getCategoryOptions()
  const brandOptions = getBrandOptions()
  const supplierOptions = getSupplierOptions()

  // Obtener categoría seleccionada
  const selectedCategoryData = categories.find(cat => cat.id === selectedCategory)
  const availableSubcategories = selectedCategoryData?.subcategories || []

  // Obtener nombres para mostrar
  const selectedCategoryName = selectedCategoryData?.name
  const selectedBrandName = brands.find(brand => brand.id === selectedBrand)?.name
  const selectedSupplierName = suppliers.find(supplier => supplier.id === selectedSupplier)?.name

  // Handlers para modales
  const handleCategorySave = (category: Category) => {
    addCategory(category)
    setCategoryModal({ isOpen: false, mode: 'add' })
    onCategoryChange?.(category.id)
  }

  const handleBrandSave = (brand: Brand) => {
    addBrand(brand)
    setBrandModal({ isOpen: false, mode: 'add' })
    onBrandChange?.(brand.id)
  }

  const handleSupplierSave = (supplierData: Partial<UISupplier>) => {
    // Create a complete Supplier object with defaults for missing required fields
    const newSupplier: Supplier = {
      id: crypto.randomUUID(),
      name: supplierData.name || '',
      contact_person: supplierData.contact_person || '',
      email: supplierData.email || '',
      phone: supplierData.phone || '',
      address: supplierData.address || '',
      city: supplierData.city || '',
      country: supplierData.country || '',
      website: supplierData.website || '',
      business_type: supplierData.business_type || 'manufacturer',
      status: supplierData.status || 'active',
      rating: supplierData.rating || 0,
      notes: supplierData.notes || '',
      
      // Default values for required fields not in UISupplier or not provided
      industry: 'Unspecified',
      company_size: 'small',
      postal_code: supplierData.postal_code,
      
      reliability_score: 100,
      quality_score: 100,
      delivery_score: 100,
      
      payment_terms: 'Net 30',
      currency: 'USD',
      
      lead_time_days: 7,
      minimum_order_amount: 0,
      
      products_count: 0,
      categories: [],
      specialties: [],
      
      total_orders: 0,
      total_amount: 0,
      avg_order_value: 0,
      
      on_time_delivery_rate: 100,
      defect_rate: 0,
      response_time_hours: 24,
      
      preferred_contact_method: 'email',
      communication_language: 'Spanish',
      time_zone: 'UTC',
      
      certifications: [],
      compliance_status: 'compliant',
      tags: [],
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'system',
      last_modified_by: 'system',
      
      sync_status: 'synced',
      risk_level: 'low',
      risk_factors: [],
      performance_trend: 'stable'
    }

    addSupplier(newSupplier)
    setSupplierModal({ isOpen: false, mode: 'add' })
    onSupplierChange?.(newSupplier.id)
  }

  if (compact) {
    return (
      <div className={cn("grid grid-cols-3 gap-2", className)}>
        {/* Categoría compacta */}
        <div className="space-y-1">
          <Label className="text-xs">Categoría</Label>
          <Select value={selectedCategory} onValueChange={(value) => onCategoryChange?.(value)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Marca compacta */}
        <div className="space-y-1">
          <Label className="text-xs">Marca</Label>
          <Select value={selectedBrand} onValueChange={onBrandChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {brandOptions.map((brand) => (
                <SelectItem key={brand.value} value={brand.value}>
                  {brand.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Proveedor compacto */}
        <div className="space-y-1">
          <Label className="text-xs">Proveedor</Label>
          <Select value={selectedSupplier} onValueChange={onSupplierChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {supplierOptions.map((supplier) => (
                <SelectItem key={supplier.value} value={supplier.value}>
                  {supplier.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Selector de Categoría */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Package className="w-4 h-4" />
          Categoría
        </Label>
        <div className="flex gap-2">
          <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={categoryOpen}
                className="flex-1 justify-between"
              >
                {selectedCategoryName || "Seleccionar categoría..."}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Buscar categoría..." />
                <CommandEmpty>No se encontraron categorías.</CommandEmpty>
                <CommandGroup>
                  {categoryOptions.map((category) => (
                    <CommandItem
                      key={category.value}
                      value={category.value}
                      onSelect={(value) => {
                        onCategoryChange?.(value)
                        setCategoryOpen(false)
                      }}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{category.label}</span>
                        {category.subcategories.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {category.subcategories.length} subcategorías
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          
          {showQuickAdd && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCategoryModal({ isOpen: true, mode: 'add' })}
              title="Agregar nueva categoría"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Subcategoría */}
        {selectedCategory && availableSubcategories.length > 0 && (
          <div className="ml-6 space-y-2">
            <Label className="text-sm text-muted-foreground">Subcategoría</Label>
            <Select value={selectedSubcategory} onValueChange={(value) => onCategoryChange?.(selectedCategory, value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar subcategoría..." />
              </SelectTrigger>
              <SelectContent>
                {availableSubcategories.map((subcategory) => (
                  <SelectItem key={subcategory} value={subcategory}>
                    {subcategory}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Separator />

      {/* Selector de Marca */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Marca
        </Label>
        <div className="flex gap-2">
          <Popover open={brandOpen} onOpenChange={setBrandOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={brandOpen}
                className="flex-1 justify-between"
              >
                {selectedBrandName || "Seleccionar marca..."}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Buscar marca..." />
                <CommandEmpty>No se encontraron marcas.</CommandEmpty>
                <CommandGroup>
                  {brandOptions.map((brand) => (
                    <CommandItem
                      key={brand.value}
                      value={brand.value}
                      onSelect={(value) => {
                        onBrandChange?.(value)
                        setBrandOpen(false)
                      }}
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{brand.label}</span>
                        {brand.country && (
                          <span className="text-xs text-muted-foreground">
                            📍 {brand.country}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          
          {showQuickAdd && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setBrandModal({ isOpen: true, mode: 'add' })}
              title="Agregar nueva marca"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Selector de Proveedor */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4" />
          Proveedor
        </Label>
        <div className="flex gap-2">
          <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={supplierOpen}
                className="flex-1 justify-between"
              >
                {selectedSupplierName || "Seleccionar proveedor..."}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Buscar proveedor..." />
                <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                <CommandGroup>
                  {supplierOptions.map((supplier) => (
                    <CommandItem
                      key={supplier.value}
                      value={supplier.value}
                      onSelect={(value) => {
                        onSupplierChange?.(value)
                        setSupplierOpen(false)
                      }}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{supplier.label}</span>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>🏢 {supplier.category}</span>
                          <span>📧 {supplier.email}</span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          
          {showQuickAdd && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSupplierModal({ isOpen: true, mode: 'add' })}
              title="Agregar nuevo proveedor"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Resumen de selección */}
      {(selectedCategory || selectedBrand || selectedSupplier) && (
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <Label className="text-sm font-medium">Selección actual:</Label>
          <div className="flex flex-wrap gap-2">
            {selectedCategoryName && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                {selectedCategoryName}
                {selectedSubcategory && ` > ${selectedSubcategory}`}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-red-500" 
                  onClick={() => onCategoryChange?.('')}
                />
              </Badge>
            )}
            {selectedBrandName && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {selectedBrandName}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-red-500" 
                  onClick={() => onBrandChange?.('')}
                />
              </Badge>
            )}
            {selectedSupplierName && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {selectedSupplierName}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-red-500" 
                  onClick={() => onSupplierChange?.('')}
                />
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      <CategoryModal
        isOpen={categoryModal.isOpen}
        onClose={() => setCategoryModal({ isOpen: false, mode: 'add' })}
        mode={categoryModal.mode}
        onSave={handleCategorySave}
        existingCategories={categories}
      />

      <BrandModal
        isOpen={brandModal.isOpen}
        onClose={() => setBrandModal({ isOpen: false, mode: 'add' })}
        mode={brandModal.mode}
        onSave={handleBrandSave}
        existingBrands={brands}
      />

      <SupplierModal
        isOpen={supplierModal.isOpen}
        onClose={() => setSupplierModal({ isOpen: false, mode: 'add' })}
        mode={supplierModal.mode}
        onSave={handleSupplierSave}
      />
    </div>
  )
}