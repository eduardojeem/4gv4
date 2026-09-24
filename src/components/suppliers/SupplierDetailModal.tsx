'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Building2, Mail, Phone, MapPin, Globe, Star,
  Package, DollarSign, Edit, Plus, ExternalLink,
  MessageCircle, Tag, CheckCircle2, XCircle, Clock, AlertTriangle
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { UISupplier } from '@/lib/types/supplier-ui'
import { formatCurrency } from '@/lib/currency'
import { SupplierProductsList, type SupplierProduct } from './SupplierProductsList'
import { SupplierOrdersList } from './SupplierOrdersList'
import { SupplierNotes } from './SupplierNotes'
import { cn } from '@/lib/utils'

interface SupplierDetailModalProps {
    isOpen: boolean
    onClose: () => void
    supplier: UISupplier | null
    onEdit?: (supplier: UISupplier) => void
    onCreateOrder?: (supplier: UISupplier, product?: SupplierProduct | null) => void
    onNotesSaved?: (notes: string | null) => void
}

const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
    active: {
        label: 'Activo',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
        icon: CheckCircle2,
    },
    inactive: {
        label: 'Inactivo',
        className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
        icon: XCircle,
    },
    pending: {
        label: 'Pendiente',
        className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
        icon: Clock,
    },
    suspended: {
        label: 'Suspendido',
        className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300',
        icon: AlertTriangle,
    },
}

const businessTypeLabels: Record<string, string> = {
    manufacturer: 'Fabricante',
    distributor: 'Distribuidor',
    wholesaler: 'Mayorista',
    service_provider: 'Proveedor de Servicios',
    retailer: 'Minorista',
}

export function SupplierDetailModal({
    isOpen,
    onClose,
    supplier,
    onEdit,
    onCreateOrder,
    onNotesSaved,
}: SupplierDetailModalProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'products' | 'orders' | 'notes'>('info')

    if (!supplier) return null

    const status = statusConfig[supplier.status] || statusConfig.active
    const StatusIcon = status.icon
    const businessType = businessTypeLabels[supplier.business_type] || supplier.business_type || 'Distribuidor'
    const rating = Number(supplier.rating) || 0

    // Limpieza de teléfono para WhatsApp o llamada directa
    const rawPhone = (supplier.phone || '').replace(/[^0-9+]/g, '')
    const whatsappUrl = rawPhone ? `https://wa.me/${rawPhone.replace(/^\+/, '')}` : null
    const telUrl = rawPhone ? `tel:${rawPhone}` : null
    const mailtoUrl = supplier.email ? `mailto:${supplier.email}` : null
    const websiteUrl = supplier.website ? (supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`) : null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border bg-background shadow-2xl">
                {/* Header con gradiente suave */}
                <div className="border-b bg-gradient-to-r from-slate-50 via-indigo-50/25 to-background p-5 dark:from-slate-900 dark:via-indigo-950/20 dark:to-background">
                    <DialogHeader className="space-y-3 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            {/* Identidad del proveedor */}
                            <div className="flex items-start gap-3.5 min-w-0">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg shadow-sm">
                                    {supplier.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <DialogTitle className="text-xl font-bold text-foreground truncate">
                                            {supplier.name}
                                        </DialogTitle>
                                        <Badge variant="outline" className={cn('gap-1 text-[11px] font-medium h-5 px-2', status.className)}>
                                            <StatusIcon className="h-3 w-3" />
                                            {status.label}
                                        </Badge>
                                        <Badge variant="secondary" className="text-[11px] font-normal h-5 px-2">
                                            {businessType}
                                        </Badge>
                                    </div>
                                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                        {supplier.contact_name ? `Contacto: ${supplier.contact_name}` : 'Proveedor registrado'}
                                        {supplier.city && supplier.country ? ` · ${supplier.city}, ${supplier.country}` : ''}
                                    </DialogDescription>
                                </div>
                            </div>

                            {/* Botones de acción principales */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {onCreateOrder && (
                                    <Button
                                        size="sm"
                                        className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
                                        onClick={() => {
                                            onCreateOrder(supplier)
                                        }}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Nueva Orden
                                    </Button>
                                )}

                                {onEdit && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 text-xs"
                                        onClick={() => {
                                            onEdit(supplier)
                                        }}
                                    >
                                        <Edit className="h-3.5 w-3.5" />
                                        Editar
                                    </Button>
                                )}

                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                    title="Abrir ficha completa"
                                >
                                    <Link href={`/dashboard/suppliers/${supplier.id}`}>
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">Página completa</span>
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        {/* Barra de contacto rápido */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-xs">
                            {whatsappUrl && (
                                <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background/80 px-2.5 py-1 text-slate-700 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 hover:border-emerald-300 transition-colors"
                                >
                                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>WhatsApp</span>
                                </a>
                            )}

                            {telUrl && (
                                <a
                                    href={telUrl}
                                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background/80 px-2.5 py-1 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 hover:border-indigo-300 transition-colors"
                                >
                                    <Phone className="h-3.5 w-3.5 text-indigo-600" />
                                    <span>{supplier.phone}</span>
                                </a>
                            )}

                            {mailtoUrl && (
                                <a
                                    href={mailtoUrl}
                                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background/80 px-2.5 py-1 text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 hover:border-blue-300 transition-colors"
                                >
                                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                                    <span className="max-w-[200px] truncate">{supplier.email}</span>
                                </a>
                            )}

                            {websiteUrl && (
                                <a
                                    href={websiteUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background/80 px-2.5 py-1 text-slate-700 hover:text-purple-600 dark:text-slate-300 dark:hover:text-purple-400 hover:border-purple-300 transition-colors"
                                >
                                    <Globe className="h-3.5 w-3.5 text-purple-600" />
                                    <span>Sitio Web</span>
                                </a>
                            )}
                        </div>
                    </DialogHeader>
                </div>

                {/* Body con Scroll */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Tarjetas de Métricas Resumen */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Card className="p-3 bg-muted/20 border shadow-2xs">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Calificación</span>
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                            </div>
                            <div className="mt-1.5 flex items-baseline gap-1.5">
                                <span className="text-xl font-bold tabular-nums text-foreground">
                                    {rating > 0 ? rating.toFixed(1) : '—'}
                                </span>
                                {rating > 0 && (
                                    <div className="flex items-center text-amber-400 text-xs">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={cn('h-2.5 w-2.5', i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700')}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card className="p-3 bg-muted/20 border shadow-2xs">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Total Órdenes</span>
                                <Package className="h-3.5 w-3.5 text-indigo-500" />
                            </div>
                            <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">
                                {supplier.total_orders || 0}
                            </p>
                        </Card>

                        <Card className="p-3 bg-muted/20 border shadow-2xs">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Monto Facturado</span>
                                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                            </div>
                            <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground truncate">
                                {formatCurrency(supplier.total_amount || 0)}
                            </p>
                        </Card>

                        <Card className="p-3 bg-muted/20 border shadow-2xs">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Productos</span>
                                <Tag className="h-3.5 w-3.5 text-purple-500" />
                            </div>
                            <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">
                                {supplier.products_count || 0}
                            </p>
                        </Card>
                    </div>

                    {/* Pestañas de contenido */}
                    <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
                        <TabsList className="grid w-full grid-cols-4 h-9">
                            <TabsTrigger value="info" className="text-xs font-medium">Información</TabsTrigger>
                            <TabsTrigger value="products" className="text-xs font-medium">
                                Productos {supplier.products_count ? `(${supplier.products_count})` : ''}
                            </TabsTrigger>
                            <TabsTrigger value="orders" className="text-xs font-medium">
                                Órdenes {supplier.total_orders ? `(${supplier.total_orders})` : ''}
                            </TabsTrigger>
                            <TabsTrigger value="notes" className="text-xs font-medium">Notas</TabsTrigger>
                        </TabsList>

                        {/* Tab Información */}
                        <TabsContent value="info" className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Card className="p-4 bg-card/60">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                                        <Building2 className="h-4 w-4 text-indigo-500" /> Datos Comerciales
                                    </h4>
                                    <div className="space-y-2.5 text-xs">
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">Razón Social / Nombre:</span>
                                            <span className="font-semibold text-foreground">{supplier.name}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">Contacto Comercial:</span>
                                            <span className="font-medium text-foreground">{supplier.contact_name || 'No especificado'}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">Tipo de Empresa:</span>
                                            <span className="font-medium text-foreground">{businessType}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">Sitio Web:</span>
                                            {supplier.website ? (
                                                <a href={websiteUrl!} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                                                    {supplier.website}
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground italic">Sin sitio web</span>
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                <Card className="p-4 bg-card/60">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                                        <MapPin className="h-4 w-4 text-rose-500" /> Ubicación y Domicilio
                                    </h4>
                                    <div className="space-y-2.5 text-xs">
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">Dirección:</span>
                                            <span className="font-medium text-foreground">{supplier.address || 'Sin dirección registrada'}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="text-muted-foreground block text-[11px]">Ciudad:</span>
                                                <span className="font-medium text-foreground">{supplier.city || '—'}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground block text-[11px]">Código Postal:</span>
                                                <span className="font-medium text-foreground">{supplier.postal_code || '—'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">País:</span>
                                            <span className="font-medium text-foreground">{supplier.country || '—'}</span>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Tab Productos */}
                        <TabsContent value="products" className="mt-4">
                            <SupplierProductsList
                                supplierId={supplier.id}
                                onOrderProduct={(product) => {
                                    if (onCreateOrder) {
                                        onCreateOrder(supplier, product)
                                    }
                                }}
                            />
                        </TabsContent>

                        {/* Tab Órdenes de Compra */}
                        <TabsContent value="orders" className="mt-4">
                            <SupplierOrdersList
                                supplierId={supplier.id}
                                supplierName={supplier.name}
                                onCreateOrder={() => {
                                    if (onCreateOrder) {
                                        onCreateOrder(supplier)
                                    }
                                }}
                            />
                        </TabsContent>

                        {/* Tab Notas Internas */}
                        <TabsContent value="notes" className="mt-4">
                            <SupplierNotes
                                supplierId={supplier.id}
                                notes={supplier.notes}
                                updatedAt={supplier.updated_at}
                                onSaved={onNotesSaved}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
}
