'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, ArrowLeft, TrendingUp, TrendingDown, ShoppingCart, Filter } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from '@/components/ui/badge'
import { CreateOrderModal } from '@/components/suppliers/CreateOrderModal'

interface SupplierProduct {
    id: string
    name: string
    suppliersku: string
    internalsku: string
    unitprice: number
    currency: string
    supplier_id: string
    suppliers?: {
        name: string
    }
}

interface ProductGroup {
    name: string
    sku: string
    avgPrice: number
    minPrice: number
    maxPrice: number
    offers: SupplierProduct[]
}

export default function PriceComparisonPage() {
    const router = useRouter()
    const [products, setProducts] = useState<SupplierProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all')
    const supabase = createClient()

    // Order Modal State
    const [orderModalOpen, setOrderModalOpen] = useState(false)
    const [orderSupplier, setOrderSupplier] = useState<{id: string, name: string} | null>(null)
    const [orderProduct, setOrderProduct] = useState<SupplierProduct | null>(null)

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true)
                // Use products table instead of supplier_products
                const { data, error } = await supabase
                    .from('products')
                    .select('*, suppliers(name)')
                    .gt('stock_quantity', 0) // Only compare available products

                if (error) throw error

                // Map to SupplierProduct interface
                const mappedProducts: SupplierProduct[] = (data || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    suppliersku: p.sku,
                    internalsku: p.sku,
                    unitprice: p.sale_price,
                    currency: 'USD',
                    supplier_id: p.supplier_id,
                    suppliers: p.suppliers
                }))

                setProducts(mappedProducts)
            } catch (error: any) {
                console.error('Error fetching products:', error)
                console.error('Error details:', error.message, error.details, error.hint)
            } finally {
                setLoading(false)
            }
        }

        fetchProducts()
    }, [supabase])

    const uniqueSuppliers = useMemo(() => {
        const suppliers = new Map()
        products.forEach(p => {
            if (p.supplier_id && p.suppliers?.name) {
                suppliers.set(p.supplier_id, p.suppliers.name)
            }
        })
        return Array.from(suppliers.entries()).map(([id, name]) => ({ id, name }))
    }, [products])

    const groupedProducts = useMemo(() => {
        const groups: Record<string, SupplierProduct[]> = {}
        
        // First filter products by selected supplier if not 'all'
        // Actually, we want to keep the group if at least one product matches the search/filter?
        // Or if we select a supplier, we only show products from that supplier?
        // "Compare" implies showing multiple suppliers. If I filter by Supplier A, 
        // maybe I want to see only products that Supplier A sells, but compare them against others?
        // Or just filter the list to only show offers from Supplier A?
        // Let's assume filter reduces the visible offers.
        
        const filteredProducts = products.filter(p => 
            selectedSupplierId === 'all' || p.supplier_id === selectedSupplierId
        )

        // However, if we filter offers, we lose comparison context if we hide other suppliers.
        // Better approach: Show groups that contain the selected supplier, but show ALL offers for context?
        // Or just filter the offers visible. Let's filter offers for now as it's simpler.
        
        // Wait, if I filter by supplier, I probably want to see "What does Supplier A sell?"
        // But this is "Price Comparison".
        // Maybe the filter should be "Highlight Supplier A" or "Show only products Supplier A sells (but show all competitors for those products)".
        
        // Let's implement: Filter products list to those sold by selected supplier, 
        // BUT keep all offers for those products in the group so we can compare.
        
        const productsOfInterest = selectedSupplierId === 'all' 
            ? products 
            : products.filter(p => p.supplier_id === selectedSupplierId)
            
        const relevantSkus = new Set(productsOfInterest.map(p => p.internalsku || p.name))
        
        products.forEach(p => {
            const key = p.internalsku || p.name
            if (relevantSkus.has(key)) {
                if (!groups[key]) {
                    groups[key] = []
                }
                groups[key].push(p)
            }
        })

        return Object.entries(groups).map(([key, offers]) => {
            const prices = offers.map(o => o.unitprice)
            const minPrice = Math.min(...prices)
            const maxPrice = Math.max(...prices)
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length

            return {
                name: offers[0].name,
                sku: offers[0].internalsku || key,
                avgPrice,
                minPrice,
                maxPrice,
                offers: offers.sort((a, b) => a.unitprice - b.unitprice)
            }
        }).filter(g => 
            g.name.toLowerCase().includes(search.toLowerCase()) || 
            g.sku.toLowerCase().includes(search.toLowerCase())
        )
    }, [products, search, selectedSupplierId])

    const formatPrice = (amount: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: currency
        }).format(amount)
    }

    const handleCreateOrder = (offer: SupplierProduct) => {
        if (!offer.supplier_id || !offer.suppliers?.name) return
        
        setOrderSupplier({
            id: offer.supplier_id,
            name: offer.suppliers.name
        })
        setOrderProduct(offer)
        setOrderModalOpen(true)
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Comparativa de Precios</h1>
                    <p className="text-gray-500">Analiza y compara precios entre tus proveedores</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex items-center gap-2 flex-1 bg-white p-2 rounded-lg border shadow-sm">
                    <Search className="h-5 w-5 text-muted-foreground ml-2" />
                    <Input
                        placeholder="Buscar por nombre de producto o SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 border-none shadow-none focus-visible:ring-0"
                    />
                </div>
                <div className="w-full md:w-64">
                    <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                        <SelectTrigger className="bg-white">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4" />
                                <SelectValue placeholder="Filtrar por proveedor" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los proveedores</SelectItem>
                            {uniqueSuppliers.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {groupedProducts.map((group) => (
                        <Card key={group.sku} className="overflow-hidden">
                            <CardHeader className="pb-4 bg-muted/30">
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div>
                                        <CardTitle className="text-xl">{group.name}</CardTitle>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline">SKU: {group.sku}</Badge>
                                            <Badge variant="secondary">{group.offers.length} Ofertas</Badge>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground">Mejor Precio</div>
                                        <div className="font-bold text-2xl text-green-600">
                                            {formatPrice(group.minPrice)}
                                        </div>
                                        {group.maxPrice > group.minPrice && (
                                            <div className="text-xs text-muted-foreground">
                                                hasta {formatPrice(group.maxPrice)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/10">
                                            <TableHead>Proveedor</TableHead>
                                            <TableHead>SKU Prov.</TableHead>
                                            <TableHead className="text-right">Precio Unitario</TableHead>
                                            <TableHead className="text-right">Diferencia</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {group.offers.map((offer, index) => {
                                            const diff = offer.unitprice - group.minPrice
                                            const percent = group.minPrice > 0 ? (diff / group.minPrice) * 100 : 0
                                            const isBestPrice = index === 0
                                            
                                            return (
                                                <TableRow key={offer.id} className={isBestPrice ? "bg-green-50/50" : ""}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {offer.suppliers?.name || 'Desconocido'}
                                                            {isBestPrice && (
                                                                <Badge className="bg-green-600 hover:bg-green-700 h-5 text-[10px]">
                                                                    MEJOR
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {offer.suppliersku || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold font-mono">
                                                        {formatPrice(offer.unitprice, offer.currency || 'USD')}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isBestPrice ? (
                                                            <span className="text-green-600 flex items-center justify-end gap-1 text-sm font-medium">
                                                                <TrendingDown className="h-4 w-4" />
                                                                -
                                                            </span>
                                                        ) : (
                                                            <span className={`flex items-center justify-end gap-1 text-sm ${percent > 20 ? 'text-red-500' : 'text-yellow-600'}`}>
                                                                <TrendingUp className="h-4 w-4" />
                                                                +{percent.toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button 
                                                            size="sm" 
                                                            variant={isBestPrice ? "default" : "outline"}
                                                            className="h-8"
                                                            onClick={() => handleCreateOrder(offer)}
                                                        >
                                                            <ShoppingCart className="h-3.5 w-3.5 mr-2" />
                                                            Pedir
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ))}

                    {groupedProducts.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            No se encontraron productos para comparar.
                        </div>
                    )}
                </div>
            )}

            {orderSupplier && (
                <CreateOrderModal
                    isOpen={orderModalOpen}
                    onClose={() => setOrderModalOpen(false)}
                    supplierId={orderSupplier.id}
                    supplierName={orderSupplier.name}
                    onOrderCreated={() => {
                        setOrderModalOpen(false)
                        // Maybe show success toast or refresh?
                    }}
                    initialProduct={orderProduct}
                />
            )}
        </div>
    )
}
