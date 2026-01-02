'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence  } from '../ui/motion'
import {
    ChevronRight, ChevronDown, Tag, Edit, Trash2,
    ToggleLeft, ToggleRight, Package, Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Category as BaseCategory } from '@/hooks/useCategories'

interface Category extends BaseCategory {
    products_count?: number
}

interface CategoryTreeNodeProps {
    category: Category
    children: Category[]
    level: number
    onEdit: (category: Category) => void
    onDelete: (id: string) => void
    onToggleActive: (id: string, isActive: boolean) => void
    onAddChild: (parentId: string) => void
}

function CategoryTreeNode({
    category,
    children,
    level,
    onEdit,
    onDelete,
    onToggleActive,
    onAddChild
}: CategoryTreeNodeProps) {
    const [isExpanded, setIsExpanded] = useState(true)
    const hasChildren = children.length > 0

    return (
        <div className="relative">
            {/* Node */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                    "group flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors",
                    level > 0 && "ml-6"
                )}
            >
                {/* Expand/Collapse Button */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors",
                        !hasChildren && "invisible"
                    )}
                >
                    {hasChildren && (
                        isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                    )}
                </button>

                {/* Icon */}
                <div className={cn(
                    "flex-shrink-0 rounded-lg p-2",
                    category.is_active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                )}>
                    <Tag className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "font-medium truncate",
                            !category.is_active && "text-muted-foreground"
                        )}>
                            {category.name}
                        </span>
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-xs",
                                category.is_active
                                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300"
                                    : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300"
                            )}
                        >
                            {category.is_active ? 'Activa' : 'Inactiva'}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {category.products_count || 0} productos
                        </span>
                        {hasChildren && (
                            <span>{children.length} subcategoría{children.length !== 1 ? 's' : ''}</span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onAddChild(category.id)}
                        title="Agregar subcategoría"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(category)}
                        title="Editar"
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onToggleActive(category.id, category.is_active)}
                        title={category.is_active ? 'Desactivar' : 'Activar'}
                    >
                        {category.is_active ? (
                            <ToggleLeft className="h-4 w-4" />
                        ) : (
                            <ToggleRight className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => onDelete(category.id)}
                        title="Eliminar"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </motion.div>

            {/* Children */}
            <AnimatePresence>
                {isExpanded && hasChildren && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {children.map((child) => (
                            <CategoryTreeNode
                                key={child.id}
                                category={child}
                                children={[]} // Will be populated by parent
                                level={level + 1}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onToggleActive={onToggleActive}
                                onAddChild={onAddChild}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

interface CategoryTreeProps {
    categories: Category[]
    onEdit: (category: Category) => void
    onDelete: (id: string) => void
    onToggleActive: (id: string, isActive: boolean) => void
    onAddChild: (parentId: string) => void
    className?: string
}

export function CategoryTree({
    categories,
    onEdit,
    onDelete,
    onToggleActive,
    onAddChild,
    className
}: CategoryTreeProps) {
    // Build tree structure
    const buildTree = () => {
        const categoryMap = new Map(categories.map(c => [c.id, { ...c, children: [] as Category[] }]))
        const roots: Category[] = []

        categories.forEach(category => {
            const node = categoryMap.get(category.id)
            if (!node) return

            if (category.parent_id) {
                const parent = categoryMap.get(category.parent_id)
                if (parent) {
                    parent.children = parent.children || []
                    parent.children.push(node)
                } else {
                    roots.push(node)
                }
            } else {
                roots.push(node)
            }
        })

        return roots
    }

    const tree = buildTree()

    const renderNode = (category: Category & { children?: Category[] }, level = 0): React.ReactNode => {
        return (
            <CategoryTreeNode
                key={category.id}
                category={category}
                children={category.children || []}
                level={level}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleActive={onToggleActive}
                onAddChild={onAddChild}
            />
        )
    }

    if (categories.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay categorías para mostrar</p>
            </div>
        )
    }

    return (
        <div className={cn("space-y-1", className)}>
            {tree.map(category => renderNode(category))}
        </div>
    )
}
