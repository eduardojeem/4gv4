import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Edit, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  sku?: string;
}

interface SimpleProductListProps {
  products: Product[];
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  className?: string;
}

const SimpleProductList: React.FC<SimpleProductListProps> = ({
  products,
  onEdit,
  onDelete,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {products.map((product) => {
        const isLowStock = product.stock < 10;

        return (
          <Card key={product.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{product.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">
                          {product.category}
                        </span>
                        {product.sku && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <code className="text-xs bg-muted px-1 rounded">
                              {product.sku}
                            </code>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        ${product.price.toFixed(2)}
                      </div>
                      <Badge 
                        variant={isLowStock ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        Stock: {product.stock}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-1 ml-4">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(product)}
                      aria-label={`Editar ${product.name}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(product.id)}
                      aria-label={`Eliminar ${product.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {products.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No hay productos para mostrar</p>
        </div>
      )}
    </div>
  );
};

export default SimpleProductList;