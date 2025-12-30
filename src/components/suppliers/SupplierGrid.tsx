'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Building2, Mail, Phone, MapPin, Globe, Star,
    Package, DollarSign, MoreVertical, Edit, Trash2,
    TrendingUp, Calendar, Eye
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
import type { UISupplier } from '@/lib/types/supplier-ui'

interface SupplierCardProps {
    supplier: UISupplier
    onEdit: (supplier: UISupplier) => void
    onDelete: (id: string) => void
    selected?: boolean
    onSelect?: (id: string) => void
}

const statusColors = {
    active: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300',
    inactive: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300',
    suspended: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300'
}

const businessTypeColors = {
    manufacturer: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    distributor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    wholesaler: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    retailer: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
    service_provider: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
}

export function SupplierCard({ supplier, onEdit, onDelete, selected, onSelect }: SupplierCardProps) {
    const router = useRouter()

    const handleViewDetails = () => {
        router.push(`/dashboard/suppliers/${supplier.id}`)
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            onClick={handleViewDetails}
            className={cn(
                "group relative overflow-hidden rounded-xl border-2 bg-card transition-all duration-300 cursor-pointer",
                selected
                    ? "border-primary shadow-lg shadow-primary/20 ring-4 ring-primary/10"
                    : "border-border hover:border-primary/50 hover:shadow-lg"
            )}
        >
            {/* Selection Checkbox */}
            {onSelect && (
                <div className="absolute top-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onSelect(supplier.id)}
                        className="h-5 w-5 rounded border-2 border-border bg-background checked:bg-primary checked:border-primary transition-all cursor-pointer"
                    />
                </div>
            )}

            {/* Actions Menu */}
            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails()}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(supplier)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDelete(supplier.id)}
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
                            <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-foreground truncate mb-1">
                                {supplier.name}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                                {supplier.contact_person}
                            </p>
                        </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={statusColors[supplier.status]}>
                            {supplier.status}
                        </Badge>
                        {supplier.business_type && (
                            <Badge variant="outline" className={businessTypeColors[supplier.business_type]}>
                                {supplier.business_type}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                    {supplier.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{supplier.email}</span>
                        </div>
                    )}
                    {supplier.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4 flex-shrink-0" />
                            <span>{supplier.phone}</span>
                        </div>
                    )}
                    {supplier.city && supplier.country && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{supplier.city}, {supplier.country}</span>
                        </div>
                    )}
                    {supplier.website && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Globe className="h-4 w-4 flex-shrink-0" />
                            <a
                                href={supplier.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate hover:text-primary transition-colors"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {supplier.website.replace(/^https?:\/\//, '')}
                            </a>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Star className="h-4 w-4 text-amber-500" />
                            <span className="text-lg font-bold text-foreground">
                                {supplier.rating || 0}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Package className="h-4 w-4 text-blue-500" />
                            <span className="text-lg font-bold text-foreground">
                                {supplier.total_orders || 0}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Órdenes</p>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <span className="text-lg font-bold text-foreground">
                                ${(supplier.total_amount || 0).toLocaleString()}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                </div>

                {/* Footer */}
                {supplier.created_at && (
                    <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Creado {new Date(supplier.created_at).toLocaleDateString()}</span>
                    </div>
                )}
            </div>

            {/* Hover Gradient Overlay */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 bg-gradient-to-br from-primary via-purple-500 to-pink-500 pointer-events-none" />
        </motion.div>
    )
}

interface SupplierGridProps {
    suppliers: UISupplier[]
    onEdit: (supplier: UISupplier) => void
    onDelete: (id: string) => void
    selectedIds?: string[]
    onSelectionChange?: (ids: string[]) => void
    className?: string
}

export function SupplierGrid({
    suppliers,
    onEdit,
    onDelete,
    selectedIds = [],
    onSelectionChange,
    className
}: SupplierGridProps) {
    const handleSelect = (id: string) => {
        if (!onSelectionChange) return

        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(sid => sid !== id))
        } else {
            onSelectionChange([...selectedIds, id])
        }
    }

    return (
        <div className={cn(
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
            className
        )}>
            {suppliers.map((supplier) => (
                <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    selected={selectedIds.includes(supplier.id)}
                    onSelect={onSelectionChange ? handleSelect : undefined}
                />
            ))}
        </div>
    )
}
