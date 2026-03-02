'use client'

import React from 'react'
import { motion } from '../ui/motion'
import {
    Tag, Edit, Trash2, MoreVertical, Package,
    ChevronRight, ToggleLeft, ToggleRight, Plus, FolderOpen
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
    onEdit?: (category: Category) => void
    onDelete?: (id: string) => void
    onToggleActive?: (id: string, isActive: boolean) => void
    onAddChild?: (parentId: string) => void
    selected?: boolean
    onSelect?: (id: string) => void
    parentName?: string
}

// Generate a consistent color from a string
function stringToColor(str: string): { bg: string; text: string; border: string; dot: string } {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colors = [
        { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800', dot: 'bg-violet-500' },
        { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' },
        { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
        { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
        { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800', dot: 'bg-rose-500' },
        { bg: 'bg-cyan-50 dark:bg-cyan-950/30', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800', dot: 'bg-cyan-500' },
        { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
        { bg: 'bg-pink-50 dark:bg-pink-950/30', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800', dot: 'bg-pink-500' },
        { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800', dot: 'bg-indigo-500' },
        { bg: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800', dot: 'bg-teal-500' },
    ]
    return colors[Math.abs(hash) % colors.length]
}

export function CategoryCard({
    category,
    onEdit,
    onDelete,
    onToggleActive,
    onAddChild,
    selected,
    onSelect,
    parentName
}: CategoryCardProps) {
    const hasActions = onEdit || onDelete || onToggleActive || onAddChild
    const color = stringToColor(category.name)
    const productCount = category.products_count ?? category.stats?.product_count ?? 0

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.18 }}
            className={cn(
                "group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 cursor-default",
                selected
                    ? "border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40 hover:shadow-md"
            )}
        >
            {/* Color accent top bar */}
            <div className={cn("h-1.5 w-full", color.dot)} />

            {/* Selection Checkbox */}
            {onSelect && (
                <div className="absolute top-4 left-4 z-10">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onSelect(category.id)}
                        className="h-4 w-4 rounded border-2 border-border bg-background checked:bg-primary checked:border-primary transition-all cursor-pointer"
                    />
                </div>
            )}

            {/* Actions Menu */}
            {hasActions && (
                <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/90 backdrop-blur-sm border border-border/50 shadow-sm">
                                <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            {onEdit && (
                                <DropdownMenuItem onClick={() => onEdit(category)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                </DropdownMenuItem>
                            )}
                            {onAddChild && (
                                <DropdownMenuItem onClick={() => onAddChild(category.id)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Añadir subcategoría
                                </DropdownMenuItem>
                            )}
                            {onToggleActive && (
                                <DropdownMenuItem onClick={() => onToggleActive(category.id, category.is_active)}>
                                    {category.is_active ? (
                                        <><ToggleLeft className="h-4 w-4 mr-2" />Desactivar</>
                                    ) : (
                                        <><ToggleRight className="h-4 w-4 mr-2" />Activar</>
                                    )}
                                </DropdownMenuItem>
                            )}
                            {(onEdit || onAddChild || onToggleActive) && onDelete && <DropdownMenuSeparator />}
                            {onDelete && (
                                <DropdownMenuItem
                                    onClick={() => onDelete(category.id)}
                                    className="text-red-600 dark:text-red-400 focus:text-red-600"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            {/* Card Content */}
            <div className="p-5">
                {/* Icon + Name */}
                <div className="flex items-start gap-3 mb-3">
                    <div className={cn("rounded-xl p-2.5 shrink-0", color.bg)}>
                        <FolderOpen className={cn("h-5 w-5", color.text)} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className={cn(
                            "font-semibold text-base leading-tight truncate",
                            !category.is_active && "text-muted-foreground"
                        )}>
                            {category.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {category.description || 'Sin descripción'}
                        </p>
                    </div>
                </div>

                {/* Parent badge */}
                {parentName && (
                    <div className="mb-3">
                        <Badge variant="outline" className="text-xs bg-muted/50 border-border gap-1">
                            <ChevronRight className="h-2.5 w-2.5" />
                            {parentName}
                        </Badge>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Package className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">{productCount}</span>
                        <span>productos</span>
                    </div>

                    <Badge
                        variant="outline"
                        className={cn(
                            "text-xs px-2 py-0",
                            category.is_active
                                ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800"
                                : "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900 dark:text-gray-500 dark:border-gray-700"
                        )}
                    >
                        <span className={cn("mr-1 h-1.5 w-1.5 rounded-full inline-block", category.is_active ? "bg-green-500" : "bg-gray-400")} />
                        {category.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                </div>
            </div>

            {/* Subtle hover overlay */}
            <div className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                "bg-gradient-to-br from-transparent to-black/[0.02] dark:to-white/[0.02]"
            )} />
        </motion.div>
    )
}

interface CategoryGridProps {
    categories: Category[]
    onEdit?: (category: Category) => void
    onDelete?: (id: string) => void
    onToggleActive?: (id: string, isActive: boolean) => void
    onAddChild?: (parentId: string) => void
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
    onAddChild,
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
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
            className
        )}>
            {categories.map((category) => (
                <CategoryCard
                    key={category.id}
                    category={category}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleActive={onToggleActive}
                    onAddChild={onAddChild}
                    selected={selectedIds.includes(category.id)}
                    onSelect={onSelectionChange ? handleSelect : undefined}
                    parentName={category.parent_id && getCategoryName ? getCategoryName(category.parent_id) : undefined}
                />
            ))}
        </div>
    )
}
