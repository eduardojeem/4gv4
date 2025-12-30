import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Package, TrendingDown, TrendingUp, X } from 'lucide-react';

interface InventoryFilters {
  stockLevel?: 'low' | 'normal' | 'high' | 'out';
  movement?: 'fast' | 'slow' | 'static';
  minStock?: number;
  maxStock?: number;
  categories?: string[];
  showOutOfStock?: boolean;
  showLowStock?: boolean;
}

interface InventoryFiltersProps {
  filters: InventoryFilters;
  availableCategories: string[];
  onFiltersChange: (filters: InventoryFilters) => void;
  onClearFilters: () => void;
  className?: string;
}

const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  filters,
  availableCategories,
  onFiltersChange,
  onClearFilters,
  className = ''
}) => {
  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== null && 
    (Array.isArray(value) ? value.length > 0 : true)
  );

  const updateFilter = (key: keyof InventoryFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const toggleCategory = (category: string) => {
    const currentCategories = filters.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    updateFilter('categories', newCategories.length > 0 ? newCategories : undefined);
  };

  const removeFilter = (filterKey: keyof InventoryFilters) => {
    updateFilter(filterKey, undefined);
  };

  const stockLevelOptions = [
    { value: 'out', label: 'Sin stock', icon: AlertTriangle, color: 'destructive' },
    { value: 'low', label: 'Stock bajo', icon: TrendingDown, color: 'warning' },
    { value: 'normal', label: 'Stock normal', icon: Package, color: 'secondary' },
    { value: 'high', label: 'Stock alto', icon: TrendingUp, color: 'success' },
  ];

  const movementOptions = [
    { value: 'fast', label: 'Movimiento rápido', icon: TrendingUp },
    { value: 'slow', label: 'Movimiento lento', icon: TrendingDown },
    { value: 'static', label: 'Sin movimiento', icon: Package },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Quick Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stock Level */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Nivel de Stock</Label>
          <Select
            value={filters.stockLevel || ''}
            onValueChange={(value) => updateFilter('stockLevel', value || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar nivel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los niveles</SelectItem>
              {stockLevelOptions.map(option => {
                const Icon = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Movement */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Movimiento</Label>
          <Select
            value={filters.movement || ''}
            onValueChange={(value) => updateFilter('movement', value || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de movimiento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los movimientos</SelectItem>
              {movementOptions.map(option => {
                const Icon = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Min Stock */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Stock Mínimo</Label>
          <Input
            type="number"
            placeholder="0"
            value={filters.minStock || ''}
            onChange={(e) => updateFilter('minStock', e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>

        {/* Max Stock */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Stock Máximo</Label>
          <Input
            type="number"
            placeholder="999999"
            value={filters.maxStock || ''}
            onChange={(e) => updateFilter('maxStock', e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>
      </div>

      {/* Alert Toggles */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showOutOfStock"
            checked={filters.showOutOfStock || false}
            onCheckedChange={(checked) => updateFilter('showOutOfStock', checked || undefined)}
          />
          <Label htmlFor="showOutOfStock" className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Mostrar productos sin stock
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showLowStock"
            checked={filters.showLowStock || false}
            onCheckedChange={(checked) => updateFilter('showLowStock', checked || undefined)}
          />
          <Label htmlFor="showLowStock" className="flex items-center gap-2 text-sm">
            <TrendingDown className="h-4 w-4 text-warning" />
            Mostrar productos con stock bajo
          </Label>
        </div>
      </div>

      {/* Categories */}
      {availableCategories.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Categorías</Label>
          <div className="flex flex-wrap gap-2">
            {availableCategories.map(category => (
              <Badge
                key={category}
                variant={filters.categories?.includes(category) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Filtros Activos</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Limpiar todos
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {filters.stockLevel && (
              <Badge variant="secondary" className="gap-1">
                Nivel: {stockLevelOptions.find(o => o.value === filters.stockLevel)?.label}
                <button
                  onClick={() => removeFilter('stockLevel')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filters.movement && (
              <Badge variant="secondary" className="gap-1">
                Movimiento: {movementOptions.find(o => o.value === filters.movement)?.label}
                <button
                  onClick={() => removeFilter('movement')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filters.minStock !== undefined && (
              <Badge variant="secondary" className="gap-1">
                Min: {filters.minStock}
                <button
                  onClick={() => removeFilter('minStock')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filters.maxStock !== undefined && (
              <Badge variant="secondary" className="gap-1">
                Max: {filters.maxStock}
                <button
                  onClick={() => removeFilter('maxStock')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filters.categories && filters.categories.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                Categorías: {filters.categories.length}
                <button
                  onClick={() => removeFilter('categories')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryFilters;
export { InventoryFilters };