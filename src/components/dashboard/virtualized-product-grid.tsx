"use client"

import { memo, useMemo } from "react"
import { motion } from "framer-motion"
import { useVirtualScroll } from "@/hooks/use-virtual-scroll"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Eye, 
  Edit, 
  Package,
  AlertTriangle,
  TrendingDown,
  CheckCircle,
  Trash2
} from "lucide-react"

interface ProductItem {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  category: string
  image?: string
}

interface VirtualizedProductGridProps {
  products: ProductItem[]
  selectedProducts: string[]
  onSelectionChange: (productIds: string[]) => void
  onEdit: (product: ProductItem) => void
  onDelete: (id: string) => void
  onView: (product: ProductItem) => void
  itemHeight?: number
  containerHeight?: number
}

import { formatCurrency } from '@/lib/currency'

const getStockStatus = (stock: number) => {
  if (stock === 0) return { 
    label: "Sin stock", 
    color: "destructive" as const, 
    icon: AlertTriangle,
    bgColor: "bg-red-50",
    textColor: "text-red-700"
  }
  if (stock < 10) return { 
    label: "Stock bajo", 
    color: "secondary" as const, 
    icon: TrendingDown,
    bgColor: "bg-orange-50",
    textColor: "text-orange-700"
  }
  return { 
    label: "En stock", 
    color: "default" as const, 
    icon: CheckCircle,
    bgColor: "bg-green-50",
    textColor: "text-green-700"
  }
}

const VirtualProductCard = memo(({ 
  product, 
  index,
  style,
  isSelected, 
  onSelect, 
  onEdit, 
  onDelete,
  onView 
}: {
  product: ProductItem
  index: number
  style: React.CSSProperties
  isSelected: boolean
  onSelect: (checked: boolean) => void
  onEdit: (product: ProductItem) => void
  onDelete: (id: string) => void
  onView: (product: ProductItem) => void
}) => {
  const stockStatus = getStockStatus(product.stock)
  const StatusIcon = stockStatus.icon

  return (
    <div style={style} className="p-2">
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ 
          duration: 0.2,
          delay: (index % 10) * 0.02
        }}
        whileHover={{ 
          scale: 1.02,
          transition: { duration: 0.15 }
        }}
        whileTap={{ scale: 0.98 }}
        className="h-full"
      >
        <Card className="h-full bg-white/80 backdrop-blur-sm border-slate-200/60 hover:border-slate-300/80 hover:shadow-lg transition-all duration-200">
          <CardContent className="p-4 h-full flex flex-col">
            {/* Header con checkbox y estado */}
            <div className="flex items-start justify-between mb-3">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="mt-1"
              />
              <div className={`p-2 rounded-lg ${stockStatus.bgColor}`}>
                <StatusIcon className={`h-4 w-4 ${stockStatus.textColor}`} />
              </div>
            </div>

            {/* Información del producto */}
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 mb-1">
                  {product.name}
                </h3>
                <p className="text-xs text-slate-600 line-clamp-1">
                  {product.category}
                </p>
              </div>

              {/* Precio */}
              <div className="space-y-1">
                <div className="text-lg font-bold text-slate-900">
                  {formatCurrency(product.price)}
                </div>
                <Badge 
                  variant={stockStatus.color}
                  className="text-xs font-medium"
                >
                  {stockStatus.label}
                </Badge>
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Stock</span>
                  <span className="font-semibold text-slate-900">
                    {product.stock}
                  </span>
                </div>
                
                {/* Barra de progreso del stock */}
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      product.stock === 0 ? 'bg-red-500' :
                      product.stock < 10 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ 
                      width: `${Math.min((product.stock / 50) * 100, 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-2 pt-3 mt-auto">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onView(product)}
                className="flex-1 text-xs"
              >
                <Eye className="mr-1 h-3 w-3" />
                Ver
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onEdit(product)}
                className="flex-1 text-xs"
              >
                <Edit className="mr-1 h-3 w-3" />
                Editar
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onDelete(product.id)}
                className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Eliminar
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
})

VirtualProductCard.displayName = "VirtualProductCard"

export const VirtualizedProductGrid = memo(({
  products,
  selectedProducts,
  onSelectionChange,
  onEdit,
  onDelete,
  onView,
  itemHeight = 320,
  containerHeight = 600
}: VirtualizedProductGridProps) => {
  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedProducts, productId])
    } else {
      onSelectionChange(selectedProducts.filter(id => id !== productId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(products.map(p => p.id))
    } else {
      onSelectionChange([])
    }
  }

  const {
    virtualItems,
    totalHeight,
    scrollToIndex,
    containerProps,
    innerProps
  } = useVirtualScroll({
    itemHeight,
    containerHeight,
    items: products,
    overscan: 5
  })

  // Calcular items por fila basado en el ancho de pantalla
  const itemsPerRow = useMemo(() => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth
      if (width >= 1536) return 4 // 2xl
      if (width >= 1280) return 3 // xl
      if (width >= 1024) return 3 // lg
      if (width >= 768) return 2  // md
      return 1 // sm y menor
    }
    return 3 // default para SSR
  }, [])

  const gridItems = useMemo(() => {
    const rows = []
    for (let i = 0; i < virtualItems.length; i += itemsPerRow) {
      const rowItems = virtualItems.slice(i, i + itemsPerRow)
      rows.push({
        index: Math.floor(virtualItems[i]?.index / itemsPerRow) || 0,
        items: rowItems,
        start: virtualItems[i]?.start || 0
      })
    }
    return rows
  }, [virtualItems, itemsPerRow])

  if (products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border p-12 max-w-md mx-auto">
          <Package className="h-16 w-16 text-slate-400 mx-auto mb-6" />
          <h3 className="text-xl font-semibold mb-3 text-slate-900">
            No hay productos para mostrar
          </h3>
          <p className="text-base text-slate-600 mb-6">
            Los productos que coincidan con tus filtros aparecerán aquí
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con selección masiva */}
      <div className="flex items-center gap-3 p-4 bg-white/50 rounded-lg border border-slate-200">
        <Checkbox
          checked={
            selectedProducts.length === products.length 
              ? true 
              : selectedProducts.length > 0 
                ? 'indeterminate' 
                : false
          }
          onCheckedChange={handleSelectAll}
        />
        <span className="text-sm font-medium text-slate-700">
          {selectedProducts.length > 0 
            ? `${selectedProducts.length} de ${products.length} productos seleccionados`
            : `${products.length} productos`
          }
        </span>
      </div>

      {/* Grid virtualizado */}
      <div 
        {...containerProps}
        className="rounded-lg border border-slate-200 bg-white/30 backdrop-blur-sm"
      >
        <div {...innerProps}>
          {gridItems.map((row) => (
            <div
              key={row.index}
              style={{
                position: 'absolute',
                top: row.start,
                left: 0,
                right: 0,
                height: itemHeight,
                display: 'grid',
                gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
                gap: '1rem',
                padding: '1rem'
              }}
            >
              {row.items.map((virtualItem) => (
                <VirtualProductCard
                  key={virtualItem.item.id}
                  product={virtualItem.item}
                  index={virtualItem.index}
                  style={{}}
                  isSelected={selectedProducts.includes(virtualItem.item.id)}
                  onSelect={(checked) => handleSelectProduct(virtualItem.item.id, checked)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onView={onView}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

VirtualizedProductGrid.displayName = "VirtualizedProductGrid"
