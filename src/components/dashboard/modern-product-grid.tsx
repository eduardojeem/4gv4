"use client"

import { memo } from 'react'
import { motion, AnimatePresence  } from '../ui/motion'
import { 
  Eye, 
  Edit, 
  Trash2, 
  MoreVertical,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'

interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  category: string
  image?: string
}

interface ModernProductGridProps {
  products: Product[]
  selectedProducts: string[]
  onSelectionChange: (selected: string[]) => void
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
  onView: (product: Product) => void
}

import { formatCurrency } from '@/lib/currency'
import { resolveProductImageUrl } from '@/lib/images'
import Image from 'next/image'

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

const ProductCard = memo(({ 
  product, 
  index,
  isSelected, 
  onSelect, 
  onEdit, 
  onDelete, 
  onView 
}: {
  product: Product
  index: number
  isSelected: boolean
  onSelect: (checked: boolean) => void
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
  onView: (product: Product) => void
}) => {
  const stockStatus = getStockStatus(product.stock)
  const StatusIcon = stockStatus.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      whileHover={{ 
        y: -8,
        scale: 1.02,
        transition: { duration: 0.3, ease: "easeOut" }
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ 
        duration: 0.4,
        delay: index * 0.1,
        ease: "easeOut",
        layout: { duration: 0.3 }
      }}
      className="group"
    >
      <Card className={`
        relative overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300
        ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''}
        bg-white/80 backdrop-blur-sm
      `}>
        <CardContent className="p-0">
          {/* Header con checkbox y menú */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="bg-white/90 border-gray-300 shadow-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onView(product)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(product)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(product.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Imagen del producto */}
          <div className="relative h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            {product.image ? (
              <Image 
                src={resolveProductImageUrl(product.image)} 
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
              />
            ) : (
              <Package className="h-16 w-16 text-slate-400" />
            )}
            
            {/* Badge de estado de stock */}
            <div className={`absolute top-3 right-3 ${stockStatus.bgColor} rounded-full p-2`}>
              <StatusIcon className={`h-4 w-4 ${stockStatus.textColor}`} />
            </div>
          </div>

          {/* Contenido */}
          <div className="p-6 space-y-4">
            {/* Información básica */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg line-clamp-2 text-slate-900">
                {product.name}
              </h3>
              <p className="text-sm text-slate-500 font-mono">
                SKU: {product.sku}
              </p>
            </div>

            {/* Precio y categoría */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(product.price)}
                </p>
                <p className="text-sm text-slate-500">
                  {product.category}
                </p>
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
                <span className="text-slate-600">Stock disponible</span>
                <span className="font-semibold text-slate-900">
                  {product.stock} unidades
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

            {/* Acciones rápidas */}
            <div className="flex gap-2 pt-2">
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
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
})

ProductCard.displayName = 'ProductCard'

export const ModernProductGrid = memo(({ 
  products,
  selectedProducts,
  onSelectionChange,
  onEdit,
  onDelete,
  onView
}: ModernProductGridProps) => {
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header con selección masiva */}
      {products.length > 0 && (
        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white/50 rounded-lg border border-slate-200">
          <Checkbox
            checked={selectedProducts.length === products.length}
            onCheckedChange={handleSelectAll}
            className="border-slate-400 h-4 w-4 sm:h-5 sm:w-5"
          />
          <span className="text-xs sm:text-sm text-slate-600">
            {selectedProducts.length > 0 
              ? `${selectedProducts.length} de ${products.length} productos seleccionados`
              : `Seleccionar todos (${products.length} productos)`
            }
          </span>
        </div>
      )}

      {/* Grid de productos */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
        <AnimatePresence mode="popLayout">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              isSelected={selectedProducts.includes(product.id)}
              onSelect={(checked) => handleSelectProduct(product.id, checked)}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Estado vacío */}
      {products.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8 sm:py-16"
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border p-6 sm:p-12 max-w-md mx-auto">
            <Package className="h-12 w-12 sm:h-16 sm:w-16 text-slate-400 mx-auto mb-4 sm:mb-6" />
            <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-slate-900">
              No hay productos para mostrar
            </h3>
            <p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6">
              Los productos que coincidan con tus filtros aparecerán aquí
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
})

ModernProductGrid.displayName = 'ModernProductGrid'
