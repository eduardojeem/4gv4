'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { LucideIcon, PackageX, Search, Filter, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
    icon?: LucideIcon
    title: string
    description: string
    action?: {
        label: string
        onClick: () => void
        icon?: LucideIcon
    }
    className?: string
}

export function EmptyState({
    icon: Icon = PackageX,
    title,
    description,
    action,
    className
}: EmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={cn(
                "flex flex-col items-center justify-center py-16 px-4 text-center",
                className
            )}
        >
            {/* Icon */}
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mb-6 rounded-full bg-muted/50 p-8"
            >
                <Icon className="h-16 w-16 text-muted-foreground" />
            </motion.div>

            {/* Title */}
            <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-foreground mb-2"
            >
                {title}
            </motion.h3>

            {/* Description */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground max-w-md mb-8"
            >
                {description}
            </motion.p>

            {/* Action Button */}
            {action && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Button onClick={action.onClick} size="lg" className="gap-2">
                        {action.icon && <action.icon className="h-5 w-5" />}
                        {action.label}
                    </Button>
                </motion.div>
            )}
        </motion.div>
    )
}

// Preset Empty States
export function NoSuppliersFound({ onAddSupplier }: { onAddSupplier: () => void }) {
    return (
        <EmptyState
            icon={PackageX}
            title="No se encontraron proveedores"
            description="Comienza agregando tu primer proveedor para gestionar tus relaciones comerciales."
            action={{
                label: "Agregar Proveedor",
                onClick: onAddSupplier,
                icon: Plus
            }}
        />
    )
}

export function NoSearchResults({ onClearFilters }: { onClearFilters: () => void }) {
    return (
        <EmptyState
            icon={Search}
            title="No se encontraron resultados"
            description="No pudimos encontrar proveedores que coincidan con tu búsqueda. Intenta ajustar los filtros."
            action={{
                label: "Limpiar Filtros",
                onClick: onClearFilters,
                icon: Filter
            }}
        />
    )
}

export function NoFilterResults() {
    return (
        <EmptyState
            icon={Filter}
            title="Sin resultados"
            description="No hay proveedores que coincidan con los filtros seleccionados."
        />
    )
}
