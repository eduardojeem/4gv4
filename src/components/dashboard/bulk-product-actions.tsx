'use client'

import { useState } from 'react'
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Download, 
  Upload, 
  Tag, 
  Package, 
  Star,
  Copy,
  Archive,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  price: number
  stock: number
  status: 'active' | 'inactive' | 'archived'
  featured: boolean
}

interface BulkProductActionsProps {
  selectedProducts: Product[]
  onProductsUpdate: (products: Product[]) => void
  onSelectionClear: () => void
  categories: string[]
}

export function BulkProductActions({ 
  selectedProducts, 
  onProductsUpdate, 
  onSelectionClear,
  categories 
}: BulkProductActionsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBulkEditDialogOpen, setIsBulkEditDialogOpen] = useState(false)
  const [isPriceUpdateDialogOpen, setIsPriceUpdateDialogOpen] = useState(false)
  const [isStockUpdateDialogOpen, setIsStockUpdateDialogOpen] = useState(false)
  const [isCategoryUpdateDialogOpen, setIsCategoryUpdateDialogOpen] = useState(false)

  // Estados para edición masiva
  const [bulkEditData, setBulkEditData] = useState({
    category: '',
    priceAdjustment: '',
    priceAdjustmentType: 'percentage', // 'percentage' | 'fixed'
    stockAdjustment: '',
    stockAdjustmentType: 'add', // 'add' | 'subtract' | 'set'
    status: '',
    featured: null as boolean | null
  })

  const handleBulkDelete = () => {
    // Simular eliminación
    toast.success(`${selectedProducts.length} productos eliminados correctamente`)
    onSelectionClear()
    setIsDeleteDialogOpen(false)
  }

  const handleBulkEdit = () => {
    const updatedProducts = selectedProducts.map(product => {
      const updatedProduct = { ...product }

      // Actualizar categoría
      if (bulkEditData.category) {
        updatedProduct.category = bulkEditData.category
      }

      // Actualizar precio
      if (bulkEditData.priceAdjustment) {
        const adjustment = parseFloat(bulkEditData.priceAdjustment)
        if (bulkEditData.priceAdjustmentType === 'percentage') {
          updatedProduct.price = product.price * (1 + adjustment / 100)
        } else {
          updatedProduct.price = product.price + adjustment
        }
      }

      // Actualizar stock
      if (bulkEditData.stockAdjustment) {
        const adjustment = parseInt(bulkEditData.stockAdjustment)
        if (bulkEditData.stockAdjustmentType === 'add') {
          updatedProduct.stock = product.stock + adjustment
        } else if (bulkEditData.stockAdjustmentType === 'subtract') {
          updatedProduct.stock = Math.max(0, product.stock - adjustment)
        } else {
          updatedProduct.stock = adjustment
        }
      }

      // Actualizar estado
      if (bulkEditData.status) {
        updatedProduct.status = bulkEditData.status as 'active' | 'inactive' | 'archived'
      }

      // Actualizar destacado
      if (bulkEditData.featured !== null) {
        updatedProduct.featured = bulkEditData.featured
      }

      return updatedProduct
    })

    onProductsUpdate(updatedProducts)
    toast.success(`${selectedProducts.length} productos actualizados correctamente`)
    setIsBulkEditDialogOpen(false)
    onSelectionClear()
  }

  const handleExportSelected = () => {
    // Simular exportación
    const csvContent = selectedProducts.map(product => 
      `${product.sku},${product.name},${product.category},${product.price},${product.stock}`
    ).join('\n')
    
    const blob = new Blob([`SKU,Nombre,Categoría,Precio,Stock\n${csvContent}`], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `productos_seleccionados_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    
    toast.success(`${selectedProducts.length} productos exportados correctamente`)
  }

  const handleDuplicateProducts = () => {
    const duplicatedProducts = selectedProducts.map(product => ({
      ...product,
      id: `${product.id}_copy`,
      sku: `${product.sku}_COPY`,
      name: `${product.name} (Copia)`
    }))

    onProductsUpdate(duplicatedProducts)
    toast.success(`${selectedProducts.length} productos duplicados correctamente`)
    onSelectionClear()
  }

  const handleToggleStatus = (status: 'active' | 'inactive' | 'archived') => {
    const updatedProducts = selectedProducts.map(product => ({
      ...product,
      status
    }))

    onProductsUpdate(updatedProducts)
    toast.success(`${selectedProducts.length} productos marcados como ${status}`)
    onSelectionClear()
  }

  const handleToggleFeatured = (featured: boolean) => {
    const updatedProducts = selectedProducts.map(product => ({
      ...product,
      featured
    }))

    onProductsUpdate(updatedProducts)
    toast.success(`${selectedProducts.length} productos ${featured ? 'marcados como destacados' : 'removidos de destacados'}`)
    onSelectionClear()
  }

  if (selectedProducts.length === 0) {
    return null
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg text-blue-900">
              {selectedProducts.length} producto{selectedProducts.length > 1 ? 's' : ''} seleccionado{selectedProducts.length > 1 ? 's' : ''}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSelectionClear}
            className="text-blue-600 hover:text-blue-800"
          >
            Limpiar selección
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {/* Edición masiva */}
          <Dialog open={isBulkEditDialogOpen} onOpenChange={setIsBulkEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Editar en lote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar productos en lote</DialogTitle>
                <DialogDescription>
                  Aplicar cambios a {selectedProducts.length} productos seleccionados
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* Categoría */}
                <div className="space-y-2">
                  <Label>Cambiar categoría</Label>
                  <Select 
                    value={bulkEditData.category} 
                    onValueChange={(value) => setBulkEditData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar nueva categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ajuste de precios */}
                <div className="space-y-2">
                  <Label>Ajustar precios</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={bulkEditData.priceAdjustmentType} 
                      onValueChange={(value) => setBulkEditData(prev => ({ ...prev, priceAdjustmentType: value }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentaje</SelectItem>
                        <SelectItem value="fixed">Cantidad fija</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder={bulkEditData.priceAdjustmentType === 'percentage' ? '10' : '5.00'}
                      value={bulkEditData.priceAdjustment}
                      onChange={(e) => setBulkEditData(prev => ({ ...prev, priceAdjustment: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Ajuste de stock */}
                <div className="space-y-2">
                  <Label>Ajustar stock</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={bulkEditData.stockAdjustmentType} 
                      onValueChange={(value) => setBulkEditData(prev => ({ ...prev, stockAdjustmentType: value }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="add">Sumar</SelectItem>
                        <SelectItem value="subtract">Restar</SelectItem>
                        <SelectItem value="set">Establecer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="10"
                      value={bulkEditData.stockAdjustment}
                      onChange={(e) => setBulkEditData(prev => ({ ...prev, stockAdjustment: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Estado */}
                <div className="space-y-2">
                  <Label>Cambiar estado</Label>
                  <Select 
                    value={bulkEditData.status} 
                    onValueChange={(value) => setBulkEditData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                      <SelectItem value="archived">Archivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Destacado */}
                <div className="space-y-2">
                  <Label>Productos destacados</Label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="featured-true"
                        checked={bulkEditData.featured === true}
                        onCheckedChange={(checked) => 
                          setBulkEditData(prev => ({ ...prev, featured: checked ? true : null }))
                        }
                      />
                      <Label htmlFor="featured-true">Marcar como destacados</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="featured-false"
                        checked={bulkEditData.featured === false}
                        onCheckedChange={(checked) => 
                          setBulkEditData(prev => ({ ...prev, featured: checked ? false : null }))
                        }
                      />
                      <Label htmlFor="featured-false">Quitar de destacados</Label>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBulkEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleBulkEdit}>
                  Aplicar cambios
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Exportar */}
          <Button variant="outline" size="sm" onClick={handleExportSelected}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>

          {/* Duplicar */}
          <Button variant="outline" size="sm" onClick={handleDuplicateProducts}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicar
          </Button>

          {/* Acciones de estado */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Estado
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggleStatus('active')}>
                <Eye className="h-4 w-4 mr-2" />
                Activar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleStatus('inactive')}>
                <EyeOff className="h-4 w-4 mr-2" />
                Desactivar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleStatus('archived')}>
                <Archive className="h-4 w-4 mr-2" />
                Archivar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Destacados */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Star className="h-4 w-4 mr-2" />
                Destacados
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Productos destacados</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggleFeatured(true)}>
                <Star className="h-4 w-4 mr-2" />
                Marcar como destacados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleFeatured(false)}>
                <Star className="h-4 w-4 mr-2 opacity-50" />
                Quitar de destacados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Eliminar */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-800">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Confirmar eliminación
                </DialogTitle>
                <DialogDescription>
                  ¿Estás seguro de que deseas eliminar {selectedProducts.length} producto{selectedProducts.length > 1 ? 's' : ''}? 
                  Esta acción no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <h4 className="font-medium text-red-800 mb-2">Productos a eliminar:</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedProducts.slice(0, 5).map((product) => (
                      <div key={product.id} className="text-sm text-red-700">
                        • {product.name} ({product.sku})
                      </div>
                    ))}
                    {selectedProducts.length > 5 && (
                      <div className="text-sm text-red-600 font-medium">
                        ... y {selectedProducts.length - 5} más
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleBulkDelete}>
                  Eliminar productos
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}

export default BulkProductActions
