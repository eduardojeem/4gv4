'use client'

import { useState } from 'react'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  Upload, 
  Download, 
  Copy, 
  Star,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  Check,
  X,
  Settings,
  Filter,
  RefreshCw,
  FileText,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { OptimizedButton, ConfirmationButton } from '@/components/ui/optimized-button'
import { useOptimizedNotifications } from '@/hooks/use-optimized-notifications'
import { useContextualNotifications, NotificationContext, ActionType } from '@/lib/contextual-notifications'
import type { Product } from '@/lib/types/product'

interface ProductActionsProps {
  products: Product[]
  selectedProducts?: string[]
  onAddProduct?: () => void
  onEditProduct?: (product: Product) => void
  onDeleteProduct?: (productId: string) => void
  onDeleteProducts?: (productIds: string[]) => void
  onDuplicateProduct?: (product: Product) => void
  onToggleFeatured?: (productId: string) => void
  onAdjustStock?: (productId: string, newStock: number) => void
  onExportProducts?: () => void
  onImportProducts?: () => void
  onRefresh?: () => void
  className?: string
}



export function ProductActions({
  products,
  selectedProducts = [],
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onDeleteProducts,
  onDuplicateProduct,
  onToggleFeatured,
  onAdjustStock,
  onExportProducts,
  onImportProducts,
  onRefresh,
  className
}: ProductActionsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const notifications = useOptimizedNotifications()
  const { notifyProductAction, notifyImportExport } = useContextualNotifications()

  const hasSelectedProducts = selectedProducts.length > 0
  const selectedCount = selectedProducts.length

  // Simular operaciones asíncronas para demostrar el sistema optimizado
  const simulateAsyncOperation = (duration: number = 1000) => {
    return new Promise(resolve => setTimeout(resolve, duration))
  }

  // Handlers para acciones asíncronas con notificaciones contextuales
  const handleAddProduct = async () => {
    const loadingToast = notifyProductAction(ActionType.CREATE, 'loading')
    try {
      await simulateAsyncOperation(800)
      const newProduct = { name: 'Nuevo Producto', id: Date.now().toString() }
      onAddProduct?.()
      toast.dismiss(loadingToast)
      notifyProductAction(ActionType.CREATE, 'success', { data: newProduct })
      return { success: true, data: newProduct }
    } catch (error) {
      toast.dismiss(loadingToast)
      notifyProductAction(ActionType.CREATE, 'error', { error: error as any })
      throw new Error('Error al abrir el formulario')
    }
  }

  const handleEditProduct = async (product: Product) => {
    const loadingToast = notifyProductAction(ActionType.UPDATE, 'loading')
    try {
      await simulateAsyncOperation(500)
      onEditProduct?.(product)
      toast.dismiss(loadingToast)
      notifyProductAction(ActionType.UPDATE, 'success', { data: product })
      return { product: product.name }
    } catch (error) {
      toast.dismiss(loadingToast)
      notifyProductAction(ActionType.UPDATE, 'error', { error: error as any })
      throw new Error('Error al abrir el editor')
    }
  }

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteProduct = async () => {
    if (productToDelete) {
      const loadingToast = notifyProductAction(ActionType.DELETE, 'loading')
      try {
        await simulateAsyncOperation(1200)
        onDeleteProduct?.(productToDelete.id)
        toast.dismiss(loadingToast)
        notifyProductAction(ActionType.DELETE, 'success', { data: productToDelete })
        setProductToDelete(null)
        setIsDeleteDialogOpen(false)
        return { productName: productToDelete.name }
      } catch (error) {
        toast.dismiss(loadingToast)
        notifyProductAction(ActionType.DELETE, 'error', { error: error as any })
        throw new Error('Error al eliminar el producto')
      }
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedProducts.length > 0) {
      const loadingToast = notifyProductAction(ActionType.DELETE, 'loading')
      try {
        await simulateAsyncOperation(1500)
        onDeleteProducts?.(selectedProducts)
        toast.dismiss(loadingToast)
        notifyProductAction(ActionType.DELETE, 'success', { data: { count: selectedProducts.length } })
        return { count: selectedProducts.length }
      } catch (error) {
        toast.dismiss(loadingToast)
        notifyProductAction(ActionType.DELETE, 'error', { error: error as any })
        throw new Error('Error al eliminar los productos seleccionados')
      }
    }
  }

  const handleDuplicateProduct = async (product: Product) => {
    const loadingToast = notifyProductAction(ActionType.DUPLICATE, 'loading')
    try {
      await simulateAsyncOperation(1000)
      onDuplicateProduct?.(product)
      toast.dismiss(loadingToast)
      notifyProductAction(ActionType.DUPLICATE, 'success', { data: product })
      return { productName: product.name }
    } catch (error) {
      toast.dismiss(loadingToast)
      notifyProductAction(ActionType.DUPLICATE, 'error', { error: error as any })
      throw new Error('Error al duplicar el producto')
    }
  }

  const handleToggleFeatured = async (product: Product) => {
    const loadingToast = notifyProductAction(ActionType.TOGGLE, 'loading')
    try {
      await simulateAsyncOperation(600)
      onToggleFeatured?.(product.id)
      toast.dismiss(loadingToast)
      notifyProductAction(ActionType.TOGGLE, 'success', { data: product })
      return { 
        productName: product.name, 
        action: product.featured ? 'removido de' : 'marcado como' 
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      notifyProductAction(ActionType.TOGGLE, 'error', { error: error as any })
      throw new Error('Error al cambiar el estado destacado')
    }
  }

  const handleExport = async () => {
    const loadingToast = notifyImportExport(ActionType.EXPORT, 'loading')
    try {
      await simulateAsyncOperation(2000)
      onExportProducts?.()
      toast.dismiss(loadingToast)
      notifyImportExport(ActionType.EXPORT, 'success', { data: { exported: products.length } })
      return { count: products.length }
    } catch (error) {
      toast.dismiss(loadingToast)
      notifyImportExport(ActionType.EXPORT, 'error', { error: error as any })
      throw new Error('Error al exportar los productos')
    }
  }

  const handleImport = async () => {
    const loadingToast = notifyImportExport(ActionType.IMPORT, 'loading')
    try {
      await simulateAsyncOperation(800)
      onImportProducts?.()
      toast.dismiss(loadingToast)
      notifyImportExport(ActionType.IMPORT, 'success', { data: { success: true } })
      return { success: true }
    } catch (error) {
      toast.dismiss(loadingToast)
      notifyImportExport(ActionType.IMPORT, 'error', { error: error as any })
      throw new Error('Error al abrir el importador')
    }
  }

  const handleRefresh = async () => {
    const loadingToast = notifyProductAction(ActionType.REFRESH, 'loading')
    try {
      await simulateAsyncOperation(1000)
      onRefresh?.()
      toast.dismiss(loadingToast)
      notifyProductAction(ActionType.REFRESH, 'success', { data: { count: products.length } })
      return { count: products.length }
    } catch (error) {
      toast.dismiss(loadingToast)
      notifyProductAction(ActionType.REFRESH, 'error', { error: error as any })
      throw new Error('Error al actualizar los datos')
    }
  }

  // Get low stock and out of stock products for quick actions
  const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0)
  const outOfStockProducts = products.filter(p => p.stock_quantity === 0)

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Primary Actions */}
        <div className="flex flex-wrap gap-2">
          <OptimizedButton
            buttonId="add-product"
            onAsyncClick={handleAddProduct}
            variant="default"
            className="bg-blue-600 hover:bg-blue-700"
            notificationMessages={{
              loading: "Abriendo formulario...",
              success: "Formulario de producto abierto",
              error: "Error al abrir el formulario"
            }}
            showLoadingState={true}
            showSuccessState={true}
            ariaLabel="Agregar nuevo producto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Producto
          </OptimizedButton>
          
          <OptimizedButton
            buttonId="import-products"
            onAsyncClick={handleImport}
            variant="outline"
            notificationMessages={{
              loading: "Abriendo importador...",
              success: "Importador de productos abierto",
              error: "Error al abrir el importador"
            }}
            ariaLabel="Importar productos desde archivo"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </OptimizedButton>
          
          <OptimizedButton
            buttonId="export-products"
            onAsyncClick={handleExport}
            variant="outline"
            notificationMessages={{
              loading: "Exportando productos...",
              success: (data: { count: number }) => `${data.count} productos exportados exitosamente`,
              error: "Error al exportar los productos"
            }}
            ariaLabel="Exportar productos a archivo"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </OptimizedButton>
          
          <OptimizedButton
            buttonId="refresh-products"
            onAsyncClick={handleRefresh}
            variant="ghost"
            notificationMessages={{
              loading: "Actualizando datos...",
              success: (data: { count: number }) => `${data.count} productos actualizados`,
              error: "Error al actualizar los datos"
            }}
            ariaLabel="Actualizar lista de productos"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </OptimizedButton>
        </div>

        {/* Bulk Actions */}
        {hasSelectedProducts && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1">
              {selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}
            </Badge>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar productos seleccionados?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará {selectedCount} producto{selectedCount > 1 ? 's' : ''} permanentemente.
                    Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteSelected} className="bg-red-600 hover:bg-red-700">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-orange-800">Stock Bajo</h3>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                {lowStockProducts.length}
              </Badge>
            </div>
            <p className="text-sm text-orange-700 mb-3">
              Productos que requieren reabastecimiento
            </p>
            <div className="space-y-2">
              {lowStockProducts.slice(0, 3).map(product => (
                <div key={product.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{product.name}</span>
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    {product.stock_quantity}
                  </Badge>
                </div>
              ))}
              {lowStockProducts.length > 3 && (
                <p className="text-xs text-orange-600">
                  +{lowStockProducts.length - 3} más...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Out of Stock Alert */}
        {outOfStockProducts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <X className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-red-800">Sin Stock</h3>
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                {outOfStockProducts.length}
              </Badge>
            </div>
            <p className="text-sm text-red-700 mb-3">
              Productos agotados que necesitan reposición
            </p>
            <div className="space-y-2">
              {outOfStockProducts.slice(0, 3).map(product => (
                <div key={product.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{product.name}</span>
                  <Badge variant="destructive" className="text-xs">
                    Agotado
                  </Badge>
                </div>
              ))}
              {outOfStockProducts.length > 3 && (
                <p className="text-xs text-red-600">
                  +{outOfStockProducts.length - 3} más...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-blue-800">Resumen Rápido</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">Total productos:</span>
              <span className="font-medium text-blue-800">{products.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Categorías:</span>
              <span className="font-medium text-blue-800">
                {new Set(products.map(p => p.category)).size}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Valor total:</span>
              <span className="font-medium text-blue-800">
                ${products.reduce((acc, p) => acc + (p.stock_quantity * p.sale_price), 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Product Actions (for use in product cards/table) */}
      <div className="hidden">
        {products.map(product => (
          <div key={product.id} className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEditProduct(product)}
              title="Editar producto"
            >
              <Edit className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDuplicateProduct(product)}
              title="Duplicar producto"
            >
              <Copy className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleToggleFeatured(product)}
              title={product.featured ? "Quitar de destacados" : "Marcar como destacado"}
              className={product.featured ? "text-yellow-600" : ""}
            >
              <Star className={cn("h-4 w-4", product.featured && "fill-current")} />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDuplicateProduct(product)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleFeatured(product)}>
                  <Star className="mr-2 h-4 w-4" />
                  {product.featured ? 'Quitar destacado' : 'Marcar destacado'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleDeleteProduct(product)}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar "{productToDelete?.name}"?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteProduct}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ProductActions

// Export individual action components for use in other parts of the app
export function ProductRowActions({ 
  product, 
  onEdit, 
  onDelete, 
  onDuplicate, 
  onToggleFeatured 
}: {
  product: Product
  onEdit?: (product: Product) => void
  onDelete?: (product: Product) => void
  onDuplicate?: (product: Product) => void
  onToggleFeatured?: (product: Product) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <OptimizedButton
        buttonId={`edit-${product.id}`}
        onAsyncClick={async () => {
          await new Promise(resolve => setTimeout(resolve, 300))
          onEdit?.(product)
          return { productName: product.name }
        }}
        variant="ghost"
        size="icon"
        notificationMessages={{
          loading: "Abriendo editor...",
          success: (data: { productName: string }) => `Editando ${data.productName}`,
          error: "Error al abrir el editor"
        }}
        ariaLabel="Editar producto"
      >
        <Edit className="h-4 w-4" />
      </OptimizedButton>
      
      <OptimizedButton
        buttonId={`duplicate-${product.id}`}
        onAsyncClick={async () => {
          await new Promise(resolve => setTimeout(resolve, 500))
          onDuplicate?.(product)
          return { productName: product.name }
        }}
        variant="ghost"
        size="icon"
        notificationMessages={{
          loading: "Duplicando producto...",
          success: (data: { productName: string }) => `${data.productName} duplicado exitosamente`,
          error: "Error al duplicar el producto"
        }}
        ariaLabel="Duplicar producto"
      >
        <Copy className="h-4 w-4" />
      </OptimizedButton>
      
      <OptimizedButton
        buttonId={`toggle-featured-${product.id}`}
        onAsyncClick={async () => {
          await new Promise(resolve => setTimeout(resolve, 400))
          onToggleFeatured?.(product)
          return { 
            productName: product.name,
            featured: !product.featured
          }
        }}
        variant="ghost"
        size="icon"
        notificationMessages={{
          loading: product.featured ? "Quitando de destacados..." : "Marcando como destacado...",
          success: (data: { productName: string; featured: boolean }) => data.featured 
            ? `${data.productName} marcado como destacado` 
            : `${data.productName} quitado de destacados`,
          error: "Error al actualizar el estado destacado"
        }}
        className={product.featured ? "text-yellow-600" : ""}
        ariaLabel={product.featured ? "Quitar de destacados" : "Marcar como destacado"}
      >
        <Star className={cn("h-4 w-4", product.featured && "fill-current")} />
      </OptimizedButton>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onEdit?.(product)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate?.(product)}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onToggleFeatured?.(product)}>
            <Star className="mr-2 h-4 w-4" />
            {product.featured ? 'Quitar destacado' : 'Marcar destacado'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <ConfirmationButton
              buttonId={`delete-${product.id}`}
              onAsyncClick={async () => {
                await new Promise(resolve => setTimeout(resolve, 800))
                onDelete?.(product)
                return { productName: product.name }
              }}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              confirmationTitle="¿Eliminar producto?"
              confirmationDescription={`¿Estás seguro de que quieres eliminar "${product.name}"? Esta acción no se puede deshacer.`}
              confirmButtonText="Eliminar"
              cancelButtonText="Cancelar"
              notificationMessages={{
                loading: "Eliminando producto...",
                success: (data: { productName: string }) => `${data.productName} eliminado exitosamente`,
                error: "Error al eliminar el producto"
              }}
              ariaLabel="Eliminar producto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </ConfirmationButton>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}