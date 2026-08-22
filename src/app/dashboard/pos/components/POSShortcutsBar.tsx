'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  UserPlus, 
  CreditCard, 
  PauseCircle, 
  Tag, 
  RotateCcw,
  Keyboard,
  Wrench
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface POSShortcutsBarProps {
  onFocusSearch: () => void
  onOpenCustomer: () => void
  onCheckout: () => void
  onHoldSale: () => void
  onOpenHeldSales: () => void
  heldSalesCount: number
  onToggleWholesale: () => void
  isWholesale: boolean
  onClearCart: () => void
  onOpenRepairModal: () => void
  canCheckout: boolean
  cartItemCount: number
  className?: string
}

export function POSShortcutsBar({
  onFocusSearch,
  onOpenCustomer,
  onCheckout,
  onHoldSale,
  onOpenHeldSales,
  heldSalesCount,
  onToggleWholesale,
  isWholesale,
  onClearCart,
  onOpenRepairModal,
  canCheckout,
  cartItemCount,
  className
}: POSShortcutsBarProps) {
  return (
    <footer
      className={cn(
        "hidden md:flex items-center justify-between gap-2 px-4 py-2 bg-card/95 border-t border-border/70 backdrop-blur text-xs z-20 select-none",
        className
      )}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
          <Keyboard className="h-3.5 w-3.5" /> Atajos:
        </span>

        {/* F2: Buscar */}
        <button
          type="button"
          onClick={onFocusSearch}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-foreground transition-colors border border-border/50"
          title="Buscar productos (F2)"
        >
          <kbd className="px-1 py-0.5 rounded bg-background border font-mono text-[10px] font-bold text-muted-foreground shadow-2xs">F2</kbd>
          <Search className="h-3 w-3 text-primary" />
          <span>Buscar</span>
        </button>

        {/* F3: Cliente */}
        <button
          type="button"
          onClick={onOpenCustomer}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-foreground transition-colors border border-border/50"
          title="Seleccionar o registrar cliente (F3)"
        >
          <kbd className="px-1 py-0.5 rounded bg-background border font-mono text-[10px] font-bold text-muted-foreground shadow-2xs">F3</kbd>
          <UserPlus className="h-3 w-3 text-blue-500" />
          <span>Cliente</span>
        </button>

        {/* F4 / Espacio: Cobrar */}
        <button
          type="button"
          onClick={onCheckout}
          disabled={!canCheckout}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors border shadow-2xs",
            canCheckout
              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold"
              : "opacity-50 cursor-not-allowed bg-muted/40 text-muted-foreground border-border/40"
          )}
          title="Cobrar venta actual (F4)"
        >
          <kbd className="px-1 py-0.5 rounded bg-background border font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">F4</kbd>
          <CreditCard className="h-3 w-3 text-emerald-500" />
          <span>Cobrar ({cartItemCount})</span>
        </button>

        {/* F8: Pausar / En Espera */}
        <button
          type="button"
          onClick={cartItemCount > 0 ? onHoldSale : onOpenHeldSales}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors border shadow-2xs",
            heldSalesCount > 0
              ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 font-medium"
              : "bg-muted/60 hover:bg-muted text-foreground border-border/50"
          )}
          title={cartItemCount > 0 ? "Poner venta actual en espera (F8)" : "Ver ventas en espera (F8)"}
        >
          <kbd className="px-1 py-0.5 rounded bg-background border font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">F8</kbd>
          <PauseCircle className="h-3 w-3 text-amber-500" />
          <span>{cartItemCount > 0 ? 'Pausar' : 'En Espera'}</span>
          {heldSalesCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-amber-500 text-white font-bold rounded-full">
              {heldSalesCount}
            </Badge>
          )}
        </button>

        {/* F9: Mayorista */}
        <button
          type="button"
          onClick={onToggleWholesale}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors border",
            isWholesale
              ? "bg-blue-600 text-white border-blue-700 font-semibold"
              : "bg-muted/60 hover:bg-muted text-foreground border-border/50"
          )}
          title="Alternar lista de precios mayorista (F9)"
        >
          <kbd className={cn("px-1 py-0.5 rounded border font-mono text-[10px] font-bold", isWholesale ? "bg-blue-700 text-white border-blue-800" : "bg-background text-muted-foreground")}>F9</kbd>
          <Tag className="h-3 w-3" />
          <span>{isWholesale ? 'Mayorista Activo' : 'Minorista'}</span>
        </button>

        {/* Cobrar Reparación */}
        <button
          type="button"
          onClick={onOpenRepairModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 transition-colors border border-indigo-500/30 font-medium"
          title="Cobrar saldo o entrega de reparación"
        >
          <Wrench className="h-3 w-3 text-indigo-500" />
          <span>Cobrar Reparación</span>
        </button>
      </div>

      {/* Esc: Cancelar / Limpiar */}
      {cartItemCount > 0 && (
        <button
          type="button"
          onClick={onClearCart}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
          title="Vaciar carrito (Esc)"
        >
          <kbd className="px-1 py-0.5 rounded bg-background border font-mono text-[10px] text-muted-foreground">Esc</kbd>
          <RotateCcw className="h-3 w-3" />
          <span>Vaciar</span>
        </button>
      )}
    </footer>
  )
}
