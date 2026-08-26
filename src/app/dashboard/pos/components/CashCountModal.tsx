'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Banknote,
  Coins,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { formatCurrency, formatThousands, parseThousands } from '@/lib/currency'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { cn } from '@/lib/utils'

export interface CashCount {
  bills: Record<string, number>
  coins: Record<string, number>
  total: number
}

interface CashCountModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (count: CashCount, note?: string) => void
  systemBalance: number
  title?: string
  currency?: string
}

type Denomination = {
  value: number
  label: string
}

const CURRENCY_DENOMINATIONS: Record<string, { bills: Denomination[]; coins: Denomination[] }> = {
  PYG: {
    bills: [
      { value: 100000, label: '100.000' },
      { value: 50000, label: '50.000' },
      { value: 20000, label: '20.000' },
      { value: 10000, label: '10.000' },
      { value: 5000, label: '5.000' },
      { value: 2000, label: '2.000' }
    ],
    coins: [
      { value: 1000, label: '1.000' },
      { value: 500, label: '500' },
      { value: 100, label: '100' },
      { value: 50, label: '50' }
    ]
  },
  USD: {
    bills: [
      { value: 100, label: '$100' },
      { value: 50, label: '$50' },
      { value: 20, label: '$20' },
      { value: 10, label: '$10' },
      { value: 5, label: '$5' },
      { value: 2, label: '$2' },
      { value: 1, label: '$1' }
    ],
    coins: [
      { value: 1, label: '$1.00' },
      { value: 0.50, label: '50¢' },
      { value: 0.25, label: '25¢' },
      { value: 0.10, label: '10¢' },
      { value: 0.05, label: '5¢' },
      { value: 0.01, label: '1¢' }
    ]
  },
  BRL: {
    bills: [
      { value: 200, label: 'R$ 200' },
      { value: 100, label: 'R$ 100' },
      { value: 50, label: 'R$ 50' },
      { value: 20, label: 'R$ 20' },
      { value: 10, label: 'R$ 10' },
      { value: 5, label: 'R$ 5' },
      { value: 2, label: 'R$ 2' }
    ],
    coins: [
      { value: 1, label: 'R$ 1.00' },
      { value: 0.50, label: '50¢' },
      { value: 0.25, label: '25¢' },
      { value: 0.10, label: '10¢' },
      { value: 0.05, label: '5¢' }
    ]
  },
  ARS: {
    bills: [
      { value: 20000, label: '$20.000' },
      { value: 10000, label: '$10.000' },
      { value: 2000, label: '$2.000' },
      { value: 1000, label: '$1.000' },
      { value: 500, label: '$500' },
      { value: 200, label: '$200' },
      { value: 100, label: '$100' }
    ],
    coins: [
      { value: 100, label: '$100' },
      { value: 50, label: '$50' },
      { value: 20, label: '$20' },
      { value: 10, label: '$10' }
    ]
  },
  EUR: {
    bills: [
      { value: 500, label: '€500' },
      { value: 200, label: '€200' },
      { value: 100, label: '€100' },
      { value: 50, label: '€50' },
      { value: 20, label: '€20' },
      { value: 10, label: '€10' },
      { value: 5, label: '€5' }
    ],
    coins: [
      { value: 2, label: '€2.00' },
      { value: 1, label: '€1.00' },
      { value: 0.50, label: '50c' },
      { value: 0.20, label: '20c' },
      { value: 0.10, label: '10c' },
      { value: 0.05, label: '5c' }
    ]
  }
}

export function CashCountModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  systemBalance,
  title = "Arqueo de Caja",
  currency: propCurrency
}: CashCountModalProps) {
  const { settings } = useSharedSettings()
  const activeCurrency = propCurrency || settings.currency || 'PYG'

  const denominations = useMemo(() => {
    return CURRENCY_DENOMINATIONS[activeCurrency] || CURRENCY_DENOMINATIONS.PYG
  }, [activeCurrency])

  const [billCounts, setBillCounts] = useState<Record<string, number>>({})
  const [coinCounts, setCoinCounts] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')

  useEffect(() => {
    if (isOpen) {
      setBillCounts({})
      setCoinCounts({})
      setNote('')
    }
  }, [isOpen])

  const billTotal = useMemo(() => {
    return denominations.bills.reduce((sum, denom) => {
      return sum + (denom.value * (billCounts[denom.value] || 0))
    }, 0)
  }, [billCounts, denominations.bills])

  const coinTotal = useMemo(() => {
    return denominations.coins.reduce((sum, denom) => {
      return sum + (denom.value * (coinCounts[denom.value] || 0))
    }, 0)
  }, [coinCounts, denominations.coins])

  const physicalTotal = billTotal + coinTotal
  const discrepancy = physicalTotal - systemBalance
  const isExact = Math.abs(discrepancy) < 1

  const handleBillCountChange = (denomination: number, count: string) => {
    const parsed = parseThousands(count)
    const numCount = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
    setBillCounts(prev => ({ ...prev, [denomination]: numCount }))
  }

  const handleCoinCountChange = (denomination: number, count: string) => {
    const parsed = parseThousands(count)
    const numCount = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
    setCoinCounts(prev => ({ ...prev, [denomination]: numCount }))
  }

  const handleIncrement = (type: 'bill' | 'coin', denom: number, delta: number) => {
    if (type === 'bill') {
      setBillCounts(prev => {
        const curr = prev[denom] || 0
        return { ...prev, [denom]: Math.max(0, curr + delta) }
      })
    } else {
      setCoinCounts(prev => {
        const curr = prev[denom] || 0
        return { ...prev, [denom]: Math.max(0, curr + delta) }
      })
    }
  }

  const handleReset = () => {
    setBillCounts({})
    setCoinCounts({})
    setNote('')
  }

  const handleConfirm = () => {
    const cashCount: CashCount = {
      bills: billCounts,
      coins: coinCounts,
      total: physicalTotal
    }
    onConfirm(cashCount, note.trim() || undefined)
    onClose()
    handleReset()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden p-0 gap-0 rounded-2xl bg-card border-border shadow-2xl flex flex-col">
        {/* Cabecera estilizada */}
        <DialogHeader className="p-5 sm:p-6 border-b bg-muted/30 text-left shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-foreground">
                    {title}
                  </DialogTitle>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-background">
                    {activeCurrency}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Conteo físico de billetes y monedas para auditar el saldo teórico en caja.
                </DialogDescription>
              </div>
            </div>
            {(Object.keys(billCounts).length > 0 || Object.keys(coinCounts).length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Limpiar
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Contenido con Scroll */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Card Resumen Rápido de Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Saldo Teórico
              </span>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {formatCurrency(systemBalance, { currency: activeCurrency })}
              </p>
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-1">
                Conteo Físico
              </span>
              <p className="text-xl font-bold tabular-nums text-primary">
                {formatCurrency(physicalTotal, { currency: activeCurrency })}
              </p>
            </div>

            <div className={cn(
              "rounded-xl border p-3.5 transition-colors",
              isExact
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200"
                : discrepancy > 0
                  ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
                  : "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200"
            )}>
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 opacity-80">
                Diferencia
              </span>
              <div className="flex items-center gap-1.5">
                {isExact ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Cuadrada</span>
                  </>
                ) : (
                  <>
                    {discrepancy > 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                    <span className={cn("text-lg font-bold tabular-nums", discrepancy > 0 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400")}>
                      {discrepancy > 0 ? '+' : ''}{formatCurrency(discrepancy, { currency: activeCurrency })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sección de Billetes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Billetes
                </h4>
              </div>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                Subtotal: {formatCurrency(billTotal, { currency: activeCurrency })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {denominations.bills.map((denom) => {
                const count = billCounts[denom.value] || 0
                const lineTotal = count * denom.value

                return (
                  <div
                    key={denom.value}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border transition-colors",
                      count > 0 ? "bg-primary/5 border-primary/40 shadow-2xs" : "bg-card border-border/60 hover:border-border"
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <Label className="text-xs font-bold text-foreground block cursor-pointer">
                        {denom.label}
                      </Label>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatCurrency(lineTotal, { currency: activeCurrency })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleIncrement('bill', denom.value, -1)}
                        disabled={count <= 0}
                        className="h-7 w-7 rounded-lg border border-border bg-background hover:bg-muted text-xs font-bold flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95"
                      >
                        -
                      </button>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={count > 0 ? formatThousands(count) : ''}
                        onChange={(e) => handleBillCountChange(denom.value, e.target.value)}
                        className="w-14 h-7 text-center text-xs font-mono font-bold px-1 rounded-lg"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => handleIncrement('bill', denom.value, 1)}
                        className="h-7 w-7 rounded-lg border border-border bg-background hover:bg-muted text-xs font-bold flex items-center justify-center transition-all active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sección de Monedas */}
          {denominations.coins.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Monedas
                  </h4>
                </div>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  Subtotal: {formatCurrency(coinTotal, { currency: activeCurrency })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {denominations.coins.map((denom) => {
                  const count = coinCounts[denom.value] || 0
                  const lineTotal = count * denom.value

                  return (
                    <div
                      key={denom.value}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-colors",
                        count > 0 ? "bg-amber-500/5 border-amber-500/40 shadow-2xs" : "bg-card border-border/60 hover:border-border"
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <Label className="text-xs font-bold text-foreground block cursor-pointer">
                          {denom.label}
                        </Label>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {formatCurrency(lineTotal, { currency: activeCurrency })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleIncrement('coin', denom.value, -1)}
                          disabled={count <= 0}
                          className="h-7 w-7 rounded-lg border border-border bg-background hover:bg-muted text-xs font-bold flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95"
                        >
                          -
                        </button>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={count > 0 ? formatThousands(count) : ''}
                          onChange={(e) => handleCoinCountChange(denom.value, e.target.value)}
                          className="w-14 h-7 text-center text-xs font-mono font-bold px-1 rounded-lg"
                          placeholder="0"
                        />
                        <button
                          type="button"
                          onClick={() => handleIncrement('coin', denom.value, 1)}
                          className="h-7 w-7 rounded-lg border border-border bg-background hover:bg-muted text-xs font-bold flex items-center justify-center transition-all active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div className="space-y-1.5">
            <Label htmlFor="count-note" className="text-xs font-semibold text-foreground">
              Observación del arqueo <span className="text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <Input
              id="count-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              placeholder="Ej. Arqueo ciego intermedio, diferencia justificada por vale de cambio..."
              className="h-9 text-xs rounded-xl"
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 sm:px-6 bg-muted/20 border-t border-border/50 flex flex-row items-center justify-between sm:justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-10 text-xs rounded-xl flex-1 sm:flex-none"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="h-10 text-xs font-bold rounded-xl gap-1.5 flex-1 sm:flex-none bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirmar Arqueo ({formatCurrency(physicalTotal, { currency: activeCurrency })})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}