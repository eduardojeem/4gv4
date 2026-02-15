"use client"

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  DollarSign,
  Tag,
  Building2,
  BarChart3,
  AlertCircle,
  Save,
  X
} from 'lucide-react'
import type { Product } from '@/types/product-unified'
import { useInventory } from '../context/InventoryContext'
import { toast } from 'sonner'

interface ProductEditDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ProductEditDialog({
  product,
  open,
  onOpenChange,
  onSuccess
}: ProductEditDialogProps) {
  const { categories, suppliers, updateInventoryProduct } = useInventory()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category_id: '',
    supplier_id: '',
    sale_price: '',
    purchase_price: '',
    wholesale_price: '',
    stock_quantity: '',
    min_stock: '',
    max_stock: '',
    unit_measure: 'unidad',
    is_active: true,
    barcode: '',
    brand: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (product && open) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        description: product.description || '',
        category_id: product.category_id || '',
        supplier_id: product.supplier_id || '',
        sale_price: String(product.sale_price || ''),
        purchase_price: String(product.purchase_price || ''),
        wholesale_price: product.wholesale_price ? String(product.wholesale_price) : '',
        stock_quantity: String(product.stock_quantity || ''),
        min_stock: String(product.min_stock || '5'),
        max_stock: String(product.max_stock || '100'),
        unit_measure: product.unit_measure || 'unidad',
        is_active: product.is_active ?? true,
        barcode: product.barcode || '',
        brand: product.brand || ''
      })
      setErrors({})
    }
  }, [product, open])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    }

    if (!formData.sku.trim()) {
      newErrors.sku = 'El SKU es requerido'
    }

    if (!formData.sale_price || parseFloat(formData.sale_price) <= 0) {
      newErrors.sale_price = 'El precio de venta debe ser mayor a 0'
    }

    if (!formData.purchase_price || parseFloat(formData.purchase_price) < 0) {
      newErrors.purchase_price = 'El precio de compra no puede ser negativo'
    }

    if (formData.wholesale_price && parseFloat(formData.wholesale_price) < 0) {
      newErrors.wholesale_price = 'El precio mayorista no puede ser negativo'
    }

    if (!formData.stock_quantity || parseInt(formData.stock_quantity) < 0) {
      newErrors.stock_quantity = 'El stock no puede ser negativo'
    }

    if (!formData.min_stock || parseInt(formData.min_stock) < 0) {
      newErrors.min_stock = 'El stock mínimo no puede ser negativo'
    }

    if (!formData.max_stock || parseInt(formData.max_stock) <= 0) {
      newErrors.max_stock = 'El stock máximo debe ser mayor a 0'
    }

    if (parseInt(formData.min_stock) > parseInt(formData.max_stock)) {
      newErrors.min_stock = 'El stock mínimo no puede ser mayor al máximo'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!product) return

    if (!validateForm()) {
      toast.error('Por favor corrige los errores en el formulario')
      return
    }

    setIsSubmitting(true)
    try {
      const productData = {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        description: formData.description.trim() || null,
        category_id: formData.category_id && formData.category_id !== "none" ? formData.category_id : null,
        supplier_id: formData.supplier_id && formData.supplier_id !== "none" ? formData.supplier_id : null,
        sale_price: parseFloat(formData.sale_price),
        purchase_price: parseFloat(formData.purchase_price),
        wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : null,
        stock_quantity: parseInt(formData.stock_quantity),
        min_stock: parseInt(formData.min_stock),
        max_stock: parseInt(formData.max_stock),
        unit_measure: formData.unit_measure,
        is_active: formData.is_active,
        barcode: formData.barcode.trim() || null,
        brand: formData.brand.trim() || null
      }

      await updateInventoryProduct(product.id, productData)
      
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      logger.error('Error updating product', { error })
      // El error ya se muestra en el contexto
    } finally {
      setIsSubmitting(false)
    }
  }

  const margin = formData.sale_price && formData.purchase_price
    ? parseFloat(formData.sale_price) - parseFloat(formData.purchase_price)
    : 0
  const marginPercent = formData.purchase_price && parseFloat(formData.purchase_price) > 0
    ? (margin / parseFloat(formData.purchase_price)) * 100
    : 0

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Editar Producto
          </DialogTitle>
          <DialogDescription>
            Modifica la información del producto. Los campos marcados con * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Información Básica */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Información Básica</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-1">
                  Nombre del Producto <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Ej: Pantalla iPhone 13"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku" className="flex items-center gap-1">
                  SKU <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sku"
                  placeholder="Ej: IP13-SCR-001"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className={errors.sku ? 'border-red-500' : ''}
                />
                {errors.sku && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.sku}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  placeholder="Ej: Apple, Samsung"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">Código de Barras</Label>
                <Input
                  id="barcode"
                  placeholder="Ej: 1234567890123"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Descripción detallada del producto..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <Separator />

          {/* Clasificación */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold">Clasificación</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={formData.category_id || "none"} onValueChange={(value) => setFormData({ ...formData, category_id: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categories && categories.length > 0 ? (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))
                    ) : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">Proveedor</Label>
                <Select value={formData.supplier_id || "none"} onValueChange={(value) => setFormData({ ...formData, supplier_id: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {suppliers && suppliers.length > 0 ? (
                      suppliers.map((sup) => (
                        <SelectItem key={sup.id} value={sup.id}>
                          {sup.name}
                        </SelectItem>
                      ))
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_measure">Unidad de Medida</Label>
              <Select value={formData.unit_measure} onValueChange={(value) => setFormData({ ...formData, unit_measure: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unidad">Unidad</SelectItem>
                  <SelectItem value="pieza">Pieza</SelectItem>
                  <SelectItem value="caja">Caja</SelectItem>
                  <SelectItem value="paquete">Paquete</SelectItem>
                  <SelectItem value="metro">Metro</SelectItem>
                  <SelectItem value="kilogramo">Kilogramo</SelectItem>
                  <SelectItem value="litro">Litro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Precios */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Precios</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_price" className="flex items-center gap-1 text-green-600">
                  Precio Compra <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  className={errors.purchase_price ? 'border-red-500' : ''}
                />
                {errors.purchase_price && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.purchase_price}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sale_price" className="flex items-center gap-1 text-blue-600">
                  Precio Venta <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                  className={errors.sale_price ? 'border-red-500' : ''}
                />
                {errors.sale_price && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.sale_price}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="wholesale_price" className="text-purple-600">
                  Precio Mayorista
                </Label>
                <Input
                  id="wholesale_price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.wholesale_price}
                  onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                  className={errors.wholesale_price ? 'border-red-500' : ''}
                />
                {errors.wholesale_price && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.wholesale_price}
                  </p>
                )}
              </div>
            </div>

            {/* Indicador de Margen */}
            {formData.sale_price && formData.purchase_price && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Margen de Ganancia</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {marginPercent.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Ganancia por Unidad</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${margin.toFixed(2)}
                    </p>
                  </div>
                  <Badge className={
                    marginPercent >= 50 ? 'bg-green-500' :
                    marginPercent >= 30 ? 'bg-blue-500' :
                    marginPercent >= 15 ? 'bg-amber-500' :
                    'bg-red-500'
                  }>
                    {marginPercent >= 50 ? 'Excelente' :
                     marginPercent >= 30 ? 'Bueno' :
                     marginPercent >= 15 ? 'Aceptable' :
                     'Bajo'}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Stock */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold">Inventario</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock_quantity" className="flex items-center gap-1">
                  Stock Actual <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  placeholder="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  className={errors.stock_quantity ? 'border-red-500' : ''}
                />
                {errors.stock_quantity && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.stock_quantity}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_stock" className="flex items-center gap-1">
                  Stock Mínimo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="min_stock"
                  type="number"
                  placeholder="5"
                  value={formData.min_stock}
                  onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                  className={errors.min_stock ? 'border-red-500' : ''}
                />
                {errors.min_stock && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.min_stock}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_stock" className="flex items-center gap-1">
                  Stock Máximo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="max_stock"
                  type="number"
                  placeholder="100"
                  value={formData.max_stock}
                  onChange={(e) => setFormData({ ...formData, max_stock: e.target.value })}
                  className={errors.max_stock ? 'border-red-500' : ''}
                />
                {errors.max_stock && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.max_stock}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Estado */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active" className="text-base">
                  Producto Activo
                </Label>
                <p className="text-sm text-muted-foreground">
                  Los productos inactivos no aparecen en el catálogo
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
