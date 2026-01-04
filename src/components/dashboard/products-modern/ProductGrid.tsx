/**
 * ProductGrid Component
 * Grid layout for product cards
 */

import React from 'react'
import { ProductCard } from './ProductCard'
import { Product } from '@/types/products'
import { cn } from '@/lib/utils'

export interface ProductGridProps {
  products: Product[]
  selectedProductIds: string[]
  onProductSelect: (id: string) => void
  onProductEdit: (product: Product) => void
  onProductDelete: (product: Product) => void
  onProductDuplicate: (product: Product) => void
  onProductViewDetails: (product: Product) => void
  loading?: boolean
  className?: string
}

export function ProductGrid({
  products,
  selectedProductIds,
  onProductSelect,
  onProductEdit,
  onProductDelete,
  onProductDuplicate,
  onProductViewDetails,
  loading = false,
  className
}: ProductGridProps) {
  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 aspect-square rounded-t-lg" />
            <div className="bg-gray-100 dark:bg-gray-800 p-4 space-y-3 rounded-b-lg">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-gray-400 dark:text-gray-600 mb-4">
          <svg
            className="w-24 h-24 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No se encontraron productos
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          No hay productos que coincidan con los filtros aplicados. Intenta ajustar tus criterios de búsqueda.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6', className)}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isSelected={selectedProductIds.includes(product.id)}
          onSelect={onProductSelect}
          onEdit={onProductEdit}
          onDelete={onProductDelete}
          onDuplicate={onProductDuplicate}
          onViewDetails={onProductViewDetails}
        />
      ))}
    </div>
  )
}
