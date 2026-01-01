import React from 'react';

// Shared Components - Componentes compartidos y utilidades
export { ImageUpload } from '../../image-upload'

export const ProductCardSkeletonGrid = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="border rounded-lg p-4 space-y-3">
        <div className="w-full aspect-square bg-muted animate-pulse rounded-md" />
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
        <div className="flex justify-between items-center pt-2">
          <div className="h-8 w-20 bg-muted animate-pulse rounded" />
          <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
        </div>
      </div>
    ))}
  </div>
)

// Estados de carga y error
export const ProductSkeleton = () => <div className="animate-pulse bg-gray-200 h-32 rounded" />
export const EmptyState = ({ message = "No hay productos disponibles" }: { message?: string }) => (
  <div className="text-center py-8 text-gray-500">{message}</div>
)
export const LoadingSpinner = () => (
  <div className="flex justify-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)