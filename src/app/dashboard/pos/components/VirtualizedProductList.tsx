'use client'

import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
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
  inventoryManager?: unknown
  isWholesale?: boolean
  wholesaleDiscountRate?: number
  onViewDetail?: (product: Product, tab?: string) => void
}

interface ItemData {
  products: Product[]
  onAddToCart: (product: Product) => void
  onQuickAdd?: (product: Product, quantity: number) => void
  getCartQuantity: (productId: string) => number
  viewMode: 'grid' | 'list'
  showStock: boolean
  showBarcode: boolean
  inventoryManager?: unknown
  isWholesale?: boolean
  wholesaleDiscountRate?: number
  onViewDetail?: (product: Product, tab?: string) => void
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
    wholesaleDiscountRate,
    onViewDetail
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
          onViewDetail={onViewDetail}
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
          <p className="text-sm">Intenta ajustar los filtros de busqueda</p>
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
/** Altura inicial de una fila; si las tarjetas miden más, la fila crece sola. */
export const GRID_ROW_ESTIMATE = 340
export const LIST_ROW_ESTIMATE = 96

export const VirtualizedProductGrid: React.FC<VirtualizedProductListProps> = ({
  products,
  viewMode = 'grid',
  onAddToCart,
  onQuickAdd,
  getCartQuantity,
  height = 600,
  showStock = true,
  showBarcode = false,
  inventoryManager,
  isWholesale,
  wholesaleDiscountRate,
  onViewDetail
}) => {
  const [containerWidth, setContainerWidth] = useState(1000)
  const containerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    // Initial measure
    updateWidth()

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // Calculate items per row based on container width
  // Min card width around 220px + 16px gap
  const ITEM_MIN_WIDTH = 220
  const GAP = 16
  const itemsPerRow = viewMode === 'list'
    ? 1
    : Math.max(1, Math.floor((containerWidth + GAP) / (ITEM_MIN_WIDTH + GAP)))

  // Antes la fila medía 280 px fijos: una tarjeta con nombre en dos líneas,
  // stock y plan de cuotas medía más, y la fila siguiente (posicionada en
  // absoluto) le tapaba la parte de abajo, que es donde va el precio. Ahora se
  // mide lo que ocupan las filas visibles y la altura sólo crece.
  const estimate = viewMode === 'list' ? LIST_ROW_ESTIMATE : GRID_ROW_ESTIMATE
  // La medida vale para una disposición (vista y columnas): al cambiarla se vuelve a medir.
  const layoutKey = `${viewMode}:${itemsPerRow}`
  const [measured, setMeasured] = useState({ key: layoutKey, height: 0 })
  const rowRefs = useRef(new Map<number, HTMLDivElement>())
  const hasMeasure = measured.key === layoutKey && measured.height > 0
  const ITEM_HEIGHT = hasMeasure ? measured.height : estimate

  // Group products into rows
  const productRows = useMemo(() => {
    const rows: Product[][] = []
    for (let i = 0; i < products.length; i += itemsPerRow) {
      rows.push(products.slice(i, i + itemsPerRow))
    }
    return rows
  }, [products, itemsPerRow])

  const { virtualItems, containerProps, innerProps } = useVirtualList({
    items: productRows,
    itemHeight: ITEM_HEIGHT,
    containerHeight: height,
    overscan: 2
  })

  // Las filas visibles se observan con ResizeObserver: cuando cambia lo que
  // miden (al montarse, al cargar una imagen, al cambiar el ancho) se recalcula.
  const layoutKeyRef = useRef(layoutKey)
  // Antes de que el navegador mida: así el observer anota la medida con la disposición nueva.
  useLayoutEffect(() => { layoutKeyRef.current = layoutKey }, [layoutKey])
  const rowObserver = useRef<ResizeObserver | null>(null)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      let tallest = 0
      for (const row of rowRefs.current.values()) tallest = Math.max(tallest, row.offsetHeight)
      if (tallest <= 0) return
      const key = layoutKeyRef.current
      const next = Math.ceil(tallest)
      // La primera medida de una disposición manda (aunque sea menor que la
      // estimación); después sólo crece, para no saltar al hacer scroll.
      setMeasured((previous) => {
        if (previous.key !== key || previous.height <= 0) return { key, height: next }
        return next > previous.height ? { key, height: next } : previous
      })
    })
    rowObserver.current = observer
    for (const row of rowRefs.current.values()) observer.observe(row)
    return () => {
      observer.disconnect()
      rowObserver.current = null
    }
  }, [])

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No se encontraron productos</p>
          <p className="text-sm">Intenta ajustar los filtros de busqueda</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background" ref={containerRef}>
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
              <div
                ref={(element) => {
                  const previous = rowRefs.current.get(index)
                  if (previous && previous !== element) rowObserver.current?.unobserve(previous)
                  if (element) {
                    rowRefs.current.set(index, element)
                    rowObserver.current?.observe(element)
                  } else {
                    rowRefs.current.delete(index)
                  }
                }}
                data-testid="pos-virtual-row"
                className={viewMode === 'list' ? 'grid gap-2 px-4 py-1' : 'grid gap-4 p-4'}
                style={{
                  gridTemplateColumns: `repeat(${itemsPerRow}, minmax(0, 1fr))`
                }}
              >
                {row.map((product: Product) => (
                  <ProductCard
                    key={product.id}
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
                    onViewDetail={onViewDetail}
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

