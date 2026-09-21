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
    onEdit?: (category: Category) => void
    onDelete?: (id: string) => void
    onToggleActive?: (id: string, isActive: boolean) => void
    selectedIds?: string[]
    onSelectionChange?: (ids: string[]) => void
    getCategoryName?: (id: string) => string
    onAddChild?: (parentId: string) => void
    className?: string
}

type SortField = 'name' | 'created_at' | 'products_count' | 'is_active'
type SortDirection = 'asc' | 'desc'

function SortButton({ field, children, onSort }: {
    field: SortField
    children: React.ReactNode
    onSort: (field: SortField) => void
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 font-medium"
            onClick={() => onSort(field)}
        >
            {children}
            <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
    )
}

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
    const hasActions = Boolean(onEdit || onAddChild || onToggleActive || onDelete)

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
                            <SortButton field="name" onSort={handleSort}>Nombre</SortButton>
                        </TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Categoría Padre</TableHead>
                        <TableHead>
                            <SortButton field="is_active" onSort={handleSort}>Estado</SortButton>
                        </TableHead>
                        <TableHead>
                            <SortButton field="products_count" onSort={handleSort}>Productos</SortButton>
                        </TableHead>
                        <TableHead>
                            <SortButton field="created_at" onSort={handleSort}>Creado</SortButton>
                        </TableHead>
                        {hasActions && <TableHead className="w-12">Acciones</TableHead>}
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
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold gap-1">
                                        <ChevronRight className="h-3 w-3" />
                                        {getCategoryName(category.parent_id)}
                                    </Badge>
                                ) : (
                                    <span className="text-muted-foreground text-xs font-medium bg-muted/50 px-2 py-0.5 rounded-md border border-border/40">
                                        Raíz
                                    </span>
                                )}
                            </TableCell>

                            <TableCell>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-xs px-2.5 py-0.5 font-semibold transition-colors",
                                        category.is_active
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                                            : "bg-muted text-muted-foreground border-border/80"
                                    )}
                                >
                                    {category.is_active ? (
                                        <>
                                            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse" />
                                            Activa
                                        </>
                                    ) : (
                                        <>
                                            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
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

                            {hasActions && (
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
                            )}
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

