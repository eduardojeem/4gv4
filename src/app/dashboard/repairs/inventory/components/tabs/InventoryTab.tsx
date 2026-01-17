"use client"

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { InventoryTable } from '../InventoryTable'
import { ProductDetailDialog } from '../ProductDetailDialog'
import { ProductEditDialog } from '../ProductEditDialog'
import type { Product } from '@/types/product-unified'

export function InventoryTab() {
  const { inventory, categories, loading } = useInventory()
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

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
    setIsDetailOpen(false) // Cerrar detalle si está abierto
  }

  const handleEditSuccess = () => {
    // Refrescar la lista después de editar
    setIsEditOpen(false)
    setSelectedProduct(null)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
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
          />
        </CardContent>
      </Card>

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
