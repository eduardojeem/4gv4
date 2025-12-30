'use client'

import { ReactNode, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface ColumnDef<T> {
    key: string
    header: string
    accessor?: keyof T | ((row: T) => any)
    cell?: (row: T) => ReactNode
    sortable?: boolean
    width?: string
    align?: 'left' | 'center' | 'right'
    className?: string
}

export interface PaginationConfig {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
    pageSizeOptions?: number[]
    onPageSizeChange?: (size: number) => void
}

export interface SortingConfig<T> {
    field: keyof T | null
    direction: 'asc' | 'desc'
    onSort: (field: keyof T) => void
}

export interface DataTableProps<T> {
    data: T[]
    columns: ColumnDef<T>[]
    loading?: boolean
    pagination?: PaginationConfig
    sorting?: SortingConfig<T>
    onRowClick?: (row: T) => void
    emptyMessage?: string
    className?: string
    rowClassName?: (row: T) => string
}

// ============================================================================
// Main Component
// ============================================================================

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    loading = false,
    pagination,
    sorting,
    onRowClick,
    emptyMessage = 'No hay datos disponibles',
    className,
    rowClassName
}: DataTableProps<T>) {

    // Get cell value
    const getCellValue = (row: T, column: ColumnDef<T>) => {
        if (column.cell) {
            return column.cell(row)
        }
        if (column.accessor) {
            if (typeof column.accessor === 'function') {
                return column.accessor(row)
            }
            return row[column.accessor]
        }
        return row[column.key as keyof T]
    }

    // Handle sort
    const handleSort = (column: ColumnDef<T>) => {
        if (!column.sortable || !sorting) return
        const field = (column.accessor as keyof T) || (column.key as keyof T)
        sorting.onSort(field)
    }

    // Pagination calculations
    const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1
    const startItem = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 1
    const endItem = pagination
        ? Math.min(pagination.page * pagination.pageSize, pagination.total)
        : data.length

    return (
        <div className={cn("space-y-4", className)}>
            {/* Table */}
            <div className="relative rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                                {columns.map((column, index) => (
                                    <TableHead
                                        key={index}
                                        style={{ width: column.width }}
                                        className={cn(
                                            "font-semibold text-gray-700 dark:text-gray-300",
                                            column.align === 'center' && "text-center",
                                            column.align === 'right' && "text-right",
                                            column.sortable && "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700/50",
                                            column.className
                                        )}
                                        onClick={() => column.sortable && handleSort(column)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{column.header}</span>
                                            {column.sortable && sorting && (
                                                <div className="flex flex-col">
                                                    {sorting.field === ((column.accessor as keyof T) || (column.key as keyof T)) ? (
                                                        sorting.direction === 'asc' ? (
                                                            <ChevronUp className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4" />
                                                        )
                                                    ) : (
                                                        <div className="h-4 w-4 opacity-30">
                                                            <ChevronUp className="h-3 w-3 -mb-1" />
                                                            <ChevronDown className="h-3 w-3" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-64">
                                        <div className="flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                <p className="text-sm text-muted-foreground">Cargando datos...</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-64">
                                        <div className="flex items-center justify-center">
                                            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((row, rowIndex) => (
                                    <TableRow
                                        key={rowIndex}
                                        onClick={() => onRowClick?.(row)}
                                        className={cn(
                                            onRowClick && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50",
                                            rowClassName?.(row)
                                        )}
                                    >
                                        {columns.map((column, colIndex) => (
                                            <TableCell
                                                key={colIndex}
                                                className={cn(
                                                    column.align === 'center' && "text-center",
                                                    column.align === 'right' && "text-right",
                                                    column.className
                                                )}
                                            >
                                                {getCellValue(row, column)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Loading Overlay */}
                {loading && data.length > 0 && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
                    <div className="text-sm text-muted-foreground">
                        Mostrando {startItem} a {endItem} de {pagination.total} resultados
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pagination.onPageChange(1)}
                            disabled={pagination.page === 1}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pagination.onPageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-1">
                            <span className="text-sm font-medium">
                                Página {pagination.page} de {totalPages}
                            </span>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pagination.onPageChange(pagination.page + 1)}
                            disabled={pagination.page >= totalPages}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pagination.onPageChange(totalPages)}
                            disabled={pagination.page >= totalPages}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
