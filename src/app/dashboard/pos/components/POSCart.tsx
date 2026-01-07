/**
 * POS Cart Component - Optimización Fase 4
 * Carrito de compras separado y optimizado
 */

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard,
  Tag,
  Percent,
  Store
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  discount?: number;
  variant?: string;
  wholesalePrice?: number;
  isService?: boolean;
}

interface POSCartProps {
  items: CartItem[];
  // Actions
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onApplyDiscount?: (id: string, discount: number) => void;
  onCheckout: () => void;
  onClearCart: () => void;
  // Wholesale & Discount State
  isWholesale: boolean;
  onToggleWholesale: (value: boolean) => void;
  discount: number;
  onUpdateDiscount: (value: number) => void;
  // Calculated Values (from hook)
  subtotalApplied: number;
  subtotalNonWholesale: number;
  generalDiscountAmount: number;
  wholesaleDiscountAmount: number;
  totalSavings: number;
  cartTax: number;
  cartTotal: number;
  cartItemCount: number;
  // UI State
  isProcessing?: boolean;
  taxRate?: number; // Visual only if needed, calculation done in hook
}

const CartItemRow = memo<{
  item: CartItem;
  isWholesale: boolean;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
}>(({ item, isWholesale, onUpdateQuantity, onRemoveItem }) => {
  const WHOLESALE_DISCOUNT_RATE = 10; // 10% default if not specified
  
  // Services don't get wholesale discount automatically applied unless specified
  const isService = item.isService === true;
  
  const unitPrice = (isWholesale && !isService)
    ? (item.wholesalePrice ?? (item.price * (1 - WHOLESALE_DISCOUNT_RATE / 100))) 
    : item.price;
    
  const itemTotal = unitPrice * item.quantity;
  const itemDiscount = item.discount || 0;
  const finalTotal = itemTotal * (1 - itemDiscount / 100);

  return (
    <div className={cn("flex items-center gap-3 py-3 group", isService && "bg-muted/10 rounded-md px-2 -mx-2")}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
           {isService && <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">SERV</Badge>}
           <h4 className="font-medium text-sm truncate">{item.name}</h4>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          {item.variant && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
              {item.variant}
            </Badge>
          )}
          <div className="flex items-center gap-1">
            <span className={cn(
              "text-sm font-medium", 
              (isWholesale && !isService) && "text-blue-600 dark:text-blue-400"
            )}>
              {formatCurrency(unitPrice)}
            </span>
            {(isWholesale && !isService) && item.wholesalePrice === undefined && (
              <span className="text-[10px] text-muted-foreground line-through">
                {formatCurrency(item.price)}
              </span>
            )}
          </div>
        </div>
        
        {item.discount && item.discount > 0 && (
          <div className="mt-1">
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              -{item.discount}% desc.
            </Badge>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 bg-secondary/20 rounded-md p-1">
        {!isService ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
              className="h-6 w-6 p-0 hover:bg-background shadow-sm"
            >
              <Minus className="h-3 w-3" />
            </Button>
            
            <span className="w-6 text-center text-sm font-medium tabular-nums">
              {item.quantity}
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              className="h-6 w-6 p-0 hover:bg-background shadow-sm"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <span className="w-14 text-center text-xs text-muted-foreground font-medium">
            Servicio
          </span>
        )}
      </div>

      <div className="text-right min-w-[70px]">
        <div className="font-medium text-sm">
          {formatCurrency(finalTotal)}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemoveItem(item.id)}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
});

CartItemRow.displayName = 'CartItemRow';

export const POSCart: React.FC<POSCartProps> = memo(({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onApplyDiscount,
  onCheckout,
  onClearCart,
  // Wholesale & Discount
  isWholesale,
  onToggleWholesale,
  discount,
  onUpdateDiscount,
  // Totals
  subtotalApplied,
  subtotalNonWholesale,
  generalDiscountAmount,
  wholesaleDiscountAmount,
  totalSavings,
  cartTax,
  cartTotal,
  cartItemCount,
  // UI
  isProcessing = false,
  taxRate = 0.19
}) => {

  if (items.length === 0) {
    return (
      <Card className="h-full flex flex-col shadow-md border-border/50">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5" />
            Carrito de Compras
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in-50">
          <div className="bg-muted/50 p-4 rounded-full mb-4">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <p className="font-medium text-lg mb-2">Tu carrito está vacío</p>
          <p className="text-sm text-muted-foreground max-w-[200px]">
            Selecciona productos del catálogo o escanea un código de barras para comenzar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col shadow-md border-border/50 overflow-hidden">
      <CardHeader className="py-3 px-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="font-semibold">Carrito Actual</span>
          </div>
          <Badge variant="secondary" className="px-2.5">
            {cartItemCount} items
          </Badge>
        </div>
      </CardHeader>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
          {items.map(item => (
            <React.Fragment key={item.id}>
              <CartItemRow
                item={item}
                isWholesale={isWholesale}
                onUpdateQuantity={onUpdateQuantity}
                onRemoveItem={onRemoveItem}
              />
              <Separator className="last:hidden opacity-50" />
            </React.Fragment>
          ))}
        </div>

        {/* Controls & Totals Section */}
        <div className="bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          
          {/* Controls: Wholesale & Discount */}
          <div className="px-4 py-3 bg-muted/10 grid grid-cols-2 gap-4 border-b">
            <div className="flex items-center space-x-2">
              <Switch 
                id="wholesale-mode" 
                checked={isWholesale}
                onCheckedChange={onToggleWholesale}
              />
              <Label htmlFor="wholesale-mode" className="text-xs font-medium cursor-pointer flex items-center gap-1">
                <Store className="h-3 w-3" />
                Mayorista
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Tag className="h-3 w-3 text-muted-foreground" />
              <div className="relative flex-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={discount > 0 ? discount : ''}
                  onChange={(e) => onUpdateDiscount(Number(e.target.value))}
                  placeholder="Desc. %"
                  className="h-8 text-xs pr-6"
                />
                <span className="absolute right-2 top-2 text-[10px] text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* Totals Breakdown */}
          <div className="p-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotalNonWholesale)}</span>
            </div>

            {totalSavings > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-medium animate-in slide-in-from-left-2">
                <span className="flex items-center gap-1">
                  <Percent className="h-3 w-3" /> Ahorro Total
                </span>
                <span>-{formatCurrency(totalSavings)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Impuesto ({(taxRate * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(cartTax)}</span>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between items-end">
              <span className="text-lg font-bold">Total</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(cartTotal)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              <Button
                variant="outline"
                onClick={onClearCart}
                disabled={isProcessing}
                className="col-span-1 h-12 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Vaciar Carrito"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
              <Button
                onClick={onCheckout}
                disabled={isProcessing}
                className="col-span-3 h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Cobrar {formatCurrency(cartTotal)}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
});