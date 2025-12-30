import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  sku?: string;
}

interface ProductCardCompactProps {
  product: Product;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  className?: string;
}

const ProductCardCompact: React.FC<ProductCardCompactProps> = ({
  product,
  onEdit,
  onDelete,
  className = ''
}) => {
  const isLowStock = product.stock < 10;

  return (
    <Card className={`hover:shadow-sm transition-shadow ${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium truncate text-sm">{product.name}</h4>
              <span className="font-bold text-sm text-green-600">
                ${product.price.toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {product.category}
                </Badge>
                {product.sku && (
                  <code className="text-xs bg-muted px-1 rounded">
                    {product.sku}
                  </code>
                )}
              </div>
              
              <Badge 
                variant={isLowStock ? "destructive" : "secondary"}
                className="text-xs"
              >
                {product.stock}
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(product)}
                aria-label={`Editar ${product.name}`}
                className="h-7 w-7 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(product.id)}
                aria-label={`Eliminar ${product.name}`}
                className="h-7 w-7 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCardCompact;