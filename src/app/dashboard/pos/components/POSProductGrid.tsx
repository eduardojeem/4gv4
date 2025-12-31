/**
 * POS Product Grid Component - Optimización Fase 4
 * Grid de productos separado con virtualización
 */

import React, { memo, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { VirtualizedProductGrid } from './VirtualizedProductList';
import type { Product } from '../types';

interface POSProductGridProps {
  products: Product[];
  searchTerm: string;
  selectedCategory: string;
  onAddToCart: (product: Product) => void;
  isLoading?: boolean;
  getCartQuantity?: (productId: string) => number;
}

const ProductCard = memo<{
  product: Product;
  onAddToCart: (product: Product) => void;
}>(({ product, onAddToCart }) => {
  const isLowStock = product.stock <= (product.minStock || 5);
  const isOutOfStock = product.stock <= 0;

  return (
    <Card className={`cursor-pointer transition-all hover:shadow-md ${
      isOutOfStock ? 'opacity-50' : ''
    }`}>
      <CardContent className="p-4">
        <div className="flex flex-col h-full">
          {/* Product Image */}
          <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover rounded-lg"
                loading="lazy"
              />
            ) : (
              <Package className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1">
            <h3 className="font-medium text-sm mb-1 line-clamp-2">
              {product.name}
            </h3>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-primary">
                {formatCurrency(product.price)}
              </span>
              
              <div className="flex items-center gap-1">
                {isLowStock && !isOutOfStock && (
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                )}
                <Badge 
                  variant={isOutOfStock ? 'destructive' : isLowStock ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {product.stock}
                </Badge>
              </div>
            </div>

            <Button
              onClick={() => onAddToCart(product)}
              disabled={isOutOfStock}
              size="sm"
              className="w-full"
            >
              <Plus className="h-3 w-3 mr-1" />
              {isOutOfStock ? 'Sin Stock' : 'Agregar'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';

export const POSProductGrid: React.FC<POSProductGridProps> = memo(({
  products,
  searchTerm,
  selectedCategory,
  onAddToCart,
  isLoading = false,
  getCartQuantity
}) => {
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.barcode?.includes(searchTerm);
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="aspect-square bg-muted rounded-lg mb-3" />
              <div className="h-4 bg-muted rounded mb-2" />
              <div className="h-6 bg-muted rounded mb-2" />
              <div className="h-8 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No se encontraron productos</h3>
        <p className="text-muted-foreground">
          {searchTerm || selectedCategory !== 'all' 
            ? 'Intenta ajustar los filtros de búsqueda'
            : 'No hay productos disponibles'
          }
        </p>
      </div>
    );
  }

  // Usar virtualización para listas grandes
  if (filteredProducts.length > 50) {
    return (
      <VirtualizedProductGrid
        products={filteredProducts}
        onAddToCart={onAddToCart}
        getCartQuantity={getCartQuantity || (() => 0)}
        height={600}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {filteredProducts.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
});

POSProductGrid.displayName = 'POSProductGrid';