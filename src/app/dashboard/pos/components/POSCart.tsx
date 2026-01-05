/**
 * POS Cart Component - Optimización Fase 4
 * Carrito de compras separado y optimizado
 */

import React, { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard,
  FileText,
  Tag
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  discount?: number;
  variant?: string;
}

interface POSCartProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onApplyDiscount: (id: string, discount: number) => void;
  onCheckout: () => void;
  onClearCart: () => void;
  isProcessing?: boolean;
  taxRate?: number;
}

const CartItemRow = memo<{
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onApplyDiscount: (id: string, discount: number) => void;
}>(({ item, onUpdateQuantity, onRemoveItem, onApplyDiscount }) => {
  const itemTotal = item.price * item.quantity;
  const discountAmount = item.discount ? (itemTotal * item.discount / 100) : 0;
  const finalTotal = itemTotal - discountAmount;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{item.name}</h4>
        {item.variant && (
          <p className="text-xs text-muted-foreground">{item.variant}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-medium">
            {formatCurrency(item.price)}
          </span>
          {item.discount && (
            <Badge variant="secondary" className="text-xs">
              -{item.discount}%
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
          className="h-8 w-8 p-0"
        >
          <Minus className="h-3 w-3" />
        </Button>
        
        <span className="w-8 text-center text-sm font-medium">
          {item.quantity}
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          className="h-8 w-8 p-0"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="text-right min-w-[80px]">
        <div className="font-medium text-sm">
          {formatCurrency(finalTotal)}
        </div>
        {discountAmount > 0 && (
          <div className="text-xs text-muted-foreground line-through">
            {formatCurrency(itemTotal)}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemoveItem(item.id)}
        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3 w-3" />
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
  isProcessing = false,
  taxRate = 0.21
}) => {
  const calculations = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const discountAmount = item.discount ? (itemTotal * item.discount / 100) : 0;
      return sum + (itemTotal - discountAmount);
    }, 0);
    
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    return { subtotal, tax, total, totalItems };
  }, [items, taxRate]);

  if (items.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrito de Compras
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium mb-1">Tu carrito está vacío</p>
            <p className="text-sm">Selecciona productos para comenzar una venta</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrito
          </div>
          <Badge variant="secondary">
            {calculations.totalItems} items
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto max-h-[400px]">
          {items.map(item => (
            <CartItemRow
              key={item.id}
              item={item}
              onUpdateQuantity={onUpdateQuantity}
              onRemoveItem={onRemoveItem}
              onApplyDiscount={onApplyDiscount}
            />
          ))}
        </div>

        <Separator className="my-4" />

        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>{formatCurrency(calculations.subtotal)}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span>IVA ({(taxRate * 100).toFixed(0)}%):</span>
            <span>{formatCurrency(calculations.tax)}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>{formatCurrency(calculations.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            onClick={onClearCart}
            disabled={isProcessing}
            className="flex-1 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            title="Vaciar todos los productos del carrito"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Vaciar Carrito
          </Button>
          
          <Button
            onClick={onCheckout}
            disabled={isProcessing || items.length === 0}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Procesando...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Procesar Pago
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

POSCart.displayName = 'POSCart';