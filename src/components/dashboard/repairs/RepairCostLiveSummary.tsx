'use client'

import { useState } from 'react'
import {
  CircleDollarSign,
  ReceiptText,
  TrendingUp,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Wallet,
  ArrowUpRight,
  Scale
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency'
import type { RepairCostSummary } from '@/lib/repairs/cost-breakdown'
import { useCanViewCost } from '@/hooks/use-can-view-cost'
import { cn } from '@/lib/utils'

export function RepairCostLiveSummary({
  summary,
  onOpenFinanceGuide
}: {
  summary: RepairCostSummary
  onOpenFinanceGuide?: () => void
}) {
  const canViewCost = useCanViewCost()
  const [showFinanceGuide, setShowFinanceGuide] = useState(false)

  const includedTax = summary.taxBreakdown.reduce((total, row) => total + row.taxAmount, 0)
  const discounts = summary.discountAmount + summary.deductions
  const totalInternalCost = summary.partsInternalCost ?? 0
  const finalTotal = summary.finalTotal ?? 0
  const grossProfit = Math.max(0, finalTotal - totalInternalCost)
  const profitMargin = finalTotal > 0 ? (grossProfit / finalTotal) * 100 : 0

  // Diagnóstico financiero y de rentabilidad
  const getProfitStatus = (margin: number, total: number, internalCost: number) => {
    if (total <= 0) return { label: 'Sin facturación', color: 'neutral', icon: HelpCircle, desc: 'Ingresá importes para evaluar rentabilidad' }
    if (total < internalCost) return { label: 'Pérdida Crítica', color: 'danger', icon: ShieldAlert, desc: 'El precio al cliente no cubre el costo de repuestos' }
    if (margin >= 50) return { label: 'Excelente (50%+)', color: 'emerald', icon: Sparkles, desc: 'Margen óptimo con alta rentabilidad en servicios' }
    if (margin >= 30) return { label: 'Saludable (30%-50%)', color: 'teal', icon: TrendingUp, desc: 'Margen estándar adecuado para el taller' }
    if (margin >= 15) return { label: 'Margen Ajustado (15%-30%)', color: 'amber', icon: Scale, desc: 'Poco margen para imprevistos o garantías' }
    return { label: 'Baja Rentabilidad (<15%)', color: 'rose', icon: AlertTriangle, desc: 'Revisá los precios de venta o costos de piezas' }
  }

  const profitStatus = getProfitStatus(profitMargin, finalTotal, totalInternalCost)
  const costPercentage = finalTotal > 0 ? Math.min(100, (totalInternalCost / finalTotal) * 100) : 0
  const profitPercentage = Math.max(0, 100 - costPercentage)

  return (
    <aside aria-label="Resumen de costos" className="h-fit overflow-hidden rounded-xl border bg-card lg:sticky lg:top-0 shadow-xs">
      {/* Cabecera del resumen */}
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-sm font-semibold">Resumen en tiempo real</h3>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">PYG</span>
      </div>

      {/* Desglose de Líneas */}
      <dl className="space-y-2.5 px-4 py-3.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Mano de obra adicional</dt>
          <dd className="font-medium tabular-nums">{formatCurrency(summary.laborAmount)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Servicios técnicos</dt>
          <dd className="font-medium tabular-nums">{formatCurrency(summary.servicesSubtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Repuestos cobrados</dt>
          <dd className="font-medium tabular-nums">{formatCurrency(summary.chargedPartsSubtotal)}</dd>
        </div>

        {canViewCost && summary.includedMaterialsInternalCost > 0 && (
          <div className="rounded-lg bg-amber-50/80 p-2.5 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
            <div className="flex justify-between gap-4">
              <dt className="text-xs font-semibold text-amber-900 dark:text-amber-200">Materiales incluidos</dt>
              <dd className="text-xs font-bold tabular-nums text-amber-900 dark:text-amber-200">{formatCurrency(summary.includedMaterialsInternalCost)}</dd>
            </div>
            <p className="mt-1 text-[10px] text-amber-800/80 dark:text-amber-300/80 leading-tight">
              Costo asumido por el taller (estaño, flux, pegamento). Gs. 0 adicional al cliente.
            </p>
          </div>
        )}

        <div className="flex justify-between gap-4 border-t pt-2.5 font-medium">
          <dt>Subtotal antes de descuentos</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(summary.subtotalBeforeDiscount)}</dd>
        </div>

        {summary.additionalCharges > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Cargos adicionales</dt>
            <dd className="tabular-nums font-medium text-foreground">+{formatCurrency(summary.additionalCharges)}</dd>
          </div>
        )}

        {discounts > 0 && (
          <div className="flex justify-between gap-4 text-rose-600 dark:text-rose-400">
            <dt>Descuentos y deducciones</dt>
            <dd className="tabular-nums font-semibold">- {formatCurrency(discounts)}</dd>
          </div>
        )}

        <div className="flex justify-between gap-4 text-xs text-muted-foreground">
          <dt>IVA incluido</dt>
          <dd className="tabular-nums">{formatCurrency(includedTax)}</dd>
        </div>
      </dl>

      {/* Monto Total Final y Estado de Caja */}
      <div className="border-t bg-gradient-to-b from-emerald-50/80 to-emerald-100/40 px-4 py-3.5 dark:from-emerald-950/30 dark:to-emerald-950/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
            <CircleDollarSign className="h-4 w-4" />
            <span>Total a Cobrar</span>
          </div>
          <span className="text-[10px] font-medium text-emerald-800/70 dark:text-emerald-300/70">
            Cliente
          </span>
        </div>
        <p
          data-testid="editor-final-total"
          aria-live="polite"
          className="mt-1 text-3xl font-black tracking-tight text-emerald-700 tabular-nums dark:text-emerald-300"
        >
          {formatCurrency(summary.finalTotal)}
        </p>

        {/* Pagado vs Saldo pendiente */}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-200/80 pt-2.5 text-xs dark:border-emerald-900/60">
          <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Pagado / Seña</p>
            <p className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums text-sm mt-0.5">
              {formatCurrency(summary.paidAmount)}
            </p>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-right">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Saldo al Entregar</p>
            <p className={cn("font-bold tabular-nums text-sm mt-0.5", summary.balance > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-300")}>
              {formatCurrency(summary.balance)}
            </p>
          </div>
        </div>
      </div>

      {/* Impacto Financiero y Rentabilidad (Solo usuarios autorizados) */}
      {canViewCost && (
        <div className="border-t bg-gradient-to-b from-indigo-50/60 via-indigo-50/30 to-background p-4 dark:from-indigo-950/30 dark:via-indigo-950/10 dark:to-background space-y-3">
          {/* Encabezado con estado de rentabilidad */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Impacto en Finanzas</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "font-bold text-[10px] px-2 py-0.5 shadow-2xs",
                profitMargin >= 30
                  ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : profitMargin >= 15
                  ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  : "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
              )}
            >
              {profitMargin.toFixed(1)}% Margen
            </Badge>
          </div>

          {/* Barra visual de distribución financiera */}
          {finalTotal > 0 && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                <div
                  className="bg-slate-400 dark:bg-slate-600 transition-all"
                  style={{ width: `${costPercentage}%` }}
                  title={`Costo interno de reposición: ${costPercentage.toFixed(0)}%`}
                />
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${profitPercentage}%` }}
                  title={`Ganancia bruta: ${profitPercentage.toFixed(0)}%`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>Costo: {costPercentage.toFixed(0)}%</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Ganancia: {profitPercentage.toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {/* Tarjetas de métricas financieras */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-2.5 shadow-2xs">
              <span className="text-[10px] font-semibold text-muted-foreground block uppercase">
                Costo Reposición
              </span>
              <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-200 mt-0.5">
                {formatCurrency(totalInternalCost)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Costo de inventario</p>
            </div>

            <div className="rounded-xl border border-emerald-200/80 bg-white dark:border-emerald-900/60 dark:bg-slate-900/60 p-2.5 shadow-2xs">
              <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 block uppercase">
                Utilidad Bruta
              </span>
              <p className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                +{formatCurrency(grossProfit)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Ganancia del taller</p>
            </div>
          </div>

          {/* Diagnóstico contextual */}
          <div className="rounded-xl bg-indigo-100/50 dark:bg-indigo-950/40 p-2 text-xs border border-indigo-200/60 dark:border-indigo-900/50 flex items-start gap-2">
            <profitStatus.icon className="h-4 w-4 text-indigo-700 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-indigo-950 dark:text-indigo-200">{profitStatus.label}</p>
              <p className="text-[11px] text-indigo-900/80 dark:text-indigo-300/80 leading-tight mt-0.5">
                {profitStatus.desc}
              </p>
            </div>
          </div>

          {/* Acordeón didáctico: ¿Cómo funciona y cómo impacta en las finanzas? */}
          <div className="border-t border-indigo-200/60 dark:border-indigo-900/50 pt-2">
            <button
              type="button"
              onClick={() => setShowFinanceGuide(!showFinanceGuide)}
              className="flex w-full items-center justify-between text-[11px] font-semibold text-indigo-900 dark:text-indigo-300 hover:underline py-1"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-indigo-600" />
                ¿Cómo impacta en las finanzas del taller?
              </span>
              {showFinanceGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showFinanceGuide && (
              <div className="mt-2 space-y-2 text-[11px] text-muted-foreground bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 leading-relaxed">
                <div>
                  <strong className="text-foreground font-semibold">1. Mano de obra:</strong> Ingreso 100% operativo. No consume capital de repuestos y es la base de rentabilidad del taller.
                </div>
                <div>
                  <strong className="text-foreground font-semibold">2. Repuestos:</strong> El cliente paga el precio final; el taller recupera el costo mayorista para reponer stock. La diferencia es el margen comercial.
                </div>
                <div>
                  <strong className="text-foreground font-semibold">3. Materiales incluidos:</strong> Consumibles (estaño, flux) absorbidos por el taller para que el balance contable sea exacto y sin desvíos.
                </div>
                <div>
                  <strong className="text-foreground font-semibold">4. Flujo de caja:</strong> Lo cobrado hoy entra a la caja física o banco; el saldo pendiente queda registrado para la entrega del equipo.
                </div>
                {onOpenFinanceGuide && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenFinanceGuide}
                    className="w-full mt-2 h-7 text-xs font-semibold bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1.5 shadow-2xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Ver Ejemplos Prácticos en Guaraníes</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
