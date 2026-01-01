'use client'

import React, { useMemo, useCallback } from 'react'
import { List } from 'react-window'
import { formatCurrency } from '@/lib/currency'

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

interface GridRowProps {
  productRows: Product[][]
  onAddToCart: (product: Product) => void
  onQuickAdd?: (product: Product, quantity: number) => void
  getCartQuantity: (productId: string) => number
  showStock: boolean
  showBarcode: boolean
  inventoryManager?: any
  isWholesale?: boolean
  wholesaleDiscountRate?: number
}

const ProductRow = ({ index, style, ...props }: {
  index: number
  style: React.CSSProperties
  ariaAttributes: {
    "aria-posinset": number
    "aria-setsize": number
    role: "listitem"
  }
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
  // Memoize row props to prevent unnecessary re-renders
  const rowProps = useMemo((): ItemData => ({
    products,
    onAddToCart,
    onQuickAdd,
    getCartQuantity,
    viewMode: viewMode as 'grid' | 'list',
    showStock,
    showBarcode,
    inventoryManager,
    isWholesale,
    wholesaleDiscountRate
  }), [products, onAddToCart, onQuickAdd, getCartQuantity, viewMode, showStock, showBarcode, inventoryManager, isWholesale, wholesaleDiscountRate])

  // Memoized item count
  const itemCount = useMemo(() => products.length, [products.length])

  // Optimized item size calculation
  const getItemSize = useCallback(() => {
    return viewMode === 'grid' ? itemHeight + 16 : itemHeight
  }, [viewMode, itemHeight])

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
    <div className="border rounded-lg overflow-hidden">
      <List
        style={{ height }}
        rowCount={itemCount}
        rowHeight={getItemSize()}
        rowProps={rowProps}
        rowComponent={ProductRow}
        overscanCount={5} // Pre-render 5 items above and below visible area
      />
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

  const rowProps = useMemo((): GridRowProps => ({
    productRows,
    onAddToCart,
    onQuickAdd,
    getCartQuantity,
    showStock,
    showBarcode,
  }), [productRows, onAddToCart, onQuickAdd, getCartQuantity, showStock, showBarcode])

  const GridRow = ({ index, style, ariaAttributes, ...props }: {
    index: number
    style: React.CSSProperties
    ariaAttributes: {
      "aria-posinset": number
      "aria-setsize": number
      role: "listitem"
    }
  } & GridRowProps) => {
    const { productRows, onAddToCart, onQuickAdd, getCartQuantity, showStock, showBarcode, inventoryManager, isWholesale, wholesaleDiscountRate } = props
    const row = productRows[index]

    if (!row) {
      return (
        <div style={style} />
      )
    }

    return (
      <div style={style}>
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
    )
  }

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
    <div className="border rounded-lg overflow-hidden">
      <List
        style={{ height }}
        rowCount={productRows.length}
        rowHeight={ITEM_HEIGHT}
        rowProps={rowProps}
        rowComponent={GridRow}
        overscanCount={2}
      />
    </div>
  )
}