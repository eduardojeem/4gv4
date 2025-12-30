'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Package, Tag, Users, Barcode, Clock, TrendingUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  supplier: string
  description?: string
  barcode?: string
  sale_price: number
  stock_quantity: number
}

interface SmartSearchProps {
  products: Product[]
  onProductSelect?: (product: Product) => void
  onSearchChange?: (query: string) => void
  placeholder?: string
  className?: string
}

interface SearchSuggestion {
  type: 'product' | 'category' | 'supplier' | 'sku' | 'recent'
  value: string
  label: string
  icon: React.ReactNode
  data?: any
}

export function SmartSearch({ 
  products, 
  onProductSelect, 
  onSearchChange,
  placeholder = "Buscar productos, SKU, categorías...",
  className 
}: SmartSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Cargar búsquedas recientes del localStorage
  useEffect(() => {
    const saved = localStorage.getItem('product-search-recent')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (error) {
        console.log('Error loading recent searches')
      }
    }
  }, [])

  // Generar sugerencias basadas en la consulta
  const suggestions = useMemo(() => {
    if (!query.trim()) {
      // Mostrar búsquedas recientes cuando no hay consulta
      return recentSearches.slice(0, 5).map(search => ({
        type: 'recent' as const,
        value: search,
        label: search,
        icon: <Clock className="h-4 w-4" />,
        data: undefined
      }))
    }

    const queryLower = query.toLowerCase()
    const results: SearchSuggestion[] = []

    // Productos que coinciden
    const matchingProducts = products
      .filter(product => 
        product.name.toLowerCase().includes(queryLower) ||
        product.sku.toLowerCase().includes(queryLower) ||
        product.description?.toLowerCase().includes(queryLower) ||
        product.barcode?.toLowerCase().includes(queryLower)
      )
      .slice(0, 8)
      .map(product => ({
        type: 'product' as const,
        value: product.name,
        label: `${product.name} (${product.sku})`,
        icon: <Package className="h-4 w-4" />,
        data: product
      }))

    // Categorías que coinciden
    const matchingCategories = [...new Set(products.map(p => p.category))]
      .filter(category => category.toLowerCase().includes(queryLower))
      .slice(0, 3)
      .map(category => ({
        type: 'category' as const,
        value: category,
        label: `Categoría: ${category}`,
        icon: <Tag className="h-4 w-4" />
      }))

    // Proveedores que coinciden
    const matchingSuppliers = [...new Set(products.map(p => p.supplier))]
      .filter(supplier => supplier.toLowerCase().includes(queryLower))
      .slice(0, 3)
      .map(supplier => ({
        type: 'supplier' as const,
        value: supplier,
        label: `Proveedor: ${supplier}`,
        icon: <Users className="h-4 w-4" />
      }))

    // SKUs que coinciden exactamente
    const matchingSKUs = products
      .filter(product => product.sku.toLowerCase().startsWith(queryLower))
      .slice(0, 3)
      .map(product => ({
        type: 'sku' as const,
        value: product.sku,
        label: `SKU: ${product.sku} - ${product.name}`,
        icon: <Barcode className="h-4 w-4" />,
        data: product
      }))

    // Combinar resultados con prioridad
    results.push(...matchingSKUs)
    results.push(...matchingProducts)
    
    if (matchingCategories.length > 0) {
      results.push(...matchingCategories)
    }
    
    if (matchingSuppliers.length > 0) {
      results.push(...matchingSuppliers)
    }

    return results.slice(0, 10)
  }, [query, products, recentSearches])

  // Manejar cambios en la búsqueda
  const handleSearchChange = (value: string) => {
    setQuery(value)
    setSelectedIndex(-1)
    setIsOpen(true)
    onSearchChange?.(value)
  }

  // Manejar selección de sugerencia
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    if (suggestion.type === 'product' || suggestion.type === 'sku') {
      if (suggestion.data && onProductSelect) {
        onProductSelect(suggestion.data)
      }
    }
    
    setQuery(suggestion.value)
    setIsOpen(false)
    setSelectedIndex(-1)
    
    // Agregar a búsquedas recientes
    addToRecentSearches(suggestion.value)
    
    onSearchChange?.(suggestion.value)
  }

  // Agregar a búsquedas recientes
  const addToRecentSearches = (search: string) => {
    if (!search.trim()) return
    
    const updated = [search, ...recentSearches.filter(s => s !== search)].slice(0, 10)
    setRecentSearches(updated)
    localStorage.setItem('product-search-recent', JSON.stringify(updated))
  }

  // Limpiar búsqueda
  const clearSearch = () => {
    setQuery('')
    setIsOpen(false)
    setSelectedIndex(-1)
    onSearchChange?.('')
  }

  // Manejar navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionSelect(suggestions[selectedIndex])
        } else if (query.trim()) {
          addToRecentSearches(query)
          setIsOpen(false)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll automático para el elemento seleccionado
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        })
      }
    }
  }, [selectedIndex])

  const removeRecentSearch = (searchToRemove: string) => {
    const updated = recentSearches.filter(s => s !== searchToRemove)
    setRecentSearches(updated)
    localStorage.setItem('product-search-recent', JSON.stringify(updated))
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dropdown de sugerencias */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg border">
          <CardContent className="p-0">
            {suggestions.length > 0 ? (
              <div ref={listRef} className="max-h-80 overflow-y-auto">
                {!query.trim() && recentSearches.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-sm font-medium text-muted-foreground bg-muted/50">
                      Búsquedas recientes
                    </div>
                    <Separator />
                  </>
                )}
                
                {suggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.type}-${suggestion.value}-${index}`}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors",
                      selectedIndex === index && "bg-muted"
                    )}
                    onClick={() => handleSuggestionSelect(suggestion)}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="text-muted-foreground flex-shrink-0">
                        {suggestion.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {suggestion.label}
                        </div>
                        {suggestion.data && 'stock_quantity' in suggestion.data && (
                          <div className="text-xs text-muted-foreground">
                            Stock: {suggestion.data.stock_quantity} | €{suggestion.data.sale_price}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {suggestion.type === 'recent' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeRecentSearch(suggestion.value)
                          }}
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                      
                      {suggestion.type === 'product' && suggestion.data && (
                        <Badge 
                          variant={suggestion.data.stock_quantity > 0 ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {suggestion.data.stock_quantity > 0 ? 'En Stock' : 'Agotado'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="px-3 py-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No se encontraron resultados para "{query}"</p>
                <p className="text-xs mt-1">Intenta con otros términos de búsqueda</p>
              </div>
            ) : (
              <div className="px-3 py-8 text-center text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Comienza a escribir para buscar productos</p>
                <p className="text-xs mt-1">Puedes buscar por nombre, SKU, categoría o proveedor</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}export default SmartSearch
