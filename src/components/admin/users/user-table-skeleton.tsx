'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { TableRow, TableCell } from '@/components/ui/table'

interface UserTableSkeletonProps {
  rows?: number
}

export function UserTableSkeleton({ rows = 10 }: UserTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i} className="border-b dark:border-gray-700">
          {/* Usuario */}
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </TableCell>
          
          {/* Rol */}
          <TableCell>
            <Skeleton className="h-6 w-20 rounded-full" />
          </TableCell>
          
          {/* Estado */}
          <TableCell>
            <Skeleton className="h-6 w-16 rounded-full" />
          </TableCell>
          
          {/* Departamento */}
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-4 w-24" />
          </TableCell>
          
          {/* Último Acceso */}
          <TableCell className="hidden lg:table-cell">
            <Skeleton className="h-4 w-28" />
          </TableCell>
          
          {/* Acciones */}
          <TableCell className="text-right">
            <div className="flex justify-end">
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
