'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, Mail, Phone, MapPin, Globe, Star, Package, TrendingUp, FileText, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import type { UISupplier } from '@/lib/types/supplier-ui'
import { SupplierProductsList } from '@/components/suppliers/SupplierProductsList'
import { SupplierOrdersList } from '@/components/suppliers/SupplierOrdersList'
import { CreateOrderModal } from '@/components/suppliers/CreateOrderModal'
import { formatCurrency } from '@/lib/currency'

export default function SupplierDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [supplier, setSupplier] = useState<UISupplier | null>(null)
    const [loading, setLoading] = useState(true)
    const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        const fetchSupplier = async () => {
            try {
                setLoading(true)
                // Fetch supplier details
                const { data: supplierData, error: supplierError } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('id', params.id)
                    .single()

                if (supplierError) throw supplierError

                // Fetch products count
                const { count: productsCount, error: countError } = await supabase
                    .from('products')
                    .select('*', { count: 'exact', head: true })
                    .eq('supplier_id', params.id)
                
                if (countError) logger.warn('Error fetching products count', { error: countError })

                // Map to UISupplier
                const s = supplierData
                const mappedSupplier: UISupplier = {
                    id: s.id,
                    name: s.name,
                    contact_person: s.contact_person || '',
                    email: s.email || '',
                    phone: s.phone || '',
                    address: s.address || '',
                    city: s.city || '', 
                    country: s.country || '',
                    postal_code: s.postal_code || '',
                    website: s.website || '',
                    business_type: (s.business_type || 'distributor') as any,
                    status: s.is_active ? 'active' : 'inactive',
                    rating: s.rating || 0,
                    products_count: productsCount || 0,
                    total_orders: s.total_orders || 0,
                    total_amount: s.total_amount || 0,
                    notes: s.notes || '',
                    created_at: s.created_at,
                    updated_at: s.updated_at
                }

                setSupplier(mappedSupplier)
            } catch (error) {
                logger.error('Error fetching supplier', { error })
            } finally {
                setLoading(false)
            }
        }

        if (params.id) {
            fetchSupplier()
        }
    }, [params.id, supabase])

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    if (!supplier) {
        return (
            <div className="p-6">
                <Card className="p-12 text-center">
                    <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Proveedor no encontrado</h3>
                    <Button onClick={() => router.push('/dashboard/suppliers')} className="mt-4">
                        Volver a proveedores
                    </Button>
                </Card>
            </div>
        )
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

    const getStatusLabel = (status: string) => {
        const labels = {
            active: 'Activo',
            inactive: 'Inactivo',
            pending: 'Pendiente',
            suspended: 'Suspendido'
        }
        return labels[status as keyof typeof labels] || status
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/dashboard/suppliers')}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">{supplier.name}</h1>
                        <p className="text-gray-500">{supplier.contact_person}</p>
                    </div>
                </div>
                <Badge className={getStatusColor(supplier.status)}>
                    {getStatusLabel(supplier.status)}
                </Badge>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Calificación</CardTitle>
                        <Star className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(supplier.rating || 0).toFixed(1)}</div>
                        <div className="flex items-center gap-1 mt-1">
                            {[...Array(5)].map((_, i) => (
                                <Star
                                    key={i}
                                    className={`h-3 w-3 ${i < (supplier.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
                        <Package className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{supplier.total_orders || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">Pedidos realizados</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(supplier.total_amount || 0)}</div>
                        <p className="text-xs text-gray-500 mt-1">Valor total comprado</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Productos</CardTitle>
                        <FileText className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{supplier.products_count || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">Productos disponibles</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="info">Información</TabsTrigger>
                    <TabsTrigger value="orders">Pedidos</TabsTrigger>
                    <TabsTrigger value="products">Productos</TabsTrigger>
                    <TabsTrigger value="notes">Notas</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Información de Contacto
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                    <div>
                                        <p className="text-sm text-gray-500">Email</p>
                                        <p className="font-medium">{supplier.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone className="h-5 w-5 text-gray-400" />
                                    <div>
                                        <p className="text-sm text-gray-500">Teléfono</p>
                                        <p className="font-medium">{supplier.phone}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <MapPin className="h-5 w-5 text-gray-400" />
                                    <div>
                                        <p className="text-sm text-gray-500">Ubicación</p>
                                        <p className="font-medium">
                                            {supplier.city && supplier.country
                                                ? `${supplier.city}, ${supplier.country}`
                                                : supplier.city || supplier.country || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                {supplier.website && (
                                    <div className="flex items-center gap-3">
                                        <Globe className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-sm text-gray-500">Sitio Web</p>
                                            <a
                                                href={supplier.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-blue-600 hover:underline"
                                            >
                                                {supplier.website}
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {supplier.address && (
                                <div className="pt-4 border-t">
                                    <p className="text-sm text-gray-500 mb-1">Dirección Completa</p>
                                    <p className="font-medium">{supplier.address}</p>
                                    {supplier.postal_code && (
                                        <p className="text-sm text-gray-500 mt-1">CP: {supplier.postal_code}</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="orders">
                    <Card>
                        <CardHeader>
                            <CardTitle>Historial de Pedidos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SupplierOrdersList 
                                supplierId={supplier.id} 
                                onCreateOrder={() => setIsCreateOrderOpen(true)}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="products">
                    <Card>
                        <CardHeader>
                            <CardTitle>Productos del Proveedor</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SupplierProductsList supplierId={supplier.id} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notes">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Notas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {supplier.notes ? (
                                <p className="whitespace-pre-wrap">{supplier.notes}</p>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No hay notas disponibles</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <CreateOrderModal 
                isOpen={isCreateOrderOpen}
                onClose={() => setIsCreateOrderOpen(false)}
                supplierId={supplier.id}
                supplierName={supplier.name}
                onOrderCreated={() => {
                    // Refresh data if needed, or SupplierOrdersList will handle it via its own fetch
                    // But we might want to refresh stats
                }}
            />
        </div>
    )
}
