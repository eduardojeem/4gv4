import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import {
  Edit,
  Trash2,
  Eye,
  ArrowUpDown,
  Search,
  Filter,
  Download
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  sku?: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ProductTableAdvancedProps {
  products: Product[];
  selectedProducts?: string[];
  onSelectProduct?: (productId: string) => void;
  onSelectAll?: () => void;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  onView?: (product: Product) => void;
  onExport?: () => void;
  className?: string;
}

type SortField = 'name' | 'price' | 'category' | 'stock' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

const ProductTableAdvanced: React.FC<ProductTableAdvancedProps> = ({
  products,
  selectedProducts = [],
  onSelectProduct,
  onSelectAll,
  onEdit,
  onDelete,
  onView,
  onExport,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const isAllSelected = products.length > 0 && selectedProducts.length === products.length;
  const isIndeterminate = selectedProducts.length > 0 && selectedProducts.length < products.length;

  // Get unique categories for filter
  const categories = Array.from(new Set(products.map(p => p.category)));

  // Filter and sort products
  const filteredAndSortedProducts = React.useMemo(() => {
    const filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    return filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, searchTerm, sortField, sortDirection, categoryFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortButton: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-semibold"
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {categoryFilter || 'Todas las categorías'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setCategoryFilter('')}>
                Todas las categorías
              </DropdownMenuItem>
              {categories.map(category => (
                <DropdownMenuItem
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                >
                  {category}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        )}
      </div>

      {/* Results info */}
      <div className="text-sm text-muted-foreground">
        Mostrando {filteredAndSortedProducts.length} de {products.length} productos
        {selectedProducts.length > 0 && ` • ${selectedProducts.length} seleccionados`}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {onSelectProduct && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isIndeterminate ? 'indeterminate' : isAllSelected}
                    onCheckedChange={(checked) => onSelectAll?.()}
                    aria-label="Seleccionar todos los productos"
                  />
                </TableHead>
              )}
              <TableHead>
                <SortButton field="name">Producto</SortButton>
              </TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>
                <SortButton field="category">Categoría</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="price">Precio</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="stock">Stock</SortButton>
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedProducts.map((product) => {
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

        {filteredAndSortedProducts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm || categoryFilter ?
              'No se encontraron productos que coincidan con los filtros' :
              'No se encontraron productos'
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductTableAdvanced;