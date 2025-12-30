import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2, Eye } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  sku?: string;
  description?: string;
}

interface ProductTableProps {
  products: Product[];
  selectedProducts?: string[];
  onSelectProduct?: (productId: string) => void;
  onSelectAll?: () => void;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  onView?: (product: Product) => void;
  className?: string;
}

const ProductTable: React.FC<ProductTableProps> = ({
  products,
  selectedProducts = [],
  onSelectProduct,
  onSelectAll,
  onEdit,
  onDelete,
  onView,
  className = ''
}) => {
  const isAllSelected = products.length > 0 && selectedProducts.length === products.length;
  const isIndeterminate = selectedProducts.length > 0 && selectedProducts.length < products.length;

  return (
    <div className={`rounded-md border ${className}`}>
      <Table>
        <TableHeader>
          <TableRow>
            {onSelectProduct && (
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) (el as HTMLInputElement).indeterminate = isIndeterminate;
                  }}
                  onCheckedChange={onSelectAll}
                  aria-label="Seleccionar todos los productos"
                />
              </TableHead>
            )}
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const isSelected = selectedProducts.includes(product.id);
            const isLowStock = product.stock < 10;

            return (
              <TableRow
                key={product.id}
                className={isSelected ? 'bg-muted/50' : ''}
              >
                {onSelectProduct && (
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onSelectProduct(product.id)}
                      aria-label={`Seleccionar ${product.name}`}
                    />
                  </TableCell>
                )}
                
                <TableCell className="font-medium">
                  <div>
                    <div className="font-semibold">{product.name}</div>
                    {product.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {product.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {product.sku || 'N/A'}
                  </code>
                </TableCell>
                
                <TableCell>
                  <Badge variant="outline">{product.category}</Badge>
                </TableCell>
                
                <TableCell className="text-right font-semibold">
                  ${product.price.toFixed(2)}
                </TableCell>
                
                <TableCell className="text-right">
                  <Badge variant={isLowStock ? "destructive" : "secondary"}>
                    {product.stock}
                  </Badge>
                </TableCell>
                
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {onView && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(product)}
                        aria-label={`Ver detalles de ${product.name}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      
      {products.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No se encontraron productos
        </div>
      )}
    </div>
  );
};

export default ProductTable;