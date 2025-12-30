'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, RefreshCw, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface SupplierProduct {
    id: string
    name: string
    suppliersku: string | null
    internalsku: string | null
    category: string | null
    unitprice: number
    currency: string
    availability: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued' | null
    minimumorderquantity: number
}

interface SupplierProductsListProps {
    supplierId: string
}

export function SupplierProductsList({ supplierId }: SupplierProductsListProps) {
    const [products, setProducts] = useState<SupplierProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const supabase = createClient()

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true)
            // Query products table instead of supplier_products
            let query = supabase
                .from('products')
                .select('*, category:categories(name)')
                .eq('supplier_id', supplierId)
                .order('name')

            if (search) {
                query = query.ilike('name', `%${search}%`)
            }

            const { data, error } = await query

            if (error) throw error
            
            // Map products to SupplierProduct interface
            const mappedProducts: SupplierProduct[] = (data || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                suppliersku: p.sku,
                internalsku: p.sku,
                category: p.category?.name || 'Sin categoría',
                unitprice: p.sale_price || 0,
                currency: 'USD', // Default
                availability: p.stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
                minimumorderquantity: p.min_stock || 1
            }))

            setProducts(mappedProducts)
        } catch (error) {
            console.error('Error fetching products:', error)
            toast.error('Error al cargar productos')
        } finally {
            setLoading(false)
        }
    }, [supplierId, search, supabase])

    useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    const getAvailabilityBadge = (status: string | null) => {
        switch (status) {
            case 'in_stock':
                return <Badge className="bg-green-100 text-green-800 border-green-200">En Stock</Badge>
            case 'low_stock':
                return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Stock Bajo</Badge>
            case 'out_of_stock':
                return <Badge className="bg-red-100 text-red-800 border-red-200">Sin Stock</Badge>
            case 'discontinued':
                return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Descontinuado</Badge>
            default:
                return <Badge variant="outline">Desconocido</Badge>
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar productos..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="icon" onClick={fetchProducts}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-muted/20">
                    <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No se encontraron productos para este proveedor</p>
                </div>
            ) : (
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>SKU Prov.</TableHead>
                                <TableHead>SKU Int.</TableHead>
                                <TableHead>Precio</TableHead>
                                <TableHead>Disponibilidad</TableHead>
                                <TableHead>Min. Orden</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.suppliersku || '-'}</TableCell>
                                    <TableCell>{product.internalsku || '-'}</TableCell>
                                    <TableCell>
                                        {new Intl.NumberFormat('es-AR', {
                                            style: 'currency',
                                            currency: product.currency || 'USD'
                                        }).format(product.unitprice)}
                                    </TableCell>
                                    <TableCell>{getAvailabilityBadge(product.availability)}</TableCell>
                                    <TableCell>{product.minimumorderquantity}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
