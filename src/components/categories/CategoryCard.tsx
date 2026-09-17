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

interface CategoryColorTheme {
    bar: string
    iconBg: string
    iconText: string
    glow: string
}

const CATEGORY_PALETTES: CategoryColorTheme[] = [
    {
        bar: 'from-indigo-500 via-blue-500 to-indigo-600',
        iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20 dark:border-indigo-500/30',
        iconText: 'text-indigo-600 dark:text-indigo-400',
        glow: 'group-hover:border-indigo-500/40 dark:group-hover:border-indigo-400/40',
    },
    {
        bar: 'from-emerald-500 via-teal-500 to-emerald-600',
        iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20 dark:border-emerald-500/30',
        iconText: 'text-emerald-600 dark:text-emerald-400',
        glow: 'group-hover:border-emerald-500/40 dark:group-hover:border-emerald-400/40',
    },
    {
        bar: 'from-purple-500 via-violet-500 to-purple-600',
        iconBg: 'bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/20 dark:border-purple-500/30',
        iconText: 'text-purple-600 dark:text-purple-400',
        glow: 'group-hover:border-purple-500/40 dark:group-hover:border-purple-400/40',
    },
    {
        bar: 'from-amber-500 via-orange-400 to-amber-600',
        iconBg: 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20 dark:border-amber-500/30',
        iconText: 'text-amber-600 dark:text-amber-400',
        glow: 'group-hover:border-amber-500/40 dark:group-hover:border-amber-400/40',
    },
    {
        bar: 'from-sky-500 via-cyan-500 to-blue-500',
        iconBg: 'bg-sky-500/10 dark:bg-sky-500/20 border-sky-500/20 dark:border-sky-500/30',
        iconText: 'text-sky-600 dark:text-sky-400',
        glow: 'group-hover:border-sky-500/40 dark:group-hover:border-sky-400/40',
    },
    {
        bar: 'from-rose-500 via-pink-500 to-rose-600',
        iconBg: 'bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/20 dark:border-rose-500/30',
        iconText: 'text-rose-600 dark:text-rose-400',
        glow: 'group-hover:border-rose-500/40 dark:group-hover:border-rose-400/40',
    },
]

// Generate a consistent cohesive luxury color from a string
function stringToColor(str: string): CategoryColorTheme {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return CATEGORY_PALETTES[Math.abs(hash) % CATEGORY_PALETTES.length]
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
                "group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 cursor-default shadow-2xs",
                selected
                    ? "border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/20"
                    : cn("border-border/70 hover:shadow-md", color.glow)
            )}
        >
            {/* Color accent top bar */}
            <div className={cn("h-1 w-full bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity", color.bar)} />

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
                    <div className={cn("rounded-2xl p-2.5 shrink-0 border shadow-2xs transition-transform duration-200 group-hover:scale-105", color.iconBg)}>
                        <FolderOpen className={cn("h-5 w-5", color.iconText)} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className={cn(
                            "font-bold text-base leading-tight truncate text-foreground",
                            !category.is_active && "text-muted-foreground"
                        )}>
                            {category.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {category.description || 'Sin descripción'}
                        </p>
                    </div>
                </div>

                {/* Parent badge */}
                {parentName && (
                    <div className="mb-3">
                        <Badge variant="outline" className="text-xs bg-muted/50 border-border/80 gap-1 text-muted-foreground font-medium">
                            <ChevronRight className="h-2.5 w-2.5" />
                            {parentName}
                        </Badge>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3.5 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40">
                        <Package className="h-3.5 w-3.5 text-primary/70" />
                        <span className="font-bold text-foreground tabular-nums">{productCount}</span>
                        <span>{productCount === 1 ? 'producto' : 'productos'}</span>
                    </div>

                    <Badge
                        variant="outline"
                        className={cn(
                            "text-xs px-2.5 py-0.5 font-semibold transition-colors",
                            category.is_active
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                                : "bg-muted text-muted-foreground border-border/80"
                        )}
                    >
                        <span className={cn(
                            "mr-1.5 h-1.5 w-1.5 rounded-full inline-block",
                            category.is_active ? "bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                        )} />
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
