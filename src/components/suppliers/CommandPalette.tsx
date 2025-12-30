'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Command, Search, Building2, Plus, Download, Filter,
    Settings, Users, Package, TrendingUp, FileText, X
} from 'lucide-react'
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CommandItem {
    id: string
    label: string
    description?: string
    icon: React.ElementType
    action: () => void
    category: 'navigation' | 'actions' | 'filters' | 'settings'
    keywords?: string[]
    badge?: string
}

interface CommandPaletteProps {
    isOpen: boolean
    onClose: () => void
    commands: CommandItem[]
}

const categoryLabels = {
    navigation: 'Navegación',
    actions: 'Acciones',
    filters: 'Filtros',
    settings: 'Configuración'
}

const categoryColors = {
    navigation: 'text-blue-600 dark:text-blue-400',
    actions: 'text-green-600 dark:text-green-400',
    filters: 'text-purple-600 dark:text-purple-400',
    settings: 'text-amber-600 dark:text-amber-400'
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
    const [search, setSearch] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Filter commands based on search
    const filteredCommands = React.useMemo(() => {
        if (!search) return commands

        const searchLower = search.toLowerCase()
        return commands.filter(cmd => {
            const labelMatch = cmd.label.toLowerCase().includes(searchLower)
            const descMatch = cmd.description?.toLowerCase().includes(searchLower)
            const keywordsMatch = cmd.keywords?.some(k => k.toLowerCase().includes(searchLower))
            return labelMatch || descMatch || keywordsMatch
        })
    }, [commands, search])

    // Group commands by category
    const groupedCommands = React.useMemo(() => {
        const groups: Record<string, CommandItem[]> = {}
        filteredCommands.forEach(cmd => {
            if (!groups[cmd.category]) {
                groups[cmd.category] = []
            }
            groups[cmd.category].push(cmd)
        })
        return groups
    }, [filteredCommands])

    // Reset selection when search changes
    useEffect(() => {
        setSelectedIndex(0)
    }, [search])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return

            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
            } else if (e.key === 'Enter') {
                e.preventDefault()
                const command = filteredCommands[selectedIndex]
                if (command) {
                    command.action()
                    onClose()
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, selectedIndex, filteredCommands, onClose])

    // Reset state when closing
    useEffect(() => {
        if (!isOpen) {
            setSearch('')
            setSelectedIndex(0)
        }
    }, [isOpen])

    const handleCommandClick = (command: CommandItem) => {
        command.action()
        onClose()
    }

    let currentIndex = 0

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                >
                    {/* Search Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b">
                        <Search className="h-5 w-5 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar comandos..."
                            className="flex-1 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            autoFocus
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Esc</kbd>
                            <span>para cerrar</span>
                        </div>
                    </div>

                    {/* Commands List */}
                    <div className="max-h-[400px] overflow-y-auto p-2">
                        {Object.keys(groupedCommands).length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-sm text-muted-foreground">
                                    No se encontraron comandos
                                </p>
                            </div>
                        ) : (
                            Object.entries(groupedCommands).map(([category, items]) => (
                                <div key={category} className="mb-4 last:mb-0">
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {categoryLabels[category as keyof typeof categoryLabels]}
                                    </div>
                                    <div className="space-y-1">
                                        {items.map((command) => {
                                            const itemIndex = currentIndex++
                                            const isSelected = itemIndex === selectedIndex

                                            return (
                                                <motion.button
                                                    key={command.id}
                                                    onClick={() => handleCommandClick(command)}
                                                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                                                        isSelected
                                                            ? "bg-primary text-primary-foreground"
                                                            : "hover:bg-muted"
                                                    )}
                                                    whileHover={{ x: 4 }}
                                                    transition={{ duration: 0.15 }}
                                                >
                                                    <command.icon className={cn(
                                                        "h-4 w-4 flex-shrink-0",
                                                        isSelected ? "text-primary-foreground" : categoryColors[command.category]
                                                    )} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm truncate">
                                                            {command.label}
                                                        </div>
                                                        {command.description && (
                                                            <div className={cn(
                                                                "text-xs truncate",
                                                                isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                                                            )}>
                                                                {command.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {command.badge && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {command.badge}
                                                        </Badge>
                                                    )}
                                                </motion.button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-background rounded text-xs font-mono">↑↓</kbd>
                                <span>navegar</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-background rounded text-xs font-mono">↵</kbd>
                                <span>seleccionar</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Command className="h-3 w-3" />
                            <span>K para abrir</span>
                        </div>
                    </div>
                </motion.div>
            </DialogContent>
        </Dialog>
    )
}

// Hook for using Command Palette
export function useCommandPalette() {
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(prev => !prev)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(prev => !prev)
    }
}
