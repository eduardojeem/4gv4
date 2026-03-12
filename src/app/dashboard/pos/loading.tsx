import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export default function POSLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row gap-4 p-4 overflow-hidden">
      {/* Panel Izquierdo: Productos */}
      <div className="flex flex-col flex-1 gap-4">
        {/* Filtros */}
        <div className="h-16 flex items-center gap-2">
          <Skeleton className="h-10 w-64 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md ml-auto" />
        </div>
        
        {/* Categorías */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        
        {/* Grid de Productos */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 flex-1 overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 p-4 border rounded-lg bg-card shadow-sm h-64">
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="mt-auto flex justify-between items-center">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Panel Derecho: Carrito */}
      <div className="w-full md:w-[400px] lg:w-[450px] flex flex-col border-l pl-4 gap-4 h-full bg-background z-10">
        <div className="flex justify-between items-center h-16 border-b">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        
        {/* Items del Carrito */}
        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-16 w-16 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </div>
          ))}
        </div>
        
        {/* Resumen y Botones */}
        <div className="mt-auto space-y-4 pt-4 border-t bg-background">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
          <Skeleton className="h-14 w-full rounded-md bg-primary/20" />
        </div>
      </div>
      
      {/* Loading Overlay */}
      <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-50 backdrop-blur-[1px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium text-muted-foreground animate-pulse">Cargando Punto de Venta...</p>
        </div>
      </div>
    </div>
  )
}
