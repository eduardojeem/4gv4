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
  onProductToggleActive?: (product: Product, newValue: boolean) => void
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
  onProductToggleActive,
  loading = false,
  className
}: ProductGridProps) {
  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[24px] border border-slate-200/40 bg-white/60 dark:bg-slate-950/50 overflow-hidden shadow-sm flex flex-col"
          >
            {/* Image Area Skeleton */}
            <div className="relative aspect-[4/3] bg-slate-150 dark:bg-slate-850 animate-pulse flex items-center justify-center">
              <div className="absolute top-2.5 left-2.5 h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-800/80 animate-pulse" />
              <div className="h-10 w-10 rounded-xl bg-slate-200/80 dark:bg-slate-800/80 animate-pulse" />
            </div>

            {/* Info Area Skeleton */}
            <div className="p-4 space-y-4 flex-1">
              <div className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-slate-100 dark:bg-slate-900 animate-pulse" />
                <div className="h-4.5 w-3/4 rounded bg-slate-150 dark:bg-slate-800 animate-pulse" />
              </div>

              <div className="h-5 w-16 rounded bg-slate-100 dark:bg-slate-900 animate-pulse" />
              <div className="border-t border-slate-100/50 dark:border-slate-800/50" />

              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <div className="h-2 w-12 rounded bg-slate-100 dark:bg-slate-900 animate-pulse" />
                  <div className="h-5.5 w-24 rounded bg-slate-150 dark:bg-slate-850 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-8 rounded bg-slate-100 dark:bg-slate-900 animate-pulse ml-auto" />
                  <div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-900 animate-pulse ml-auto" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-3.5 w-12 rounded bg-slate-100 dark:bg-slate-900 animate-pulse" />
                  <div className="h-3.5 w-8 rounded bg-slate-150 dark:bg-slate-800 animate-pulse" />
                </div>
                <div className="h-1.5 w-full rounded bg-slate-100 dark:bg-slate-900 animate-pulse" />
              </div>
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
          onToggleActive={onProductToggleActive}
        />
      ))}
    </div>
  )
}
