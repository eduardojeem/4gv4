
"use client"
import { logger } from '@/lib/logger'

import { createContext, useContext, useCallback, useMemo, ReactNode, useState } from 'react'
import { useProductsSupabase } from '@/hooks/useProductsSupabase'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import type { Product, ProductMovement } from '@/types/product-unified'

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
  suppliers: any[]
  movements: ProductMovement[]

  // Estados
  loading: boolean
  movementsLoading: boolean
  error: string | null
  filters: InventoryFilters
  
  // Acciones
  setFilters: (filters: Partial<InventoryFilters>) => void
  refresh: () => Promise<void>
  loadMovements: () => Promise<void>
  
  // CRUD con optimistic updates
  createService: (data: any) => Promise<void>
  updateService: (id: string, data: any) => Promise<void>
  updateInventoryProduct: (id: string, data: any) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  updateStock: (id: string, quantity: number, reason?: string) => Promise<void>
  
  // Utilidades
  exportPDF: () => void
  exportExcel: () => void
  getProductMovements: (id: string) => Promise<{ success: boolean; data: ProductMovement[]; error?: string }>
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
    suppliers,
    loading,
    error,
    filters: supabaseFilters,
    setFilters: setSupabaseFilters,
    refreshData,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock: supabaseUpdateStock,
    getProductMovements,
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
    
    // Un ítem es "servicio" si está en la categoría Servicios o si su unidad de
    // medida es 'servicio' (lo setea createService). Evita clasificar por el
    // nombre, que antes ocultaba productos físicos como "Cambio de vidrio".
    const servicesList = products.filter(p => {
      const isServiceCategory = Boolean(serviceCategoryId && p.category_id === serviceCategoryId)
      const isServiceUnit = (p.unit_measure || '').toLowerCase() === 'servicio'
      return isServiceCategory || isServiceUnit
    })
    
    const serviceIds = new Set(servicesList.map(s => s.id))
    const inventoryList = products.filter(p => !serviceIds.has(p.id))
    
    return { services: servicesList, inventory: inventoryList }
  }, [products, serviceCategoryId])

  // Obtener movimientos (lazy load)
  const [movements, setMovements] = useState<ProductMovement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)
  const loadMovements = useCallback(async () => {
    setMovementsLoading(true)
    try {
      const result = await getAllMovements(50)
      if (result.success) {
        setMovements((result.data ?? []) as ProductMovement[])
      }
    } catch (error) {
      logger.error('Error loading movements', { error })
    } finally {
      setMovementsLoading(false)
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
      logger.error('Error creating service', { error })
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
      logger.error('Error updating service', { error })
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
      logger.error('Error updating product', { error })
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
      logger.error('Error deleting item', { error })
      toast.error("Error al eliminar")
      throw error
    }
  }, [deleteProduct, refreshData])

  const updateStock = useCallback(async (id: string, quantity: number, reason?: string) => {
    try {
      const result = await supabaseUpdateStock(
        id,
        quantity,
        'adjustment',
        reason || 'Ajuste manual desde inventario'
      )
      
      if (result.success) {
        toast.success("Stock actualizado")
        await refreshData()
      } else {
        const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error)
        throw new Error(errorMsg)
      }
    } catch (error: any) {
      logger.error('Error updating stock', { error })
      const message = error?.message || 'Error al actualizar stock'
      toast.error(message)
      throw error
    }
  }, [supabaseUpdateStock, refreshData])

  // Exportación
  const exportPDF = useCallback(async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF()

      doc.setFontSize(16)
      doc.text('Inventario y Servicios', 14, 16)
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(new Date().toLocaleString('es-PY'), 14, 22)
      doc.setTextColor(0)

      doc.setFontSize(12)
      doc.text(`Repuestos (${inventory.length})`, 14, 30)
      autoTable(doc, {
        startY: 34,
        head: [['Repuesto', 'SKU', 'Categoría', 'Stock', 'P. Compra', 'P. Venta']],
        body: inventory.map((p) => [
          p.name,
          p.sku || '-',
          p.category?.name || '-',
          String(p.stock_quantity ?? 0),
          formatPrice(p.purchase_price || 0),
          formatPrice(p.sale_price || 0),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
      })

      const servicesY = ((doc as any).lastAutoTable?.finalY ?? 34) + 10
      doc.setFontSize(12)
      doc.text(`Servicios (${services.length})`, 14, servicesY)
      autoTable(doc, {
        startY: servicesY + 4,
        head: [['Servicio', 'P. Cliente', 'P. Mayorista', 'Visibilidad']],
        body: services.map((s) => [
          s.name,
          formatPrice(s.sale_price || 0),
          s.wholesale_price ? formatPrice(s.wholesale_price) : '-',
          (s.visibility || 'public') === 'public'
            ? 'Público'
            : s.visibility === 'wholesale'
              ? 'Mayorista'
              : 'Oculto',
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
      })

      doc.save(`inventario_${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('PDF generado')
    } catch (error) {
      logger.error('Error exporting inventory PDF', { error })
      toast.error('No se pudo generar el PDF')
    }
  }, [inventory, services])

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
    suppliers,
    movements,
    
    // Estados
    loading,
    movementsLoading,
    error,
    filters: localFilters,

    // Acciones
    setFilters,
    refresh: refreshData,
    loadMovements,
    createService,
    updateService,
    updateInventoryProduct,
    deleteItem,
    updateStock,
    exportPDF,
    exportExcel,
    getProductMovements
  }), [
    products,
    services,
    inventory,
    categories,
    suppliers,
    movements,
    loading,
    movementsLoading,
    error,
    localFilters,
    setFilters,
    refreshData,
    loadMovements,
    createService,
    updateService,
    updateInventoryProduct,
    deleteItem,
    updateStock,
    exportPDF,
    exportExcel,
    getProductMovements
  ])

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  )
}
