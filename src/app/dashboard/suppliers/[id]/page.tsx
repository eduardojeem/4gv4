'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Globe, Star,
  Package, DollarSign, Edit, ExternalLink, MessageCircle, Tag, CheckCircle2, XCircle, Clock,
  AlertTriangle, RefreshCw, ShoppingCart
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import type { UISupplier } from '@/lib/types/supplier-ui'
import { SupplierProductsList, type SupplierProduct } from '@/components/suppliers/SupplierProductsList'
import { SupplierNotes } from '@/components/suppliers/SupplierNotes'
import { SupplierOrdersList } from '@/components/suppliers/SupplierOrdersList'
import { CreateOrderModal } from '@/components/suppliers/CreateOrderModal'
import { SupplierModal } from '@/components/dashboard/supplier-modal'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

export default function SupplierDetailPage() {
    const params = useParams()
    const router = useRouter()
    const supplierId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''
    
    const [supplier, setSupplier] = useState<UISupplier | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'info' | 'products' | 'orders' | 'notes'>('info')

    // Modales
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false)
    const [orderSeedProduct, setOrderSeedProduct] = useState<SupplierProduct | null>(null)

    const supabase = createClient()

    const fetchSupplier = useCallback(async () => {
        if (!supplierId) return
        try {
            setLoading(true)
            const { data: s, error: supplierError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('id', supplierId)
                .single()

            if (supplierError) throw supplierError

            // Fetch products count
            const { count: productsCount, error: countError } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('supplier_id', supplierId)

            if (countError) logger.warn('Error fetching products count', { error: countError })

            const mappedSupplier: UISupplier = {
                id: s.id,
                name: s.name,
                contact_name: s.contact_name || '',
                email: s.email || '',
                phone: s.phone || '',
                address: s.address || '',
                city: s.city || '',
                country: s.country || '',
                postal_code: s.postal_code || '',
                website: s.website || '',
                business_type: (s.business_type || 'distributor') as UISupplier['business_type'],
                status: s.status || (s.is_active ? 'active' : 'inactive'),
                rating: Number(s.rating) || 0,
                products_count: productsCount ?? s.products_count ?? 0,
                total_orders: Number(s.total_orders) || 0,
                total_amount: Number(s.total_amount) || 0,
                notes: s.notes || '',
                created_at: s.created_at,
                updated_at: s.updated_at,
            }

            setSupplier(mappedSupplier)
        } catch (error) {
            logger.error('Error fetching supplier', { error })
            toast.error('No se pudo cargar la información del proveedor')
        } finally {
            setLoading(false)
        }
    }, [supplierId, supabase])

    useEffect(() => {
        fetchSupplier()
    }, [fetchSupplier])

    const handleSaveSupplier = async (supplierData: Partial<UISupplier>) => {
        if (!supplier) return
        try {
            setIsSaving(true)
            const response = await fetch('/api/suppliers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...supplierData, id: supplier.id }),
            })
            const result = await response.json()
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Error al actualizar el proveedor')
            }

            toast.success('Proveedor actualizado exitosamente')
            setSupplier((prev) => prev ? { ...prev, ...supplierData, updated_at: new Date().toISOString() } : null)
            setIsEditModalOpen(false)
        } catch (error) {
            console.error('Error saving supplier:', error)
            toast.error(error instanceof Error ? error.message : 'Error al guardar los cambios')
            throw error
        } finally {
            setIsSaving(false)
        }
    }

    const handleOrderCreated = useCallback(() => {
        setIsCreateOrderOpen(false)
        setOrderSeedProduct(null)
        fetchSupplier()
        toast.success('Orden de compra creada exitosamente')
    }, [fetchSupplier])

    if (loading) {
        return (
            <div className="mx-auto flex max-w-[1480px] flex-col gap-6 p-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-64" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-28 rounded-2xl" />
                    ))}
                </div>
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        )
    }

    if (!supplier) {
        return (
            <div className="mx-auto flex max-w-[1480px] flex-col items-center justify-center p-12">
                <Card className="max-w-md w-full p-8 text-center border shadow-md space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <Building2 className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-foreground">Proveedor no encontrado</h3>
                        <p className="text-xs text-muted-foreground">
                            El proveedor que intentas consultar no existe o ha sido eliminado.
                        </p>
                    </div>
                    <Button onClick={() => router.push('/dashboard/suppliers')} className="gap-2 w-full mt-2">
                        <ArrowLeft className="h-4 w-4" />
                        Volver a Proveedores
                    </Button>
                </Card>
            </div>
        )
    }

    const status = statusConfig[supplier.status] || statusConfig.active
    const StatusIcon = status.icon
    const businessType = businessTypeLabels[supplier.business_type] || supplier.business_type || 'Distribuidor'
    const rating = Number(supplier.rating) || 0

    // Saneamiento de URLs de contacto
    const rawPhone = (supplier.phone || '').replace(/[^0-9+]/g, '')
    const whatsappUrl = rawPhone ? `https://wa.me/${rawPhone.replace(/^\+/, '')}` : null
    const telUrl = rawPhone ? `tel:${rawPhone}` : null
    const mailtoUrl = supplier.email ? `mailto:${supplier.email}` : null
    const websiteUrl = supplier.website ? (supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`) : null

    const createdAtFormatted = supplier.created_at
        ? format(new Date(supplier.created_at), "d 'de' MMMM yyyy", { locale: es })
        : null

    const updatedAtFormatted = supplier.updated_at
        ? format(new Date(supplier.updated_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })
        : null

    return (
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6 p-4 sm:p-6">
            {/* Header Superior y Barra de Herramientas */}
            <header className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-r from-slate-50 via-indigo-50/20 to-background p-5 dark:from-slate-900 dark:via-indigo-950/20 dark:to-background shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {/* Botón Volver + Identidad */}
                    <div className="flex items-start gap-3.5 min-w-0">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 shrink-0 rounded-xl bg-background shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => router.push('/dashboard/suppliers')}
                            title="Volver a lista de proveedores"
                        >
                            <ArrowLeft className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                        </Button>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-base shadow-sm">
                            {supplier.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
                                    {supplier.name}
                                </h1>
                                <Badge variant="outline" className={cn('gap-1 text-xs font-medium h-6 px-2.5', status.className)}>
                                    <StatusIcon className="h-3.5 w-3.5" />
                                    {status.label}
                                </Badge>
                                <Badge variant="secondary" className="text-xs font-normal h-6 px-2.5">
                                    {businessType}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {supplier.contact_name ? `Contacto: ${supplier.contact_name}` : 'Proveedor comercial'}
                                {supplier.city && supplier.country ? ` · ${supplier.city}, ${supplier.country}` : ''}
                            </p>
                        </div>
                    </div>

                    {/* Acciones Rápidas del Header */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchSupplier}
                            className="h-9 gap-1.5 text-xs rounded-xl"
                            title="Actualizar datos"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Actualizar</span>
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditModalOpen(true)}
                            className="h-9 gap-1.5 text-xs rounded-xl"
                        >
                            <Edit className="h-3.5 w-3.5" />
                            Editar Proveedor
                        </Button>

                        <Button
                            size="sm"
                            onClick={() => {
                                setOrderSeedProduct(null)
                                setIsCreateOrderOpen(true)
                            }}
                            className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                        >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Nueva Orden
                        </Button>
                    </div>
                </div>

                {/* Barra de Enlaces de Contacto Rápido (1-click) */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/60 text-xs">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                        Contacto directo:
                    </span>

                    {whatsappUrl && (
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-slate-700 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 hover:border-emerald-300 transition-colors shadow-2xs"
                        >
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="font-medium">WhatsApp</span>
                        </a>
                    )}

                    {telUrl && (
                        <a
                            href={telUrl}
                            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 hover:border-indigo-300 transition-colors shadow-2xs"
                        >
                            <Phone className="h-3.5 w-3.5 text-indigo-600" />
                            <span className="font-medium">{supplier.phone}</span>
                        </a>
                    )}

                    {mailtoUrl && (
                        <a
                            href={mailtoUrl}
                            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 hover:border-blue-300 transition-colors shadow-2xs"
                        >
                            <Mail className="h-3.5 w-3.5 text-blue-600" />
                            <span className="font-medium max-w-[220px] truncate">{supplier.email}</span>
                        </a>
                    )}

                    {websiteUrl && (
                        <a
                            href={websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-slate-700 hover:text-purple-600 dark:text-slate-300 dark:hover:text-purple-400 hover:border-purple-300 transition-colors shadow-2xs"
                        >
                            <Globe className="h-3.5 w-3.5 text-purple-600" />
                            <span className="font-medium">Sitio Web</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                    )}
                </div>
            </header>

            {/* 4 Hero KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* Calificación */}
                <Card className="rounded-2xl border bg-gradient-to-br from-amber-500/10 to-transparent border-amber-200/50 dark:border-amber-900/50 p-5 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Calificación
                            </p>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                                    {rating > 0 ? rating.toFixed(1) : '—'}
                                </span>
                                {rating > 0 && (
                                    <div className="flex items-center text-amber-400 text-xs">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={cn('h-3 w-3', i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700')}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                                {rating >= 4.5 ? 'Excelente reputación' : rating >= 3 ? 'Desempeño estándar' : 'Sin calificar'}
                            </p>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Star className="h-5 w-5" />
                        </div>
                    </div>
                </Card>

                {/* Total Órdenes */}
                <Card className="rounded-2xl border bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-200/50 dark:border-indigo-900/50 p-5 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Órdenes de Compra
                            </p>
                            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                                {supplier.total_orders || 0}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                                Historial de pedidos
                            </p>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                            <Package className="h-5 w-5" />
                        </div>
                    </div>
                </Card>

                {/* Monto Facturado */}
                <Card className="rounded-2xl border bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-200/50 dark:border-emerald-900/50 p-5 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Monto Comprado
                            </p>
                            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50 truncate">
                                {formatCurrency(supplier.total_amount || 0)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                                Total acumulado facturado
                            </p>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <DollarSign className="h-5 w-5" />
                        </div>
                    </div>
                </Card>

                {/* Catálogo de Productos */}
                <Card className="rounded-2xl border bg-gradient-to-br from-violet-500/10 to-transparent border-violet-200/50 dark:border-violet-900/50 p-5 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Catálogo
                            </p>
                            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                                {supplier.products_count || 0}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                                Artículos suministrados
                            </p>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
                            <Tag className="h-5 w-5" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Pestañas de Gestión */}
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="w-full space-y-4">
                <TabsList className="grid w-full grid-cols-4 h-11 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                    <TabsTrigger value="info" className="text-xs font-semibold rounded-lg">
                        Información
                    </TabsTrigger>
                    <TabsTrigger value="products" className="text-xs font-semibold rounded-lg">
                        Productos {supplier.products_count ? `(${supplier.products_count})` : ''}
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="text-xs font-semibold rounded-lg">
                        Órdenes {supplier.total_orders ? `(${supplier.total_orders})` : ''}
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="text-xs font-semibold rounded-lg">
                        Notas Internas
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Información General */}
                <TabsContent value="info" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Datos Comerciales */}
                        <Card className="rounded-2xl border bg-card/60 p-5 space-y-4">
                            <div className="flex items-center justify-between border-b pb-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-indigo-500" />
                                    Datos Comerciales
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-indigo-600 hover:text-indigo-700"
                                    onClick={() => setIsEditModalOpen(true)}
                                >
                                    Editar
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Razón Social / Nombre:</span>
                                    <span className="font-semibold text-foreground text-sm">{supplier.name}</span>
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
                                    <span className="text-muted-foreground block text-[11px]">Estado Operativo:</span>
                                    <span className="font-medium text-foreground capitalize">{status.label}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Correo Electrónico:</span>
                                    {supplier.email ? (
                                        <a href={mailtoUrl!} className="font-medium text-blue-600 hover:underline">
                                            {supplier.email}
                                        </a>
                                    ) : (
                                        <span className="text-muted-foreground italic">No registrado</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Teléfono Principal:</span>
                                    {supplier.phone ? (
                                        <a href={telUrl!} className="font-medium text-indigo-600 hover:underline">
                                            {supplier.phone}
                                        </a>
                                    ) : (
                                        <span className="text-muted-foreground italic">No registrado</span>
                                    )}
                                </div>
                                <div className="sm:col-span-2">
                                    <span className="text-muted-foreground block text-[11px]">Sitio Web Oficial:</span>
                                    {supplier.website ? (
                                        <a href={websiteUrl!} target="_blank" rel="noreferrer" className="font-medium text-purple-600 hover:underline flex items-center gap-1">
                                            {supplier.website}
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    ) : (
                                        <span className="text-muted-foreground italic">Sin sitio web registrado</span>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Ubicación y Despacho */}
                        <Card className="rounded-2xl border bg-card/60 p-5 space-y-4">
                            <div className="flex items-center justify-between border-b pb-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-rose-500" />
                                    Ubicación y Despacho
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-indigo-600 hover:text-indigo-700"
                                    onClick={() => setIsEditModalOpen(true)}
                                >
                                    Editar
                                </Button>
                            </div>
                            <div className="space-y-3.5 text-xs">
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Dirección de Despacho / Depósito:</span>
                                    <span className="font-medium text-foreground text-sm">{supplier.address || 'Sin dirección registrada'}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
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

                                <div className="pt-3 border-t border-border/60 grid grid-cols-2 gap-4 text-[11px]">
                                    <div>
                                        <span className="text-muted-foreground block">Fecha de Registro:</span>
                                        <span className="font-medium text-foreground">{createdAtFormatted || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block">Última Actualización:</span>
                                        <span className="font-medium text-foreground">{updatedAtFormatted || '—'}</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                {/* Tab: Productos */}
                <TabsContent value="products">
                    <Card className="rounded-2xl border p-5">
                        <SupplierProductsList
                            supplierId={supplier.id}
                            onOrderProduct={(product) => {
                                setOrderSeedProduct(product)
                                setIsCreateOrderOpen(true)
                            }}
                        />
                    </Card>
                </TabsContent>

                {/* Tab: Órdenes de Compra */}
                <TabsContent value="orders">
                    <Card className="rounded-2xl border p-5">
                        <SupplierOrdersList
                            supplierId={supplier.id}
                            supplierName={supplier.name}
                            onCreateOrder={() => {
                                setOrderSeedProduct(null)
                                setIsCreateOrderOpen(true)
                            }}
                        />
                    </Card>
                </TabsContent>

                {/* Tab: Notas Internas */}
                <TabsContent value="notes">
                    <Card className="rounded-2xl border p-5">
                        <SupplierNotes
                            supplierId={supplier.id}
                            notes={supplier.notes}
                            updatedAt={supplier.updated_at}
                            onSaved={(nextNotes) => {
                                setSupplier((current) => current ? {
                                    ...current,
                                    notes: nextNotes ?? '',
                                    updated_at: new Date().toISOString()
                                } : current)
                            }}
                        />
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modal para Editar Datos del Proveedor */}
            <SupplierModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveSupplier}
                supplier={supplier}
                mode="edit"
                loading={isSaving}
            />

            {/* Modal para Crear Orden de Compra */}
            <CreateOrderModal
                isOpen={isCreateOrderOpen}
                onClose={() => {
                    setIsCreateOrderOpen(false)
                    setOrderSeedProduct(null)
                }}
                initialProduct={orderSeedProduct ? {
                    id: orderSeedProduct.id,
                    name: orderSeedProduct.name,
                    suppliersku: orderSeedProduct.sku || '',
                    unitprice: orderSeedProduct.purchasePrice,
                    currency: 'PYG',
                    stock: orderSeedProduct.stock,
                    minStock: orderSeedProduct.minStock,
                    imageUrl: orderSeedProduct.imageUrl,
                    source: 'own',
                } : null}
                supplierId={supplier.id}
                supplierName={supplier.name}
                onOrderCreated={handleOrderCreated}
            />
        </div>
    )
}
