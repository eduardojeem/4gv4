'use client'

import React, { useState } from 'react'
import { motion  } from '../ui/motion'
import {
    Tag, Edit, Trash2, MoreVertical, Package,
    ChevronRight, ToggleLeft, ToggleRight, ArrowUpDown,
    Calendar, User, Eye, EyeOff, Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { Category as BaseCategory } from '@/hooks/useCategories'

interface Category extends BaseCategory {
    products_count?: number
}

interface CategoryListViewProps {
    categories: Category[]
    onEdit: (category: Category) => void
    onDelete: (id: string) => void
    onToggleActive: (id: string, isActive: boolean) => void
    selectedIds?: string[]
    onSelectionChange?: (ids: string[]) => void
    getCategoryName?: (id: string) => string
    onAddChild?: (parentId: string) => void
    className?: string
}

type SortField = 'name' | 'created_at' | 'products_count' | 'is_active'
type SortDirection = 'asc' | 'desc'

export function CategoryListView({
    categories,
    onEdit,
    onDelete,
    onToggleActive,
    selectedIds = [],
    onSelectionChange,
    getCategoryName,
    onAddChild,
    className
}: CategoryListViewProps) {
    const [sortField, setSortField] = useState<SortField>('name')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    const sortedCategories = React.useMemo(() => {
        return [...categories].sort((a, b) => {
            let aValue: any = a[sortField]
            let bValue: any = b[sortField]

            // Handle special cases
            if (sortField === 'products_count') {
                aValue = a.products_count || 0
                bValue = b.products_count || 0
            } else if (sortField === 'created_at') {
                aValue = new Date(a.created_at).getTime()
                bValue = new Date(b.created_at).getTime()
            } else if (sortField === 'is_active') {
                aValue = a.is_active ? 1 : 0
                bValue = b.is_active ? 1 : 0
            } else if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase()
                bValue = bValue.toLowerCase()
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
            return 0
        })
    }, [categories, sortField, sortDirection])

    const handleSelect = (id: string) => {
        if (!onSelectionChange) return

        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(cid => cid !== id))
        } else {
            onSelectionChange([...selectedIds, id])
        }
    }

    const handleSelectAll = () => {
        if (!onSelectionChange) return

        if (selectedIds.length === categories.length) {
            onSelectionChange([])
        } else {
            onSelectionChange(categories.map(c => c.id))
        }
    }

    const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
        <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 font-medium"
            onClick={() => handleSort(field)}
        >
            {children}
            <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
    )

    return (
        <div className={cn("rounded-lg border bg-card", className)}>
            <Table>
                <TableHeader>
                    <TableRow>
                        {onSelectionChange && (
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={selectedIds.length === categories.length && categories.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                        )}
                        <TableHead>
                            <SortButton field="name">Nombre</SortButton>
                        </TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Categoría Padre</TableHead>
                        <TableHead>
                            <SortButton field="is_active">Estado</SortButton>
                        </TableHead>
                        <TableHead>
                            <SortButton field="products_count">Productos</SortButton>
                        </TableHead>
                        <TableHead>
                            <SortButton field="created_at">Creado</SortButton>
                        </TableHead>
                        <TableHead className="w-12">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedCategories.map((category, index) => (
                        <motion.tr
                            key={category.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                                "group hover:bg-muted/50 transition-colors",
                                selectedIds.includes(category.id) && "bg-primary/5"
                            )}
                        >
                            {onSelectionChange && (
                                <TableCell>
                                    <Checkbox
                                        checked={selectedIds.includes(category.id)}
                                        onCheckedChange={() => handleSelect(category.id)}
                                    />
                                </TableCell>
                            )}
                            
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "rounded-lg p-2",
                                        category.is_active
                                            ? "bg-primary/10 text-primary"
                                            : "bg-muted text-muted-foreground"
                                    )}>
                                        <Tag className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className={cn(
                                            "font-medium",
                                            !category.is_active && "text-muted-foreground"
                                        )}>
                                            {category.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            ID: {category.id.slice(0, 8)}...
                                        </div>
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell>
                                <div className="max-w-xs">
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {category.description || 'Sin descripción'}
                                    </p>
                                </div>
                            </TableCell>

                            <TableCell>
                                {category.parent_id && getCategoryName ? (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                                        <ChevronRight className="h-3 w-3 mr-1" />
                                        {getCategoryName(category.parent_id)}
                                    </Badge>
                                ) : (
                                    <span className="text-muted-foreground text-sm">Raíz</span>
                                )}
                            </TableCell>

                            <TableCell>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        category.is_active
                                            ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300"
                                            : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300"
                                    )}
                                >
                                    {category.is_active ? (
                                        <>
                                            <Eye className="h-3 w-3 mr-1" />
                                            Activa
                                        </>
                                    ) : (
                                        <>
                                            <EyeOff className="h-3 w-3 mr-1" />
                                            Inactiva
                                        </>
                                    )}
                                </Badge>
                            </TableCell>

                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{category.products_count || 0}</span>
                                </div>
                            </TableCell>

                            <TableCell>
                                <div className="text-sm">
                                    <div className="font-medium">
                                        {new Date(category.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="text-muted-foreground">
                                        {new Date(category.created_at).toLocaleTimeString([], { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell>
                                {(onEdit || onAddChild || onToggleActive || onDelete) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {onEdit && (
                                            <DropdownMenuItem onClick={() => onEdit(category)}>
                                                <Edit className="h-4 w-4 mr-2" />
                                                Editar
                                            </DropdownMenuItem>
                                        )}
                                        {onAddChild && (
                                            <DropdownMenuItem onClick={() => onAddChild(category.id)}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Agregar subcategoría
                                            </DropdownMenuItem>
                                        )}
                                        {onToggleActive && (
                                            <DropdownMenuItem onClick={() => onToggleActive(category.id, category.is_active)}>
                                                {category.is_active ? (
                                                    <>
                                                        <ToggleLeft className="h-4 w-4 mr-2" />
                                                        Desactivar
                                                    </>
                                                ) : (
                                                    <>
                                                        <ToggleRight className="h-4 w-4 mr-2" />
                                                        Activar
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                        )}
                                        {(onEdit || onAddChild || onToggleActive) && onDelete && <DropdownMenuSeparator />}
                                        {onDelete && (
                                            <DropdownMenuItem
                                                onClick={() => onDelete(category.id)}
                                                className="text-red-600 dark:text-red-400"
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Eliminar
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                )}
                            </TableCell>
                        </motion.tr>
                    ))}
                </TableBody>
            </Table>

            {categories.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay categorías para mostrar</p>
                </div>
            )}
        </div>
    )
}