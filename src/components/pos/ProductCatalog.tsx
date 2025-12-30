'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Grid3X3, List, ScanLine, Filter, CheckCircle, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InventoryProduct } from '@/hooks/useInventory'
import { formatCurrency } from '@/lib/currency'
import { normalizeBarcode, isValidEan, getBarcodeType } from '@/lib/barcode-validator'
import { toast } from 'sonner'

interface ProductCatalogProps {
    products: InventoryProduct[]
    onAddToCart: (product: InventoryProduct, quantity?: number) => void
    loading?: boolean
    onBarcodeSearch?: (barcode: string) => Promise<InventoryProduct | null>
    searchRef?: React.RefObject<HTMLInputElement>
}

export function ProductCatalog({ products, onAddToCart, loading, onBarcodeSearch, searchRef }: ProductCatalogProps) {
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [showScanner, setShowScanner] = useState(false)
    const [barcodeInput, setBarcodeInput] = useState('')
    const [barcodeValidation, setBarcodeValidation] = useState<'valid' | 'invalid' | null>(null)
    const barcodeInputRef = useRef<HTMLInputElement>(null)

    // Auto-focus barcode input when scanner is shown
    useEffect(() => {
        if (showScanner && barcodeInputRef.current) {
            barcodeInputRef.current.focus()
        }
    }, [showScanner])

    // Validate barcode on input
    useEffect(() => {
        if (barcodeInput.length >= 8) {
            const normalized = normalizeBarcode(barcodeInput)
            const isValid = isValidEan(normalized)
            setBarcodeValidation(isValid ? 'valid' : 'invalid')
        } else {
            setBarcodeValidation(null)
        }
    }, [barcodeInput])

    // Handle barcode search
    const handleBarcodeSearch = async () => {
        if (!barcodeInput.trim()) return

        const normalized = normalizeBarcode(barcodeInput)

        if (!isValidEan(normalized)) {
            toast.error('Código de barras inválido')
            return
        }

        // First try local products
        const localProduct = products.find(p => p.barcode === normalized)

        if (localProduct) {
            onAddToCart(localProduct)
            toast.success(`${localProduct.name} agregado`)
            setBarcodeInput('')
            return
        }

        // Try database search if callback provided
        if (onBarcodeSearch) {
            const product = await onBarcodeSearch(normalized)
            if (product) {
                onAddToCart(product)
                toast.success(`${product.name} agregado`)
                setBarcodeInput('')
                return
            }
        }

        toast.error('Producto no encontrado')
    }

    // Handle barcode input on Enter
    const handleBarcodeKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBarcodeSearch()
        }
    }

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set(products.map(p => p.category))
        return Array.from(cats).sort()
    }, [products])

    // Filter products
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch =
                product.name.toLowerCase().includes(search.toLowerCase()) ||
                product.sku.toLowerCase().includes(search.toLowerCase()) ||
                product.barcode?.toLowerCase().includes(search.toLowerCase())

            const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter

            return matchesSearch && matchesCategory && product.is_active
        })
    }, [products, search, categoryFilter])

    if (loading) {
        return (
            <Card>
                <CardContent className="p-12">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600">Cargando productos...</span>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {/* Search and Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                ref={searchRef}
                                placeholder="Buscar por nombre, SKU o código de barras..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Category Filter */}
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full md:w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las categorías</SelectItem>
                                {categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* View Mode Toggle */}
                        <div className="flex gap-2">
                            <Button
                                variant={viewMode === 'grid' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                            >
                                <Grid3X3 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowScanner(!showScanner)}
                            >
                                <ScanLine className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Results Count */}
                    <div className="mt-3 text-sm text-gray-600">
                        {filteredProducts.length} productos encontrados
                    </div>
                </CardContent>
            </Card>

            {/* Barcode Scanner */}
            {showScanner && (
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <ScanLine className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-900">
                                        Escanear Código de Barras
                                    </span>
                                    {barcodeValidation && (
                                        barcodeValidation === 'valid' ? (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-600" />
                                        )
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        ref={barcodeInputRef}
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        onKeyPress={handleBarcodeKeyPress}
                                        placeholder="Escanee o ingrese código de barras..."
                                        className={`font-mono ${barcodeValidation === 'valid' ? 'border-green-500' :
                                            barcodeValidation === 'invalid' ? 'border-red-500' : ''
                                            }`}
                                    />
                                    <Button
                                        onClick={handleBarcodeSearch}
                                        disabled={!barcodeInput.trim() || barcodeValidation === 'invalid'}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        Buscar
                                    </Button>
                                </div>
                                {barcodeInput.length >= 8 && (
                                    <div className="mt-2 text-xs">
                                        <span className="text-gray-600">Tipo: </span>
                                        <Badge variant="outline" className="text-xs">
                                            {getBarcodeType(barcodeInput)}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setShowScanner(false)
                                    setBarcodeInput('')
                                    setBarcodeValidation(null)
                                }}
                            >
                                Cerrar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Products Grid/List */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredProducts.map(product => (
                        <Card
                            key={product.id}
                            className="hover:shadow-lg transition-shadow cursor-pointer group"
                            onClick={() => onAddToCart(product)}
                        >
                            <CardContent className="p-4">
                                {/* Product Image/Icon */}
                                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                                    {product.image ? (
                                        <span className="text-4xl">{product.image}</span>
                                    ) : (
                                        <div className="text-gray-400 text-sm">Sin imagen</div>
                                    )}
                                </div>

                                {/* Product Info */}
                                <div className="space-y-2">
                                    <h3 className="font-medium text-sm line-clamp-2 group-hover:text-blue-600">
                                        {product.name}
                                    </h3>

                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-bold text-blue-600">
                                            {formatCurrency(product.price)}
                                        </span>
                                        <Badge variant={product.stock_quantity > 10 ? 'default' : 'destructive'}>
                                            Stock: {product.stock_quantity}
                                        </Badge>
                                    </div>

                                    <div className="text-xs text-gray-500">
                                        SKU: {product.sku}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-4"
                                    onClick={() => onAddToCart(product)}
                                >
                                    {/* Image */}
                                    <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center shrink-0">
                                        {product.image ? (
                                            <span className="text-2xl">{product.image}</span>
                                        ) : (
                                            <div className="text-gray-400 text-xs">Sin imagen</div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium truncate">{product.name}</h3>
                                        <div className="text-sm text-gray-600">
                                            SKU: {product.sku} • {product.category}
                                        </div>
                                    </div>

                                    {/* Price and Stock */}
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-blue-600">
                                            {formatCurrency(product.price)}
                                        </div>
                                        <Badge variant={product.stock_quantity > 10 ? 'default' : 'destructive'} className="mt-1">
                                            Stock: {product.stock_quantity}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {filteredProducts.length === 0 && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <div className="text-gray-400 mb-2">
                            <Search className="h-12 w-12 mx-auto mb-3" />
                        </div>
                        <h3 className="font-medium text-gray-900 mb-1">No se encontraron productos</h3>
                        <p className="text-gray-600 text-sm">Intenta con otros términos de búsqueda</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
