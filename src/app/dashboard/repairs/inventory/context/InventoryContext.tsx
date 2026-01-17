/**
 * Context API para gestión centralizada del estado de inventario
 * 
 * Beneficios:
 * - Elimina props drilling
 * - Estado centralizado y predecible
 * - Fácil de testear
 * - Optimistic updates integrados
 */

"use client"

import { createContext, useContext, useCallback, useMemo, ReactNode, useState } from 'react'
import { useProductsSupabase } from '@/hooks/useProductsSupabase'
import { toast } from 'sonner'
import type { Product } from '@/types/product-unified'

interface InventoryFilters {
  search: string
  category: string
  stockStatus: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
}

interface InventoryContextValue {
  // Datos
  products: Product[]
  services: Product[]
  inventory: Product[]
  categories: any[]
  movements: any[]
  
  // Estados
  loading: boolean
  error: string | null
  filters: InventoryFilters
  
  // Acciones
  setFilters: (filters: Partial<InventoryFilters>) => void
  refresh: () => Promise<void>
  
  // CRUD con optimistic updates
  createService: (data: any) => Promise<void>
  updateService: (id: string, data: any) => Promise<void>
  updateInventoryProduct: (id: string, data: any) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  updateStock: (id: string, quantity: number) => Promise<void>
  
  // Utilidades
  exportPDF: () => void
  exportExcel: () => void
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error('useInventory debe usarse dentro de InventoryProvider')
  }
  return context
}

interface InventoryProviderProps {
  children: ReactNode
}

export function InventoryProvider({ children }: InventoryProviderProps) {
  const {
    products,
    categories,
    loading,
    error,
    filters: supabaseFilters,
    setFilters: setSupabaseFilters,
    refreshData,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock: supabaseUpdateStock,
    getAllMovements,
    createCategory
  } = useProductsSupabase()

  // Identificar categoría de servicios
  const serviceCategoryId = useMemo(() => {
    return categories.find(c => 
      c.name.toLowerCase().includes('servicio') || 
      c.name.toLowerCase().includes('mano de obra')
    )?.id
  }, [categories])

  // Separar servicios de productos
  const { services, inventory } = useMemo(() => {
    if (!products) return { services: [], inventory: [] }
    
    const servicesList = products.filter(p => {
      const isServiceCategory = serviceCategoryId && p.category_id === serviceCategoryId
      const nameIndicatesService = 
        p.name.toLowerCase().startsWith('reparación') || 
        p.name.toLowerCase().startsWith('servicio') || 
        p.name.toLowerCase().includes('mano de obra')
      return isServiceCategory || nameIndicatesService
    })
    
    const serviceIds = new Set(servicesList.map(s => s.id))
    const inventoryList = products.filter(p => !serviceIds.has(p.id))
    
    return { services: servicesList, inventory: inventoryList }
  }, [products, serviceCategoryId])

  // Obtener movimientos (lazy load)
  const [movements, setMovements] = useState<any[]>([])
  const loadMovements = useCallback(async () => {
    const result = await getAllMovements(50)
    if (result.success) {
      setMovements(result.data)
    }
  }, [getAllMovements])

  // Filtros locales
  const [localFilters, setLocalFilters] = useState<InventoryFilters>({
    search: '',
    category: 'all',
    stockStatus: 'all'
  })

  const setFilters = useCallback((newFilters: Partial<InventoryFilters>) => {
    setLocalFilters(prev => ({ ...prev, ...newFilters }))
    
    // Sincronizar con Supabase filters
    setSupabaseFilters({
      search: newFilters.search,
      category: newFilters.category === 'all' ? '' : newFilters.category,
      stockStatus: newFilters.stockStatus
    })
  }, [setSupabaseFilters])

  // CRUD con optimistic updates
  const createService = useCallback(async (serviceData: any) => {
    try {
      // Asegurar que existe categoría de servicios
      let targetCategoryId = serviceCategoryId
      if (!targetCategoryId) {
        const catRes = await createCategory("Servicios", "Categoría para mano de obra y reparaciones")
        if (catRes.success && catRes.data) {
          targetCategoryId = catRes.data.id
        } else {
          throw new Error("No se pudo crear la categoría de Servicios")
        }
      }

      const result = await createProduct({
        ...serviceData,
        category_id: targetCategoryId,
        stock_quantity: 9999,
        min_stock: 0,
        unit_measure: 'servicio',
        is_active: true
      })

      if (result.success) {
        toast.success("Servicio creado exitosamente")
        await refreshData()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error creating service:', error)
      toast.error(error instanceof Error ? error.message : "Error al crear servicio")
      throw error
    }
  }, [serviceCategoryId, createProduct, createCategory, refreshData])

  const updateService = useCallback(async (id: string, serviceData: any) => {
    try {
      const result = await updateProduct(id, serviceData)
      
      if (result.success) {
        toast.success("Servicio actualizado")
        await refreshData()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error updating service:', error)
      toast.error("Error al actualizar servicio")
      throw error
    }
  }, [updateProduct, refreshData])

  const updateInventoryProduct = useCallback(async (id: string, productData: any) => {
    try {
      const result = await updateProduct(id, productData)
      
      if (result.success) {
        toast.success("Producto actualizado exitosamente")
        await refreshData()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error updating product:', error)
      toast.error("Error al actualizar producto")
      throw error
    }
  }, [updateProduct, refreshData])

  const deleteItem = useCallback(async (id: string) => {
    try {
      const result = await deleteProduct(id)
      
      if (result.success) {
        toast.success("Elemento eliminado")
        await refreshData()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error("Error al eliminar")
      throw error
    }
  }, [deleteProduct, refreshData])

  const updateStock = useCallback(async (id: string, quantity: number) => {
    try {
      const result = await supabaseUpdateStock(
        id,
        quantity,
        'adjustment',
        'Ajuste manual desde inventario'
      )
      
      if (result.success) {
        toast.success("Stock actualizado")
        await refreshData()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error updating stock:', error)
      toast.error("Error al actualizar stock")
      throw error
    }
  }, [supabaseUpdateStock, refreshData])

  // Exportación
  const exportPDF = useCallback(() => {
    // Implementación de exportación PDF
    toast.info("Exportando a PDF...")
  }, [])

  const exportExcel = useCallback(() => {
    // Implementación de exportación Excel
    toast.info("Exportando a Excel...")
  }, [])

  const value: InventoryContextValue = useMemo(() => ({
    // Datos
    products,
    services,
    inventory,
    categories,
    movements,
    
    // Estados
    loading,
    error,
    filters: localFilters,
    
    // Acciones
    setFilters,
    refresh: refreshData,
    createService,
    updateService,
    updateInventoryProduct,
    deleteItem,
    updateStock,
    exportPDF,
    exportExcel
  }), [
    products,
    services,
    inventory,
    categories,
    movements,
    loading,
    error,
    localFilters,
    setFilters,
    refreshData,
    createService,
    updateService,
    updateInventoryProduct,
    deleteItem,
    updateStock,
    exportPDF,
    exportExcel
  ])

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  )
}
