"use client"

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Trash2, AlertTriangle } from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { InventoryTable } from '../InventoryTable'
import { ProductDetailDialog } from '../ProductDetailDialog'
import { ProductEditDialog } from '../ProductEditDialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Product } from '@/types/product-unified'

export function InventoryTab() {
  const { inventory, categories, loading, deleteItem } = useInventory()
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredInventory = useMemo(() => {
    return inventory.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = categoryFilter === "all" || p.category_id === categoryFilter

      let matchesStock = true
      if (stockFilter === "low") matchesStock = (p.stock_quantity || 0) <= (p.min_stock || 5)
      if (stockFilter === "out") matchesStock = (p.stock_quantity || 0) === 0
      if (stockFilter === "in") matchesStock = (p.stock_quantity || 0) > 0

      return matchesSearch && matchesCategory && matchesStock
    })
  }, [inventory, searchTerm, categoryFilter, stockFilter])

  const handleViewDetail = (product: Product) => {
    setSelectedProduct(product)
    setIsDetailOpen(true)
  }

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setIsEditOpen(true)
    setIsDetailOpen(false)
  }

  const handleDelete = (product: Product) => {
    setProductToDelete(product)
  }

  const confirmDelete = async () => {
    if (!productToDelete) return
    setIsDeleting(true)
    try {
      await deleteItem(productToDelete.id)
    } finally {
      setIsDeleting(false)
      setProductToDelete(null)
    }
  }

  const handleEditSuccess = () => {
    // Re-sync selectedProduct with updated data from the inventory list
    if (selectedProduct) {
      const updated = inventory.find(p => p.id === selectedProduct.id)
      if (updated) setSelectedProduct(updated)
    }
    setIsEditOpen(false)
  }

  return (
    <>
      <Card className="bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
        <CardHeader className="relative z-10 border-b border-border/30 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <span className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </span>
              Inventario de Repuestos
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar repuesto..."
                  className="pl-8 focus:ring-2 focus:ring-blue-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px] focus:ring-2 focus:ring-purple-500">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[180px] focus:ring-2 focus:ring-green-500">
                  <SelectValue placeholder="Estado Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="in">✓ En Stock</SelectItem>
                  <SelectItem value="low">⚠ Bajo Stock</SelectItem>
                  <SelectItem value="out">✗ Agotado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <InventoryTable
            products={filteredInventory}
            loading={loading}
            onViewDetail={handleViewDetail}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              ¿Eliminar repuesto?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar <strong className="text-foreground">"{productToDelete?.name}"</strong>.
              Esta acción no se puede deshacer y eliminará también todos los movimientos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Eliminando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProductDetailDialog
        product={selectedProduct}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={handleEdit}
      />

      <ProductEditDialog
        product={selectedProduct}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={handleEditSuccess}
      />
    </>
  )
}
