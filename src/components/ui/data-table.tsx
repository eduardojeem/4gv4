"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    ArrowUpDown, ArrowUp, ArrowDown, Search
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
    key: string
    label: string
    sortable?: boolean
    render?: (item: T) => React.ReactNode
    className?: string
}

export interface DataTableProps<T> {
    data: T[]
    columns: Column<T>[]
    keyExtractor: (item: T) => string
    pageSize?: number
    searchable?: boolean
    searchPlaceholder?: string
    onRowClick?: (item: T) => void
    emptyState?: React.ReactNode
    className?: string
}

type SortDirection = 'asc' | 'desc' | null

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    keyExtractor,
    pageSize = 10,
    searchable = true,
    searchPlaceholder = 'Buscar...',
    onRowClick,
    emptyState,
    className
}: DataTableProps<T>) {
    const [currentPage, setCurrentPage] = useState(1)
    const [searchTerm, setSearchTerm] = useState('')
    const [sortColumn, setSortColumn] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<SortDirection>(null)

    // Filter data based on search
    const filteredData = searchable && searchTerm
        ? data.filter(item => {
            const searchLower = searchTerm.toLowerCase()
            return Object.values(item).some(value =>
                String(value).toLowerCase().includes(searchLower)
            )
        })
        : data

    // Sort data
    const sortedData = sortColumn && sortDirection
        ? [...filteredData].sort((a, b) => {
            const aVal = a[sortColumn]
            const bVal = b[sortColumn]

            if (aVal === bVal) return 0

            const comparison = aVal > bVal ? 1 : -1
            return sortDirection === 'asc' ? comparison : -comparison
        })
        : filteredData

    // Paginate data
    const totalPages = Math.ceil(sortedData.length / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const paginatedData = sortedData.slice(startIndex, startIndex + pageSize)

    const handleSort = (columnKey: string) => {
        if (sortColumn === columnKey) {
            // Cycle through: asc -> desc -> null
            if (sortDirection === 'asc') {
                setSortDirection('desc')
            } else if (sortDirection === 'desc') {
                setSortDirection(null)
                setSortColumn(null)
            }
        } else {
            setSortColumn(columnKey)
            setSortDirection('asc')
        }
    }

    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    }

    const SortIcon = ({ column }: { column: string }) => {
        if (sortColumn !== column) {
            return <ArrowUpDown className="h-4 w-4 opacity-50" />
        }
        if (sortDirection === 'asc') {
            return <ArrowUp className="h-4 w-4" />
        }
        return <ArrowDown className="h-4 w-4" />
    }

    return (
        <div className={cn('space-y-4', className)}>
            {/* Search */}
            {searchable && (
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            setCurrentPage(1) // Reset to first page on search
                        }}
                        className="pl-9"
                    />
                </div>
            )}

            {/* Table */}
            <div className="rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        className={cn(
                                            'text-left p-4 font-semibold text-sm',
                                            column.sortable && 'cursor-pointer select-none hover:bg-muted/80 transition-colors',
                                            column.className
                                        )}
                                        onClick={() => column.sortable && handleSort(column.key)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {column.label}
                                            {column.sortable && <SortIcon column={column.key} />}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="p-8 text-center">
                                        {emptyState || (
                                            <div className="text-muted-foreground">
                                                No se encontraron resultados
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((item) => (
                                    <tr
                                        key={keyExtractor(item)}
                                        onClick={() => onRowClick?.(item)}
                                        className={cn(
                                            'border-b transition-colors',
                                            onRowClick && 'cursor-pointer hover:bg-muted/50'
                                        )}
                                    >
                                        {columns.map((column) => (
                                            <td key={column.key} className={cn('p-4', column.className)}>
                                                {column.render ? column.render(item) : item[column.key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Mostrando {startIndex + 1} a {Math.min(startIndex + pageSize, sortedData.length)} de {sortedData.length} resultados
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(1)}
                            disabled={currentPage === 1}
                            aria-label="Primera página"
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            aria-label="Página anterior"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-1">
                            <span className="text-sm">
                                Página {currentPage} de {totalPages}
                            </span>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            aria-label="Página siguiente"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(totalPages)}
                            disabled={currentPage === totalPages}
                            aria-label="Última página"
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
