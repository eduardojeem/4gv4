'use client'

import { useState, useEffect, useCallback } from 'react'
import { Category, Brand, DEFAULT_CATEGORIES, DEFAULT_BRANDS } from '@/lib/types/catalog'
import { Supplier } from '@/lib/types/supplier'

interface CatalogData {
  categories: Category[]
  brands: Brand[]
  suppliers: Supplier[]
}

interface CatalogSyncOptions {
  autoSave?: boolean
  storageKey?: string
  onDataChange?: (data: CatalogData) => void
}

const DEFAULT_STORAGE_KEY = 'catalog-data'

export function useCatalogSync(options: CatalogSyncOptions = {}) {
  const {
    autoSave = true,
    storageKey = DEFAULT_STORAGE_KEY,
    onDataChange
  } = options

  const [catalogData, setCatalogData] = useState<CatalogData>({
    categories: DEFAULT_CATEGORIES,
    brands: DEFAULT_BRANDS,
    suppliers: []
  })

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar datos del localStorage al inicializar
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(storageKey)
      if (savedData) {
        const parsedData = JSON.parse(savedData)
        setCatalogData({
          categories: parsedData.categories || DEFAULT_CATEGORIES,
          brands: parsedData.brands || DEFAULT_BRANDS,
          suppliers: parsedData.suppliers || []
        })
      }
    } catch (err) {
      console.error('Error loading catalog data:', err)
      setError('Error al cargar los datos del catálogo')
    } finally {
      setIsLoading(false)
    }
  }, [storageKey])

  // Guardar datos automáticamente cuando cambien
  useEffect(() => {
    if (!isLoading && autoSave) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(catalogData))
        onDataChange?.(catalogData)
      } catch (err) {
        console.error('Error saving catalog data:', err)
        setError('Error al guardar los datos del catálogo')
      }
    }
  }, [catalogData, autoSave, storageKey, isLoading, onDataChange])

  // Funciones para manejar categorías
  const addCategory = useCallback((category: Category) => {
    setCatalogData(prev => ({
      ...prev,
      categories: [...prev.categories, category]
    }))
  }, [])

  const updateCategory = useCallback((categoryId: string, updates: Partial<Category>) => {
    setCatalogData(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId ? { ...cat, ...updates } : cat
      )
    }))
  }, [])

  const deleteCategory = useCallback((categoryId: string) => {
    setCatalogData(prev => ({
      ...prev,
      categories: prev.categories.filter(cat => cat.id !== categoryId)
    }))
  }, [])

  // Funciones para manejar marcas
  const addBrand = useCallback((brand: Brand) => {
    setCatalogData(prev => ({
      ...prev,
      brands: [...prev.brands, brand]
    }))
  }, [])

  const updateBrand = useCallback((brandId: string, updates: Partial<Brand>) => {
    setCatalogData(prev => ({
      ...prev,
      brands: prev.brands.map(brand =>
        brand.id === brandId ? { ...brand, ...updates } : brand
      )
    }))
  }, [])

  const deleteBrand = useCallback((brandId: string) => {
    setCatalogData(prev => ({
      ...prev,
      brands: prev.brands.filter(brand => brand.id !== brandId)
    }))
  }, [])

  // Funciones para manejar proveedores
  const addSupplier = useCallback((supplier: Supplier) => {
    setCatalogData(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, supplier]
    }))
  }, [])

  const updateSupplier = useCallback((supplierId: string, updates: Partial<Supplier>) => {
    setCatalogData(prev => ({
      ...prev,
      suppliers: prev.suppliers.map(supplier =>
        supplier.id === supplierId ? { ...supplier, ...updates } : supplier
      )
    }))
  }, [])

  const deleteSupplier = useCallback((supplierId: string) => {
    setCatalogData(prev => ({
      ...prev,
      suppliers: prev.suppliers.filter(supplier => supplier.id !== supplierId)
    }))
  }, [])

  // Funciones de utilidad
  const getCategoryOptions = useCallback(() => {
    return catalogData.categories
      .filter(cat => cat.isActive)
      .map(cat => ({
        value: cat.id,
        label: cat.name,
        subcategories: cat.subcategories || []
      }))
  }, [catalogData.categories])

  const getBrandOptions = useCallback(() => {
    return catalogData.brands
      .filter(brand => brand.isActive)
      .map(brand => ({
        value: brand.id,
        label: brand.name,
        country: brand.country
      }))
  }, [catalogData.brands])

  const getSupplierOptions = useCallback(() => {
    return catalogData.suppliers
      .filter(supplier => supplier.status === 'active')
      .map(supplier => ({
        value: supplier.id,
        label: supplier.name,
        category: supplier.category,
        email: supplier.email
      }))
  }, [catalogData.suppliers])

  // Función para buscar elementos
  const searchItems = useCallback((query: string, type: 'categories' | 'brands' | 'suppliers') => {
    const searchTerm = query.toLowerCase()
    
    switch (type) {
      case 'categories':
        return catalogData.categories.filter(cat =>
          cat.name.toLowerCase().includes(searchTerm) ||
          cat.description.toLowerCase().includes(searchTerm) ||
          cat.subcategories?.some(sub => sub.toLowerCase().includes(searchTerm))
        )
      case 'brands':
        return catalogData.brands.filter(brand =>
          brand.name.toLowerCase().includes(searchTerm) ||
          brand.description.toLowerCase().includes(searchTerm) ||
          brand.country?.toLowerCase().includes(searchTerm)
        )
      case 'suppliers':
        return catalogData.suppliers.filter(supplier =>
          supplier.name.toLowerCase().includes(searchTerm) ||
          supplier.email.toLowerCase().includes(searchTerm) ||
          supplier.category.toLowerCase().includes(searchTerm)
        )
      default:
        return []
    }
  }, [catalogData])

  // Función para obtener estadísticas
  const getStats = useCallback(() => {
    return {
      categories: {
        total: catalogData.categories.length,
        active: catalogData.categories.filter(cat => cat.isActive).length,
        withProducts: catalogData.categories.filter(cat => cat.productCount > 0).length
      },
      brands: {
        total: catalogData.brands.length,
        active: catalogData.brands.filter(brand => brand.isActive).length,
        withProducts: catalogData.brands.filter(brand => brand.productCount > 0).length
      },
      suppliers: {
        total: catalogData.suppliers.length,
        active: catalogData.suppliers.filter(supplier => supplier.status === 'active').length,
        withOrders: catalogData.suppliers.filter(supplier => supplier.total_orders > 0).length
      }
    }
  }, [catalogData])

  // Función para exportar datos
  const exportData = useCallback(() => {
    const dataToExport = {
      ...catalogData,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `catalog-data-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [catalogData])

  // Función para importar datos
  const importData = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string)
          
          // Validar estructura de datos
          if (!importedData.categories || !importedData.brands || !importedData.suppliers) {
            throw new Error('Formato de archivo inválido')
          }
          
          setCatalogData({
            categories: importedData.categories,
            brands: importedData.brands,
            suppliers: importedData.suppliers
          })
          
          resolve()
        } catch (err) {
          reject(new Error('Error al procesar el archivo'))
        }
      }
      
      reader.onerror = () => reject(new Error('Error al leer el archivo'))
      reader.readAsText(file)
    })
  }, [])

  // Función para resetear datos
  const resetData = useCallback(() => {
    setCatalogData({
      categories: DEFAULT_CATEGORIES,
      brands: DEFAULT_BRANDS,
      suppliers: []
    })
  }, [])

  return {
    // Datos
    catalogData,
    categories: catalogData.categories,
    brands: catalogData.brands,
    suppliers: catalogData.suppliers,
    
    // Estado
    isLoading,
    error,
    
    // Funciones CRUD
    addCategory,
    updateCategory,
    deleteCategory,
    addBrand,
    updateBrand,
    deleteBrand,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    
    // Funciones de utilidad
    getCategoryOptions,
    getBrandOptions,
    getSupplierOptions,
    searchItems,
    getStats,
    
    // Funciones de importación/exportación
    exportData,
    importData,
    resetData,
    
    // Función para limpiar errores
    clearError: () => setError(null)
  }
}