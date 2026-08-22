"use client"

import { ProductModal } from '@/components/dashboard/product-modal'
import { useInventory } from '../context/InventoryContext'
import type { Product } from '@/types/product-unified'

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
  const { categories, suppliers, updateInventoryProduct, refresh } = useInventory()

  const handleSave = async (formData: any) => {
    if (!product) return
    await updateInventoryProduct(product.id, formData)
    onSuccess?.()
    onOpenChange(false)
  }

  return (
    <ProductModal
      product={product}
      isOpen={open}
      onClose={() => onOpenChange(false)}
      onSave={handleSave}
      categories={categories}
      brands={[]}
      suppliers={suppliers}
      onCatalogChange={refresh}
    />
  )
}
