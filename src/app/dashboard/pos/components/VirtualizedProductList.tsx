'use client'

import React, { useMemo, useCallback } from 'react'
import { formatCurrency } from '@/lib/currency'
import { useVirtualList } from '@/hooks/use-virtual-list'

import { ProductCard } from './ProductCard'
import type { Product } from '@/types/product-unified'

interface VirtualizedProductListProps {
  products: Product[]
  onAddToCart: (product: Product) => void
  onQuickAdd?: (product: Product, quantity: number) => void
  getCartQuantity: (productId: string) => number
  viewMode?: 'grid' | 'list'
  height?: number
  itemHeight?: number
  showStock?: boolean
  showBarcode?: boolean
  inventoryManager?: any
  isWholesale?: boolean
  wholesaleDiscountRate?: number
}

interface ItemData {
  products: Product[]
  onAddToCart: (product: Product) => void
  onQuickAdd?: (product: Product, quantity: number) => void
  getCartQuantity: (productId: string) => number
  viewMode: 'grid' | 'list'
  showStock: boolean
  showBarcode: boolean
  inventoryManager?: any
  isWholesale?: boolean
  wholesaleDiscountRate?: number
}

const ProductRow = ({ index, style, ...props }: {
  index: number
  style: React.CSSProperties
} & ItemData) => {
  const { 
    products, 
    onAddToCart, 
    onQuickAdd, 
    getCartQuantity, 
    viewMode, 
    showStock, 
    showBarcode,
    inventoryManager,
    isWholesale,
    wholesaleDiscountRate
  } = props
  
  const product = products[index]
  if (!product) {
    return (
      <div style={style} />
    )
  }

  return (
    <div style={style}>
      <div className="p-2">
        <ProductCard
          product={product}
          addToCart={onAddToCart}
          formatCurrency={formatCurrency}
          onQuickAdd={onQuickAdd}
          cartQuantity={getCartQuantity(product.id)}
          viewMode={viewMode}
          showStock={showStock}
          showBarcode={showBarcode}
          inventoryManager={inventoryManager}
          isWholesale={isWholesale}
          wholesaleDiscountRate={wholesaleDiscountRate}
        />
      </div>
    </div>
  )
}

export const VirtualizedProductList: React.FC<VirtualizedProductListProps> = ({
  products,
  onAddToCart,
  onQuickAdd,
  getCartQuantity,
  viewMode = 'list',
  height = 600,
  itemHeight = 120,
  showStock = true,
  showBarcode = false,
  inventoryManager,
  isWholesale,
  wholesaleDiscountRate
}) => {
  const { virtualItems, containerProps, innerProps } = useVirtualList({
    items: products,
    itemHeight: viewMode === 'grid' ? itemHeight + 16 : itemHeight,
    containerHeight: height,
    overscan: 5
  })

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No se encontraron productos</p>
          <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div {...containerProps}>
        <div {...innerProps}>
          {virtualItems.map(({ index, offsetTop }) => (
            <ProductRow
              key={index}
              index={index}
              style={{ position: 'absolute', top: offsetTop, width: '100%', height: itemHeight }}
              products={products}
              onAddToCart={onAddToCart}
              onQuickAdd={onQuickAdd}
              getCartQuantity={getCartQuantity}
              viewMode={viewMode}
              showStock={showStock}
              showBarcode={showBarcode}
              inventoryManager={inventoryManager}
              isWholesale={isWholesale}
              wholesaleDiscountRate={wholesaleDiscountRate}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Grid version for better performance with grid layouts
export const VirtualizedProductGrid: React.FC<VirtualizedProductListProps> = ({
  products,
  onAddToCart,
  onQuickAdd,
  getCartQuantity,
  height = 600,
  showStock = true,
  showBarcode = false,
  inventoryManager,
  isWholesale,
  wholesaleDiscountRate
}) => {
  const ITEMS_PER_ROW = 3
  const ITEM_HEIGHT = 280

  // Group products into rows
  const productRows = useMemo(() => {
    const rows: Product[][] = []
    for (let i = 0; i < products.length; i += ITEMS_PER_ROW) {
      rows.push(products.slice(i, i + ITEMS_PER_ROW))
    }
    return rows
  }, [products])

  const { virtualItems, containerProps, innerProps } = useVirtualList({
    items: productRows,
    itemHeight: ITEM_HEIGHT,
    containerHeight: height,
    overscan: 2
  })

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No se encontraron productos</p>
          <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div {...containerProps}>
        <div {...innerProps}>
          {virtualItems.map(({ index, item: row, offsetTop }) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                top: offsetTop,
                width: '100%',
                height: ITEM_HEIGHT
              }}
            >
              <div className="grid grid-cols-3 gap-4 p-4">
                {row.map((product: Product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    addToCart={onAddToCart}
                    formatCurrency={formatCurrency}
                    onQuickAdd={onQuickAdd}
                    cartQuantity={getCartQuantity(product.id)}
                    viewMode="grid"
                    showStock={showStock}
                    showBarcode={showBarcode}
                    inventoryManager={inventoryManager}
                    isWholesale={isWholesale}
                    wholesaleDiscountRate={wholesaleDiscountRate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}