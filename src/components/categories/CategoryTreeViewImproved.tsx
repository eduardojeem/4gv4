'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChevronRight, ChevronDown, Tag, Edit, Trash2,
    ToggleLeft, ToggleRight, Package, Plus, Search,
    FolderTree, Folder, FolderOpen, MoreVertical,
    Eye, EyeOff, Calendar, ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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

interface CategoryNode extends Category {
    children: CategoryNode[]
    level: number
    path: string[]
}

interface CategoryTreeNodeProps {
    node: CategoryNode
    onEdit: (category: Category) => void
    onDelete: (id: string) => void
    onToggleActive: (id: string, isActive: boolean) => void
    onAddChild: (parentId: string) => void
    selectedIds?: string[]
    onSelectionChange?: (ids: string[]) => void
    expandedIds: Set<string>
    onToggleExpand: (id: string) => void
    searchTerm: string
}

function CategoryTreeNode({
    node,
    onEdit,
    onDelete,
    onToggleActive,
    onAddChild,
    selectedIds = [],
    onSelectionChange,
    expandedIds,
    onToggleExpand,
    searchTerm
}: CategoryTreeNodeProps) {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedIds.has(node.id)
    const isSelected = selectedIds.includes(node.id)
    
    // Highlight search matches
    const highlightText = (text: string) => {
        if (!searchTerm) return text
        
        const regex = new RegExp(`(${searchTerm})`, 'gi')
        const parts = text.split(regex)
        
        return parts.map((part, index) => 
            regex.test(part) ? (
                <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
                    {part}
                </mark>
            ) : part
        )
    }

    const handleSelect = () => {
        if (!onSelectionChange) return
        
        if (isSelected) {
            onSelectionChange(selectedIds.filter(id => id !== node.id))
        } else {
            onSelectionChange([...selectedIds, node.id])
        }
    }

    const handleToggleExpand = () => {
        if (hasChildren) {
            onToggleExpand(node.id)
        }
    }

    return (
        <div className="relative">
            {/* Connection Lines */}
            {node.level > 0 && (
                <div className="absolute left-6 top-0 bottom-0 w-px bg-border" 
                     style={{ left: `${(node.level - 1) * 24 + 24}px` }} />
            )}
            
            {/* Node */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                    "group relative flex items-center gap-2 py-2 px-3 rounded-lg transition-all duration-200",
                    "hover:bg-muted/50",
                    isSelected && "bg-primary/10 border border-primary/20",
                    node.level > 0 && `ml-${node.level * 6}`
                )}
                style={{ marginLeft: `${node.level * 24}px` }}
            >
                {/* Expand/Collapse Button */}
                <button
                    onClick={handleToggleExpand}
                    className={cn(
                        "flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors",
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

                {/* Selection Checkbox */}
                {onSelectionChange && (
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={handleSelect}
                        className="flex-shrink-0"
                    />
                )}

                {/* Icon */}
                <div className={cn(
                    "flex-shrink-0 rounded-lg p-2 transition-colors",
                    node.is_active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                )}>
                    {hasChildren ? (
                        isExpanded ? (
                            <FolderOpen className="h-4 w-4" />
                        ) : (
                            <Folder className="h-4 w-4" />
                        )
                    ) : (
                        <Tag className="h-4 w-4" />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                            "font-medium truncate",
                            !node.is_active && "text-muted-foreground"
                        )}>
                            {highlightText(node.name)}
                        </span>
                        
                        <div className="flex items-center gap-1">
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-xs",
                                    node.is_active
                                        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300"
                                        : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300"
                                )}
                            >
                                {node.is_active ? (
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
                            
                            {node.level > 0 && (
                                <Badge variant="outline" className="text-xs">
                                    Nivel {node.level}
                                </Badge>
                            )}
                        </div>
                    </div>
                    
                    {/* Description */}
                    {node.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                            {highlightText(node.description)}
                        </p>
                    )}
                    
                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {node.products_count || 0} productos
                        </span>
                        {hasChildren && (
                            <span className="flex items-center gap-1">
                                <FolderTree className="h-3 w-3" />
                                {node.children.length} subcategoría{node.children.length !== 1 ? 's' : ''}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(node.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    
                    {/* Breadcrumb Path */}
                    {node.path.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <span>Ruta:</span>
                            {node.path.map((pathName, index) => (
                                <React.Fragment key={index}>
                                    <span>{pathName}</span>
                                    {index < node.path.length - 1 && (
                                        <ArrowRight className="h-3 w-3" />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onAddChild(node.id)}
                        title="Agregar subcategoría"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(node)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAddChild(node.id)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Agregar subcategoría
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onToggleActive(node.id, node.is_active)}>
                                {node.is_active ? (
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
                                onClick={() => onDelete(node.id)}
                                className="text-red-600 dark:text-red-400"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                        {node.children.map((child) => (
                            <CategoryTreeNode
                                key={child.id}
                                node={child}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onToggleActive={onToggleActive}
                                onAddChild={onAddChild}
                                selectedIds={selectedIds}
                                onSelectionChange={onSelectionChange}
                                expandedIds={expandedIds}
                                onToggleExpand={onToggleExpand}
                                searchTerm={searchTerm}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

interface CategoryTreeViewImprovedProps {
    categories: Category[]
    onEdit: (category: Category) => void
    onDelete: (id: string) => void
    onToggleActive: (id: string, isActive: boolean) => void
    onAddChild: (parentId: string) => void
    selectedIds?: string[]
    onSelectionChange?: (ids: string[]) => void
    className?: string
}

export function CategoryTreeViewImproved({
    categories,
    onEdit,
    onDelete,
    onToggleActive,
    onAddChild,
    selectedIds = [],
    onSelectionChange,
    className
}: CategoryTreeViewImprovedProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    // Build tree structure with enhanced data
    const tree = useMemo(() => {
        const categoryMap = new Map(categories.map(c => [c.id, c]))
        const buildPath = (categoryId: string): string[] => {
            const category = categoryMap.get(categoryId)
            if (!category || !category.parent_id) return []
            
            const parent = categoryMap.get(category.parent_id)
            if (!parent) return []
            
            return [...buildPath(category.parent_id), parent.name]
        }

        const buildNode = (category: Category, level: number = 0): CategoryNode => {
            const children = categories
                .filter(c => c.parent_id === category.id)
                .map(c => buildNode(c, level + 1))
                .sort((a, b) => a.name.localeCompare(b.name))

            return {
                ...category,
                children,
                level,
                path: buildPath(category.id)
            }
        }

        const roots = categories
            .filter(c => !c.parent_id)
            .map(c => buildNode(c))
            .sort((a, b) => a.name.localeCompare(b.name))

        return roots
    }, [categories])

    // Filter tree based on search
    const filteredTree = useMemo(() => {
        if (!searchTerm) return tree

        const filterNode = (node: CategoryNode): CategoryNode | null => {
            const matchesSearch = 
                node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (node.description || '').toLowerCase().includes(searchTerm.toLowerCase())

            const filteredChildren = node.children
                .map(child => filterNode(child))
                .filter(Boolean) as CategoryNode[]

            if (matchesSearch || filteredChildren.length > 0) {
                return {
                    ...node,
                    children: filteredChildren
                }
            }

            return null
        }

        return tree.map(node => filterNode(node)).filter(Boolean) as CategoryNode[]
    }, [tree, searchTerm])

    const handleToggleExpand = (id: string) => {
        const newExpanded = new Set(expandedIds)
        if (newExpanded.has(id)) {
            newExpanded.delete(id)
        } else {
            newExpanded.add(id)
        }
        setExpandedIds(newExpanded)
    }

    const handleExpandAll = () => {
        const allIds = new Set<string>()
        const collectIds = (nodes: CategoryNode[]) => {
            nodes.forEach(node => {
                if (node.children.length > 0) {
                    allIds.add(node.id)
                    collectIds(node.children)
                }
            })
        }
        collectIds(filteredTree)
        setExpandedIds(allIds)
    }

    const handleCollapseAll = () => {
        setExpandedIds(new Set())
    }

    const handleSelectAll = () => {
        if (!onSelectionChange) return

        const allIds: string[] = []
        const collectIds = (nodes: CategoryNode[]) => {
            nodes.forEach(node => {
                allIds.push(node.id)
                collectIds(node.children)
            })
        }
        collectIds(filteredTree)

        if (selectedIds.length === allIds.length) {
            onSelectionChange([])
        } else {
            onSelectionChange(allIds)
        }
    }

    if (categories.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay categorías para mostrar</p>
            </div>
        )
    }

    return (
        <div className={cn("space-y-4", className)}>
            {/* Controls */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar en el árbol..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    {onSelectionChange && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                        >
                            {selectedIds.length > 0 ? 'Deseleccionar todo' : 'Seleccionar todo'}
                        </Button>
                    )}
                    
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExpandAll}
                    >
                        Expandir todo
                    </Button>
                    
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCollapseAll}
                    >
                        Colapsar todo
                    </Button>
                </div>
            </div>

            {/* Tree */}
            <div className="border rounded-lg bg-card p-4 space-y-1">
                {filteredTree.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No se encontraron categorías que coincidan con "{searchTerm}"</p>
                    </div>
                ) : (
                    filteredTree.map(node => (
                        <CategoryTreeNode
                            key={node.id}
                            node={node}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onToggleActive={onToggleActive}
                            onAddChild={onAddChild}
                            selectedIds={selectedIds}
                            onSelectionChange={onSelectionChange}
                            expandedIds={expandedIds}
                            onToggleExpand={handleToggleExpand}
                            searchTerm={searchTerm}
                        />
                    ))
                )}
            </div>

            {/* Summary */}
            {filteredTree.length > 0 && (
                <div className="text-sm text-muted-foreground">
                    Mostrando {filteredTree.length} categoría{filteredTree.length !== 1 ? 's' : ''} raíz
                    {searchTerm && ` que coinciden con "${searchTerm}"`}
                    {selectedIds.length > 0 && ` • ${selectedIds.length} seleccionada${selectedIds.length !== 1 ? 's' : ''}`}
                </div>
            )}
        </div>
    )
}