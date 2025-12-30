'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
    Tag, Edit, Trash2, MoreVertical, Package,
    ChevronRight, ToggleLeft, ToggleRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Category as BaseCategory } from '@/hooks/useCategories'

interface Category extends BaseCategory {
    products_count?: number
}

interface CategoryCardProps {
    category: Category
    onEdit: (category: Category) => void
    onDelete: (id: string) => void
    onToggleActive: (id: string, isActive: boolean) => void
    selected?: boolean
    onSelect?: (id: string) => void
    parentName?: string
}

const statusColors = {
    active: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300',
    inactive: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300'
}

export function CategoryCard({
    category,
    onEdit,
    onDelete,
    onToggleActive,
    selected,
    onSelect,
    parentName
}: CategoryCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className={cn(
                "group relative overflow-hidden rounded-xl border-2 bg-card transition-all duration-300",
                selected
                    ? "border-primary shadow-lg shadow-primary/20 ring-4 ring-primary/10"
                    : "border-border hover:border-primary/50 hover:shadow-lg"
            )}
        >
            {/* Selection Checkbox */}
            {onSelect && (
                <div className="absolute top-4 left-4 z-10">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onSelect(category.id)}
                        className="h-5 w-5 rounded border-2 border-border bg-background checked:bg-primary checked:border-primary transition-all cursor-pointer"
                    />
                </div>
            )}

            {/* Actions Menu */}
            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(category)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                        </DropdownMenuItem>
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDelete(category.id)}
                            className="text-red-600 dark:text-red-400"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Card Content */}
            <div className="p-6">
                {/* Header */}
                <div className="mb-4">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Tag className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-foreground truncate mb-1">
                                {category.name}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {category.description || 'Sin descripción'}
                            </p>
                        </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                        <Badge
                            variant="outline"
                            className={statusColors[category.is_active ? 'active' : 'inactive']}
                        >
                            {category.is_active ? 'Activa' : 'Inactiva'}
                        </Badge>
                        {parentName && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                                <ChevronRight className="h-3 w-3 mr-1" />
                                {parentName}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Package className="h-4 w-4" />
                            <span>{category.products_count || 0} productos</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {new Date(category.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Hover Gradient Overlay */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 bg-gradient-to-br from-primary via-purple-500 to-pink-500 pointer-events-none" />
        </motion.div>
    )
}

interface CategoryGridProps {
    categories: Category[]
    onEdit: (category: Category) => void
    onDelete: (id: string) => void
    onToggleActive: (id: string, isActive: boolean) => void
    selectedIds?: string[]
    onSelectionChange?: (ids: string[]) => void
    getCategoryName?: (id: string) => string
    className?: string
}

export function CategoryGrid({
    categories,
    onEdit,
    onDelete,
    onToggleActive,
    selectedIds = [],
    onSelectionChange,
    getCategoryName,
    className
}: CategoryGridProps) {
    const handleSelect = (id: string) => {
        if (!onSelectionChange) return

        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(cid => cid !== id))
        } else {
            onSelectionChange([...selectedIds, id])
        }
    }

    return (
        <div className={cn(
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
            className
        )}>
            {categories.map((category) => (
                <CategoryCard
                    key={category.id}
                    category={category}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleActive={onToggleActive}
                    selected={selectedIds.includes(category.id)}
                    onSelect={onSelectionChange ? handleSelect : undefined}
                    parentName={category.parent_id && getCategoryName ? getCategoryName(category.parent_id) : undefined}
                />
            ))}
        </div>
    )
}
