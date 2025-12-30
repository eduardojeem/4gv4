'use client'

import { memo } from 'react'
import { Product } from '@/types/product'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Package, MoreHorizontal, Edit, Trash2, Eye, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductListProps {
    products: Product[]
    viewMode: 'grid' | 'table'
    onEdit: (product: Product) => void
    onDelete: (id: string) => void
    onView?: (product: Product) => void
    onDuplicate?: (product: Product) => void
    loading?: boolean
    selectedProducts?: string[]
    onSelectProduct?: (id: string) => void
}

export const ProductList = memo(function ProductList({
    products,
    viewMode,
    onEdit,
    onDelete,
    onView,
    onDuplicate,
    loading = false,
    selectedProducts = [],
    onSelectProduct
}: ProductListProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <Package className="h-12 w-12 animate-pulse text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Cargando productos...</p>
                </div>
            </div>
        )
    }

    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay productos</h3>
                <p className="text-sm text-muted-foreground">
                    No se encontraron productos con los filtros aplicados
                </p>
            </div>
        )
    }

    if (viewMode === 'grid') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onView={onView}
                        onDuplicate={onDuplicate}
                        selected={selectedProducts.includes(product.id)}
                        onSelect={onSelectProduct}
                    />
                ))}
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {products.map((product) => (
                        <ProductRow
                            key={product.id}
                            product={product}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onView={onView}
                            onDuplicate={onDuplicate}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    )
})

interface ProductCardProps {
    product: Product
    onEdit: (product: Product) => void
    onDelete: (id: string) => void
    onView?: (product: Product) => void
    onDuplicate?: (product: Product) => void
    selected?: boolean
    onSelect?: (id: string) => void
}

const ProductCard = memo(function ProductCard({
    product,
    onEdit,
    onDelete,
    onView,
    onDuplicate,
    selected,
    onSelect
}: ProductCardProps) {
    const stockStatus = getStockStatus(product.stock_quantity, product.min_stock)

    return (
        <Card className={cn(
            "hover:shadow-md transition-shadow",
            selected && "ring-2 ring-primary"
        )}>
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                        <h3 className="font-semibold text-sm line-clamp-1">{product.name}</h3>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {onView && (
                                <DropdownMenuItem onClick={() => onView(product)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Ver
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onEdit(product)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                            </DropdownMenuItem>
                            {onDuplicate && (
                                <DropdownMenuItem onClick={() => onDuplicate(product)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicar
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={() => onDelete(product.id)}
                                className="text-red-600"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Stock</span>
                        <Badge variant={stockStatus.variant as any}>
                            {product.stock_quantity}
                        </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Precio</span>
                        <span className="font-semibold text-sm">
                            ${product.sale_price.toLocaleString()}
                        </span>
                    </div>
                    {product.category && (
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Categoría</span>
                            <span className="text-xs">{product.category.name}</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
})

interface ProductRowProps {
    product: Product
    onEdit: (product: Product) => void
    onDelete: (id: string) => void
    onView?: (product: Product) => void
    onDuplicate?: (product: Product) => void
}

const ProductRow = memo(function ProductRow({
    product,
    onEdit,
    onDelete,
    onView,
    onDuplicate
}: ProductRowProps) {
    const stockStatus = getStockStatus(product.stock_quantity, product.min_stock)

    return (
        <TableRow>
            <TableCell>
                <div>
                    <p className="font-medium">{product.name}</p>
                    {product.brand && (
                        <p className="text-xs text-muted-foreground">{product.brand}</p>
                    )}
                </div>
            </TableCell>
            <TableCell className="font-mono text-sm">{product.sku}</TableCell>
            <TableCell>{product.category?.name || '-'}</TableCell>
            <TableCell>
                <Badge variant={stockStatus.variant as any}>
                    {product.stock_quantity}
                </Badge>
            </TableCell>
            <TableCell className="text-right font-semibold">
                ${product.sale_price.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {onView && (
                            <DropdownMenuItem onClick={() => onView(product)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onEdit(product)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                        </DropdownMenuItem>
                        {onDuplicate && (
                            <DropdownMenuItem onClick={() => onDuplicate(product)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                            onClick={() => onDelete(product.id)}
                            className="text-red-600"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    )
})

function getStockStatus(current: number, min: number) {
    if (current === 0) {
        return { status: 'out', label: 'Agotado', variant: 'destructive' }
    } else if (current <= min) {
        return { status: 'low', label: 'Bajo', variant: 'warning' }
    } else {
        return { status: 'ok', label: 'Normal', variant: 'success' }
    }
}
