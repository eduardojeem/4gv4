import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';

interface FilterOptions {
  categories: string[];
  priceRanges: { label: string; min: number; max: number }[];
  stockStatuses: { label: string; value: string }[];
}

interface ActiveFilters {
  search?: string;
  category?: string;
  priceRange?: { min: number; max: number };
  stockStatus?: string;
}

interface ProductFiltersProps {
  filters: ActiveFilters;
  options: FilterOptions;
  onFiltersChange: (filters: ActiveFilters) => void;
  onClearFilters: () => void;
  className?: string;
}

const ProductFilters: React.FC<ProductFiltersProps> = ({
  filters,
  options,
  onFiltersChange,
  onClearFilters,
  className = ''
}) => {
  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== '' && value !== null
  );

  const handleSearchChange = (value: string) => {
    onFiltersChange({
      ...filters,
      search: value || undefined
    });
  };

  const handleCategoryChange = (value: string) => {
    onFiltersChange({
      ...filters,
      category: value === 'all' ? undefined : value
    });
  };

  const handlePriceRangeChange = (value: string) => {
    if (value === 'all') {
      onFiltersChange({
        ...filters,
        priceRange: undefined
      });
    } else {
      const range = options.priceRanges.find(r => `${r.min}-${r.max}` === value);
      if (range) {
        onFiltersChange({
          ...filters,
          priceRange: { min: range.min, max: range.max }
        });
      }
    }
  };

  const handleStockStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      stockStatus: value === 'all' ? undefined : value
    });
  };

  const removeFilter = (filterKey: keyof ActiveFilters) => {
    onFiltersChange({
      ...filters,
      [filterKey]: undefined
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and main filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Filter */}
        <Select
          value={filters.category || 'all'}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {options.categories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Price Range Filter */}
        <Select
          value={filters.priceRange ? `${filters.priceRange.min}-${filters.priceRange.max}` : 'all'}
          onValueChange={handlePriceRangeChange}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Rango de precio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los precios</SelectItem>
            {options.priceRanges.map(range => (
              <SelectItem key={`${range.min}-${range.max}`} value={`${range.min}-${range.max}`}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stock Status Filter */}
        <Select
          value={filters.stockStatus || 'all'}
          onValueChange={handleStockStatusChange}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado de stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {options.stockStatuses.map(status => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="whitespace-nowrap"
          >
            <X className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Filter className="h-3 w-3" />
            Filtros activos:
          </div>
          
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Búsqueda: "{filters.search}"
              <button
                onClick={() => removeFilter('search')}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.category && (
            <Badge variant="secondary" className="gap-1">
              Categoría: {filters.category}
              <button
                onClick={() => removeFilter('category')}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.priceRange && (
            <Badge variant="secondary" className="gap-1">
              Precio: ${filters.priceRange.min} - ${filters.priceRange.max}
              <button
                onClick={() => removeFilter('priceRange')}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.stockStatus && (
            <Badge variant="secondary" className="gap-1">
              Stock: {options.stockStatuses.find(s => s.value === filters.stockStatus)?.label}
              <button
                onClick={() => removeFilter('stockStatus')}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductFilters;