"use client"

import { memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ModernProductGrid } from "./modern-product-grid"
import { VirtualizedProductGrid } from "./virtualized-product-grid"
import { 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  Package
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  category: string
  image?: string
}

interface ModernProductTableProps {
  products: Product[]
  viewMode: "grid" | "table"
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
    variant: "destructive" as const
  }
  if (stock < 10) return { 
    label: "Stock bajo", 
    variant: "secondary" as const
  }
  return { 
    label: "En stock", 
    variant: "default" as const
  }
}

const getStockColor = (stock: number) => {
  if (stock === 0) return "bg-red-500"
  if (stock < 10) return "bg-orange-500"
  return "bg-green-500"
}

export const ModernProductTable = memo(({ 
  products,
  viewMode,
  selectedProducts,
  onSelectionChange,
  onEdit,
  onDelete,
  onView
}: ModernProductTableProps) => {
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

  if (viewMode === "grid") {
    // Usar grid virtualizado para listas grandes (más de 50 productos)
    if (products.length > 50) {
      return (
        <VirtualizedProductGrid
          products={products}
          selectedProducts={selectedProducts}
          onSelectionChange={onSelectionChange}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          containerHeight={600}
          itemHeight={320}
        />
      )
    }
    
    return (
      <ModernProductGrid
        products={products}
        selectedProducts={selectedProducts}
        onSelectionChange={onSelectionChange}
        onEdit={onEdit}
        onDelete={onDelete}
        onView={onView}
      />
    )
  }

  return (
    <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
      <CardContent className="p-0">
        <div className="overflow-hidden">
          {/* Header de la tabla */}
          <div className="border-b border-slate-200 bg-slate-50/50 px-4 md:px-6 py-4">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectedProducts.length === products.length && products.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium text-slate-700">
                {selectedProducts.length > 0 
                  ? `${selectedProducts.length} seleccionados`
                  : `${products.length} productos`
                }
              </span>
              {selectedProducts.length > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="sm:hidden">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar seleccionados
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar seleccionados
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>

          {/* Mobile view */}
          <div className="block md:hidden">
            <div className="divide-y divide-slate-200">
              <AnimatePresence mode="popLayout">
                {products.map((product, index) => {
                  const stockStatus = getStockStatus(product.stock)
                  
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      whileHover={{ 
                        backgroundColor: "rgba(248, 250, 252, 0.5)",
                        scale: 1.02,
                        transition: { duration: 0.2 }
                      }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ 
                        delay: index * 0.05,
                        duration: 0.4,
                        ease: "easeOut"
                      }}
                      className="p-4 space-y-3 cursor-pointer rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                            className="mt-1"
                          />
                          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                            {product.image ? (
                              <Image src={resolveProductImageUrl(product.image)} alt={product.name} fill className="object-cover" sizes="48px" />
                            ) : (
                              <Package className="h-6 w-6 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-900 truncate">{product.name}</h3>
                            <p className="text-sm text-slate-500">SKU: {product.sku}</p>
                            <p className="text-sm text-slate-600">{product.category}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(product)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(product)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onDelete(product.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-xs text-slate-500">Stock</span>
                            <p className="font-medium text-slate-900">{product.stock}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">Precio</span>
                            <p className="font-medium text-slate-900">{formatCurrency(product.price)}</p>
                          </div>
                        </div>
                        <Badge variant={stockStatus.variant} className="text-xs">
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 hover:bg-transparent">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="font-semibold text-slate-700">Producto</TableHead>
                  <TableHead className="font-semibold text-slate-700 hidden lg:table-cell">SKU</TableHead>
                  <TableHead className="font-semibold text-slate-700 hidden xl:table-cell">Categoría</TableHead>
                  <TableHead className="font-semibold text-slate-700">Precio</TableHead>
                  <TableHead className="font-semibold text-slate-700">Stock</TableHead>
                  <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {products.map((product, index) => {
                    const stockStatus = getStockStatus(product.stock)
                    
                    return (
                      <motion.tr
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        whileHover={{ 
                          backgroundColor: "rgba(248, 250, 252, 0.8)",
                          scale: 1.01,
                          transition: { duration: 0.2 }
                        }}
                        transition={{ 
                          delay: index * 0.05,
                          duration: 0.4,
                          ease: "easeOut"
                        }}
                        className="border-slate-200 cursor-pointer"
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                              {product.image ? (
                                <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <Package className="h-5 w-5 text-slate-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{product.name}</p>
                              <p className="text-sm text-slate-500 truncate lg:hidden">SKU: {product.sku}</p>
                              <p className="text-sm text-slate-500 line-clamp-1 xl:hidden">{product.category}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                            {product.sku}
                          </code>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {product.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(product.price)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{product.stock}</span>
                            <div className="w-12 lg:w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${getStockColor(product.stock)}`}
                                style={{ width: `${Math.min((product.stock / 50) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={stockStatus.variant} className="text-xs">
                            {stockStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onView(product)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onEdit(product)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => onDelete(product.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

ModernProductTable.displayName = "ModernProductTable"
