'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit, Trash2, Star, Mail, Phone, MapPin, Building2, ChevronRight, Eye } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { UISupplier } from '@/lib/types/supplier-ui'

interface SupplierListProps {
    suppliers: UISupplier[]
    onEdit: (supplier: UISupplier) => void
    onDelete: (id: string) => void
    loading?: boolean
    selectedIds?: string[]
    onSelectionChange?: (ids: string[]) => void
}

const getStatusColor = (status: string) => {
    const colors = {
        active: 'bg-green-100 text-green-700',
        inactive: 'bg-gray-100 text-gray-700',
        pending: 'bg-yellow-100 text-yellow-700',
        suspended: 'bg-red-100 text-red-700'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700'
}

const getBusinessTypeLabel = (type: string) => {
    const labels = {
        manufacturer: 'Fabricante',
        distributor: 'Distribuidor',
        wholesaler: 'Mayorista',
        service_provider: 'Proveedor',
        retailer: 'Minorista'
    }
    return labels[type as keyof typeof labels] || type
}

const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function SupplierList({ suppliers, onEdit, onDelete, loading, selectedIds = [], onSelectionChange }: SupplierListProps) {
    const router = useRouter()
    const [hoveredRow, setHoveredRow] = useState<string | null>(null)

    const handleSelectAll = (checked: boolean) => {
        if (onSelectionChange) {
            onSelectionChange(checked ? suppliers.map(s => s.id) : [])
        }
    }

    const handleSelectOne = (id: string, checked: boolean) => {
        if (onSelectionChange) {
            onSelectionChange(
                checked
                    ? [...selectedIds, id]
                    : selectedIds.filter(selectedId => selectedId !== id)
            )
        }
    }

    const handleRowClick = (supplier: UISupplier, e: React.MouseEvent) => {
        // Don't navigate if clicking on action buttons or checkbox
        const target = e.target as HTMLElement
        if (target.closest('button') || target.closest('[role="checkbox"]')) {
            return
        }
        router.push(`/dashboard/suppliers/${supplier.id}`)
    }

    if (loading) {
        return (
            <Card className="overflow-hidden">
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-8 w-[200px]" />
                        <Skeleton className="h-8 w-[100px]" />
                    </div>
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center space-x-4">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-[250px]" />
                                    <Skeleton className="h-4 w-[200px]" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
        )
    }

    if (suppliers.length === 0) {
        return (
            <Card className="p-12 flex flex-col items-center justify-center text-center">
                <div className="bg-blue-50 p-4 rounded-full mb-4">
                    <Building2 className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay proveedores encontrados</h3>
                <p className="text-gray-500 max-w-sm mb-6">
                    No se encontraron proveedores que coincidan con tu búsqueda o filtros. Intenta ajustar los criterios.
                </p>
            </Card>
        )
    }

    const allSelected = suppliers.length > 0 && selectedIds.length === suppliers.length
    const someSelected = selectedIds.length > 0 && selectedIds.length < suppliers.length

    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {onSelectionChange && (
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={handleSelectAll}
                                        aria-label="Seleccionar todos"
                                        className={someSelected ? 'data-[state=checked]:bg-blue-600' : ''}
                                    />
                                </TableHead>
                            )}
                            <TableHead>Proveedor</TableHead>
                            <TableHead className="hidden md:table-cell">Contacto</TableHead>
                            <TableHead className="hidden lg:table-cell">Ubicación</TableHead>
                            <TableHead className="hidden xl:table-cell">Tipo</TableHead>
                            <TableHead>Calificación</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {suppliers.map((supplier) => (
                            <TableRow
                                key={supplier.id}
                                className="cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={(e) => handleRowClick(supplier, e)}
                                onMouseEnter={() => setHoveredRow(supplier.id)}
                                onMouseLeave={() => setHoveredRow(null)}
                            >
                                {onSelectionChange && (
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={selectedIds.includes(supplier.id)}
                                            onCheckedChange={(checked) => handleSelectOne(supplier.id, checked as boolean)}
                                            aria-label={`Seleccionar ${supplier.name}`}
                                        />
                                    </TableCell>
                                )}
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarFallback className="bg-blue-100 text-blue-700">
                                                {getInitials(supplier.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-medium flex items-center gap-2">
                                                {supplier.name}
                                                {hoveredRow === supplier.id && (
                                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500">{supplier.contact_person}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Mail className="h-3 w-3 text-gray-400" />
                                            <span className="truncate max-w-[200px]">{supplier.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone className="h-3 w-3 text-gray-400" />
                                            {supplier.phone}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                    <div className="flex items-center gap-2 text-sm">
                                        <MapPin className="h-3 w-3 text-gray-400" />
                                        {supplier.city && supplier.country
                                            ? `${supplier.city}, ${supplier.country}`
                                            : supplier.city || supplier.country || 'N/A'}
                                    </div>
                                </TableCell>
                                <TableCell className="hidden xl:table-cell">
                                    <Badge variant="outline">
                                        {getBusinessTypeLabel(supplier.business_type)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`h-3 w-3 ${i < supplier.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge className={getStatusColor(supplier.status)}>
                                        {supplier.status === 'active' ? 'Activo' :
                                            supplier.status === 'inactive' ? 'Inactivo' :
                                                supplier.status === 'pending' ? 'Pendiente' : 'Suspendido'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEdit(supplier)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDelete(supplier.id)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
    )
}
