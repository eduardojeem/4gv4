/**
 * POS Cart Component - Optimización Fase 4
 * Carrito de compras separado y optimizado
 */

import React, { memo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard,
  Tag,
  Percent,
  Store,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  discount?: number;
  variant?: string;
  wholesalePrice?: number;
  isService?: boolean;
  sku?: string;
  image?: string;
  stock?: number;
}

interface POSCartProps {
  items: CartItem[];
  // Actions
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onApplyDiscount?: (id: string, discount: number) => void;
  onCheckout: () => void;
  onClearCart: () => void;
  onApplyPromoCode?: (code: string) => void;
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
  onApplyDiscount?: (id: string, discount: number) => void;
}>(({ item, isWholesale, onUpdateQuantity, onRemoveItem, onApplyDiscount }) => {
  const WHOLESALE_DISCOUNT_RATE = 10;
  const isService = item.isService === true;
  
  const unitPrice = (isWholesale && !isService)
    ? (item.wholesalePrice ?? (item.price * (1 - WHOLESALE_DISCOUNT_RATE / 100))) 
    : item.price;
    
  const itemTotal = unitPrice * item.quantity;
  const itemDiscountRate = item.discount || 0;
  const itemDiscountValue = itemTotal * (itemDiscountRate / 100);
  const finalTotal = itemTotal - itemDiscountValue;
  
  const [localQty, setLocalQty] = useState(item.quantity.toString());

  React.useEffect(() => {
    setLocalQty(item.quantity.toString());
  }, [item.quantity]);

  // Stock warning
  const isLowStock = typeof item.stock === 'number' && !isService && item.stock <= 5;
  const isStockCritical = typeof item.stock === 'number' && !isService && item.stock <= 2;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative transition-all border rounded-lg mb-2 overflow-hidden group", 
        isService 
          ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30" 
          : "bg-card border-border/40 hover:border-primary/20 hover:shadow-sm"
      )}
    > 
      <div className={cn(
        "grid grid-cols-[60px_1fr_auto] gap-3 p-3 items-center",
      )}>
        {/* Image */}
        <div className="h-14 w-14 rounded-md bg-muted/40 border border-border/40 overflow-hidden flex items-center justify-center shrink-0 relative">
          {item.image ? (
            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <ShoppingCart className="h-6 w-6 text-muted-foreground/30" />
          )}
          {isService && (
            <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
              <WrenchIcon className="h-6 w-6 text-blue-500" />
            </div>
          )}
        </div>

        {/* Info & Controls */}
        <div className="min-w-0 flex flex-col justify-between h-full gap-2">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm truncate leading-tight">{item.name}</h4>
              </div>
              
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                {item.sku && <span className="font-mono text-[10px] opacity-80">{item.sku}</span>}
                {item.variant && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal">
                    {item.variant}
                  </Badge>
                )}
                {typeof item.stock === 'number' && !isService && (
                  <span className={cn(
                    "text-[10px] font-medium flex items-center gap-1", 
                    isLowStock ? "text-amber-600 dark:text-amber-500" : ""
                  )}>
                    {isLowStock && <AlertTriangle className="h-3 w-3" />}
                    {item.stock} disp.
                  </span>
                )}
              </div>
            </div>

            {/* Price Column */}
            <div className="text-right shrink-0">
               <div className="font-bold text-sm text-foreground">
                {formatCurrency(finalTotal)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {item.quantity} x {formatCurrency(unitPrice)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Qty Controls */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5 border border-border/50 self-start">
              {!isService ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                    className="h-6 w-6 hover:bg-background hover:text-destructive rounded-sm"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  
                  <Input
                    className="h-6 w-10 p-0 text-center border-none bg-transparent text-xs font-bold tabular-nums focus-visible:ring-0 shadow-none"
                    value={localQty}
                    onChange={(e) => setLocalQty(e.target.value)}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      if (val > (item.stock || 999)) {
                        onUpdateQuantity(item.id, item.stock || 1);
                      } else {
                        onUpdateQuantity(item.id, Math.max(1, val));
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="h-6 w-6 hover:bg-background hover:text-primary rounded-sm"
                    disabled={typeof item.stock === 'number' && item.quantity >= item.stock}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                 <Badge variant="secondary" className="h-6 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    SERVICIO
                 </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* Discount */}
              {onApplyDiscount && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-7 w-7 rounded-full",
                        itemDiscountRate > 0 ? "text-green-600 bg-green-50 dark:bg-green-900/20" : "text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                    >
                      <Percent className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-3" align="end">
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold">Descuento por ítem</h5>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="%"
                          className="h-8 text-xs"
                          defaultValue={itemDiscountRate > 0 ? itemDiscountRate : ''}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = Number((e.target as HTMLInputElement).value);
                              onApplyDiscount(item.id, val);
                            }
                          }}
                        />
                        <Button 
                          size="sm" 
                          className="h-8 px-2 text-[10px]"
                          onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            onApplyDiscount(item.id, Number(input.value));
                          }}
                        >
                          OK
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Remove */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveItem(item.id)}
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      {(item as any).showSeparator && <Separator className="opacity-30" />}
    </motion.div>
  );
});

// Helper Icon
function WrenchIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

CartItemRow.displayName = 'CartItemRow';

export const POSCart: React.FC<POSCartProps> = memo(({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onApplyDiscount,
  onCheckout,
  onClearCart,
  onApplyPromoCode,
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

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  if (items.length === 0) {
    return (
      <Card className="h-full flex flex-col shadow-md border-border/50">
        <CardHeader className="border-b bg-muted/20 py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" />
            Carrito de Compras
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-transparent to-muted/5">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="bg-primary/5 p-6 rounded-full mb-6 relative"
          >
            <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20" />
            <ShoppingCart className="h-16 w-16 text-primary/40" />
          </motion.div>
          <h3 className="font-bold text-xl mb-2 text-foreground/80">Carrito vacío</h3>
          <p className="text-sm text-muted-foreground max-w-[240px] leading-relaxed">
            Explora el catálogo o escanea productos para comenzar la venta.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col shadow-md border-border/50 overflow-hidden bg-background/50 backdrop-blur-sm">
      <CardHeader className="py-3 px-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Carrito Actual</span>
          </div>
          <Badge variant="secondary" className="px-2.5 text-xs font-normal">
            {items.length} {items.length === 1 ? 'item' : 'items'} / {cartItemCount} un.
          </Badge>
        </div>
      </CardHeader>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 scroll-smooth">
          <AnimatePresence mode="popLayout">
            {items.map((item, index) => (
              <CartItemRow
                key={item.id}
                item={{ ...item, showSeparator: false } as any}
                isWholesale={isWholesale}
                onUpdateQuantity={onUpdateQuantity}
                onRemoveItem={onRemoveItem}
                onApplyDiscount={onApplyDiscount}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Controls & Totals Section */}
        <div className="sticky bottom-0 bg-card border-t shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.1)] z-10">
          
          {/* Controls: Wholesale & Discount */}
          <div className="px-4 py-3 bg-muted/10 grid grid-cols-2 gap-3 border-b">
            <div className="flex items-center space-x-2">
              <Switch 
                id="wholesale-mode" 
                checked={isWholesale}
                onCheckedChange={onToggleWholesale}
                className="scale-90"
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
                className="h-7 text-xs pr-6"
              />
              <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground">%</span>
            </div>
          </div>
          {typeof onApplyPromoCode === 'function' && (
            <div className="col-span-2 flex items-center gap-2">
              <Input
                id="pos-promo-code"
                type="text"
                placeholder="Código promocional"
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement
                  if (e.key === 'Enter' && target.value.trim()) {
                    onApplyPromoCode(target.value.trim())
                    target.value = ''
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  const el = (document.activeElement as HTMLInputElement)
                  const input = el && el.tagName === 'INPUT' ? el : (document.querySelector('#pos-promo-code') as HTMLInputElement | null)
                  if (input && input.value.trim()) {
                    onApplyPromoCode(input.value.trim())
                    input.value = ''
                  }
                }}
              >
                Aplicar
              </Button>
            </div>
          )}
        </div>

          {/* Totals Breakdown */}
          <div className="p-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotalNonWholesale)}</span>
            </div>

            {totalSavings > 0 && (
              <div className="flex justify-between text-xs text-green-600 dark:text-green-400 font-medium animate-in slide-in-from-left-2">
                <span className="flex items-center gap-1">
                  <Percent className="h-3 w-3" /> Ahorro Total
                </span>
                <span>-{formatCurrency(totalSavings)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Impuesto ({(taxRate * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(cartTax)}</span>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between items-end">
              <span className="text-lg font-bold">Total</span>
              <span className="text-2xl font-bold text-primary tracking-tight">
                {formatCurrency(cartTotal)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isProcessing}
                    className="col-span-1 h-12 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title="Vaciar Carrito"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Vaciar el carrito?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción eliminará todos los productos del carrito actual. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        onClearCart();
                        setIsClearDialogOpen(false);
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Vaciar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <Button
                onClick={onCheckout}
                disabled={isProcessing}
                className="pos-button-primary col-span-3 h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all"
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

POSCart.displayName = 'POSCart';
