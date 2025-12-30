/**
 * Skeleton Loaders
 * Componentes de carga para mejorar la percepción de performance
 */

import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
    />
  )
}

export function KanbanSkeleton() {
  return (
    <div className="flex items-center justify-center h-[500px] border rounded-lg bg-card">
      <div className="text-center space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Cargando vista Kanban...</p>
          <p className="text-xs text-muted-foreground">Preparando tablero de reparaciones</p>
        </div>
      </div>
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div className="flex items-center justify-center h-[400px] border rounded-lg bg-card">
      <div className="text-center space-y-3">
        <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Cargando calendario...</p>
          <p className="text-xs text-muted-foreground">Organizando fechas</p>
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-[100px]" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-[120px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-16 w-[100px]" />
          <Skeleton className="h-16 flex-1" />
          <Skeleton className="h-16 w-[120px]" />
          <Skeleton className="h-16 w-[100px]" />
        </div>
      ))}
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-6 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="flex gap-2 justify-end">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-2/4" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  )
}
