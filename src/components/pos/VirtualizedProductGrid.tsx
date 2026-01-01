'use client'

import React, { memo } from 'react'
import { useVirtualList } from '@/hooks/use-virtual-list'

interface VirtualizedProductGridProps {
  products: any[]
  renderProduct: (product: any, index: number) => React.ReactNode
  itemHeight: number
  containerHeight: number
  className?: string
  viewMode: 'grid' | 'list'
}

const VirtualizedProductGrid = memo(({
  products,
  renderProduct,
  itemHeight,
  containerHeight,
  className = '',
  viewMode
}: VirtualizedProductGridProps) => {
  // Solo usar virtualización si hay más de 50 productos
  const shouldVirtualize = products.length > 50

  const {
    virtualItems,
    totalHeight,
    containerProps
  } = useVirtualList({
    itemHeight,
    containerHeight,
    items: products,
    overscan: 5
  })

  // Calculate generic offset for the chunk of visible items
  const offsetY = virtualItems.length > 0 ? virtualItems[0].offsetTop : 0

  if (!shouldVirtualize) {
    // Renderizado normal para listas pequeñas
    return (
      <div className={className}>
        {products.map((product, index) => renderProduct(product, index))}
      </div>
    )
  }

  // Renderizado virtualizado para listas grandes
  return (
    <div
      className={`relative ${className}`}
      {...containerProps}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4'
            : 'space-y-2'
          }>
            {virtualItems.map(({ item: product, index }: { item: any, index: number }) => (
              <div key={`${product.id}-${index}`}>
                {renderProduct(product, index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})

VirtualizedProductGrid.displayName = 'VirtualizedProductGrid'

export { VirtualizedProductGrid }