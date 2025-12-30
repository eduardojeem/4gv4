import React from 'react';

// Shared Components - Componentes compartidos y utilidades
export { ProductCardSkeletonGrid } from '../../product-card-skeleton'
export { default as ImageUpload } from '../../image-upload'

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