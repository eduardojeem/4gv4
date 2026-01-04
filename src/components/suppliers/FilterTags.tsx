'use client'

import React from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from '../ui/motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface FilterTag {
    id: string
    label: string
    value: string
    color?: 'blue' | 'green' | 'purple' | 'amber' | 'red'
}

interface FilterTagsProps {
    tags: FilterTag[]
    onRemove: (id: string) => void
    onClearAll?: () => void
    className?: string
}

const colorVariants = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    green: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
    purple: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
    amber: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    red: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800'
}

export function FilterTags({ tags, onRemove, onClearAll, className }: FilterTagsProps) {
    if (tags.length === 0) return null

    return (
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
            <span className="text-sm font-medium text-muted-foreground">
                Filtros activos:
            </span>

            <AnimatePresence mode="popLayout">
                {tags.map((tag) => (
                    <motion.div
                        key={tag.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                    >
                        <Badge
                            variant="outline"
                            className={cn(
                                "gap-1.5 pr-1 transition-all duration-200",
                                tag.color ? colorVariants[tag.color] : "bg-muted hover:bg-muted/80"
                            )}
                        >
                            <span className="text-xs font-medium">
                                {tag.label}: <span className="font-semibold">{tag.value}</span>
                            </span>
                            <button
                                onClick={() => onRemove(tag.id)}
                                className="ml-1 rounded-sm p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    </motion.div>
                ))}
            </AnimatePresence>

            {tags.length > 1 && onClearAll && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearAll}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                        Limpiar todo
                    </Button>
                </motion.div>
            )}
        </div>
    )
}
