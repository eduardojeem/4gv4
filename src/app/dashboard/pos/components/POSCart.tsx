/**
 * POS Cart Component — Redesign Premium
 * Carrito de compras optimizado con diseño premium
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
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { resolveProductImageUrl } from '@/lib/images';
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
  taxRate?: number;
  canCheckout?: boolean;
  checkoutDisabledReason?: string;
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
  const imageSrc = typeof item.image === 'string' && item.image.trim().length > 0
    ? resolveProductImageUrl(item.image.trim())
    : ''

  React.useEffect(() => {
    setLocalQty(item.quantity.toString());
  }, [item.quantity]);

  const isLowStock = typeof item.stock === 'number' && !isService && item.stock <= 5;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative transition-all rounded-xl mb-2 overflow-hidden group", 
        isService 
          ? "bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30" 
          : "bg-card border border-border/40 hover:border-primary/20 hover:shadow-sm"
      )}
    > 
      <div className="grid grid-cols-[48px_1fr_auto] gap-2.5 p-2.5 items-center">
        {/* Image */}
        <div className="h-12 w-12 rounded-lg bg-muted/30 border border-border/30 overflow-hidden flex items-center justify-center shrink-0">
          {imageSrc ? (
            <img src={imageSrc} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <ShoppingCart className="h-5 w-5 text-muted-foreground/20" />
          )}
        </div>

        {/* Info & Controls */}
        <div className="min-w-0 flex flex-col gap-1.5">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <h4 className="font-semibold text-[13px] truncate leading-tight">{item.name}</h4>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                {item.sku && <span className="font-mono opacity-80">{item.sku}</span>}
                {item.variant && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-normal">
                    {item.variant}
                  </Badge>
                )}
                {isService && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    SERVICIO
                  </Badge>
                )}
              </div>
            </div>

            {/* Price Column */}
            <div className="text-right shrink-0">
              <div className="font-bold text-sm text-foreground tabular-nums">
                {formatCurrency(finalTotal)}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {item.quantity} × {formatCurrency(unitPrice)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Qty Controls */}
            {!isService ? (
              <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5 border border-border/40">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                  className="h-6 w-6 hover:bg-background hover:text-destructive rounded-md"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                
                <Input
                  className="h-6 w-9 p-0 text-center border-none bg-transparent text-xs font-bold tabular-nums focus-visible:ring-0 shadow-none"
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
                  className="h-6 w-6 hover:bg-background hover:text-primary rounded-md"
                  disabled={typeof item.stock === 'number' && item.quantity >= item.stock}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div />
            )}

            {/* Actions */}
            <div className="flex items-center gap-0.5">
              {/* Discount */}
              {onApplyDiscount && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-6 w-6 rounded-full",
                        itemDiscountRate > 0 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                    >
                      <Percent className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-3" align="end">
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold">Descuento por item</h5>
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
                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
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
  onApplyPromoCode,
  isWholesale,
  onToggleWholesale,
  discount,
  onUpdateDiscount,
  subtotalApplied,
  subtotalNonWholesale,
  generalDiscountAmount,
  wholesaleDiscountAmount,
  totalSavings,
  cartTax,
  cartTotal,
  cartItemCount,
  isProcessing = false,
  taxRate = 0.19,
  canCheckout = true,
  checkoutDisabledReason
}) => {

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [showPricingOptions, setShowPricingOptions] = useState(false);

  // ─── Empty state ─────────────────────────────────────────
  if (items.length === 0) {
    return (
      <Card className="h-full flex flex-col shadow-sm border-border/50 rounded-xl">
        <CardHeader className="border-b bg-muted/10 py-3 px-4 rounded-t-xl">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ShoppingCart className="h-4 w-4" />
            Carrito de Compras
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="bg-muted/30 p-5 rounded-2xl mb-5">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/20" />
          </div>
          <h3 className="font-semibold text-base mb-1.5 text-foreground/70">Carrito vacío</h3>
          <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed">
            Seleccioná productos del catálogo o escaneá un código de barras para empezar.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ─── Cart with items ─────────────────────────────────────
  return (
    <Card className="h-full flex flex-col shadow-sm border-border/50 overflow-hidden rounded-xl bg-background/80 backdrop-blur-sm">
      {/* Header */}
      <CardHeader className="py-2.5 px-4 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-primary/10">
              <ShoppingCart className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-semibold text-sm">Carrito</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-2 text-[10px] font-semibold tabular-nums">
              {items.length} {items.length === 1 ? 'item' : 'items'} · {cartItemCount} un.
            </Badge>
            <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isProcessing}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                  title="Vaciar Carrito"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Vaciar el carrito?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará todos los productos del carrito actual. No se puede deshacer.
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
          </div>
        </div>
      </CardHeader>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 scroll-smooth">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                isWholesale={isWholesale}
                onUpdateQuantity={onUpdateQuantity}
                onRemoveItem={onRemoveItem}
                onApplyDiscount={onApplyDiscount}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Bottom section: Controls + Totals + CTA */}
        <div className="bg-card border-t shadow-[0_-2px_8px_-3px_rgba(0,0,0,0.08)] z-10">
          <div className="max-h-[34vh] overflow-y-auto">
          
            {/* Collapsible Controls: Wholesale, Discount, Promo */}
            <div className="px-4 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground w-full justify-between"
                onClick={() => setShowPricingOptions(v => !v)}
              >
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3 w-3" />
                  Opciones de precio
                </span>
                {showPricingOptions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {showPricingOptions && (
              <div className="px-4 py-3 bg-muted/10 grid grid-cols-2 gap-3 border-b border-border/30">
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
                  <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
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
            )}

            {/* Totals Breakdown */}
            <div className="px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotalNonWholesale)}</span>
              </div>

              {totalSavings > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Ahorro
                  </span>
                  <span className="tabular-nums">-{formatCurrency(totalSavings)}</span>
                </div>
              )}

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Impuesto ({(taxRate * 100).toFixed(0)}%)</span>
                <span className="tabular-nums">{formatCurrency(cartTax)}</span>
              </div>
            </div>
          </div>

          {/* Sticky CTA — Single total + prominent button */}
          <div className="p-3 border-t border-border/40 bg-gradient-to-t from-background to-background/95">
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total</p>
                <p className="text-xl font-bold text-primary leading-tight tabular-nums">{formatCurrency(cartTotal)}</p>
              </div>
              <Button
                onClick={onCheckout}
                disabled={isProcessing || !canCheckout}
                title={checkoutDisabledReason}
                className={cn(
                  "ml-auto h-11 px-6 text-sm font-bold rounded-xl shadow-md transition-all",
                  "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary hover:shadow-lg hover:scale-[1.02]",
                  "active:scale-[0.98]"
                )}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Cobrar
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
