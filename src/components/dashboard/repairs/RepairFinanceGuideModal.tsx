'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Package,
  Layers,
  HelpCircle,
  X,
  Wallet,
  Coins,
  Scale,
  ShieldCheck,
  ArrowRight
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

interface RepairFinanceGuideModalProps {
  open: boolean
  onClose: () => void
}

export function RepairFinanceGuideModal({ open, onClose }: RepairFinanceGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'screen' | 'board' | 'risk'>('screen')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[96vw] sm:max-w-3xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
        {/* Header con gradiente */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-gradient-to-r from-cyan-500/10 via-slate-50 to-indigo-50/20 dark:from-cyan-950/40 dark:via-slate-900/60 dark:to-indigo-950/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                ¿Cómo funcionan los costos y cómo impactan en tus finanzas?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Guía práctica y ejemplos con cifras reales en Guaraníes (Gs.) para talleres técnicos
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-sm">
          {/* 1. Los 4 Pilares del Costo en el Taller */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-cyan-600" />
              1. Los 4 Pilares del Cálculo en Cada Orden
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl border border-cyan-200/70 bg-cyan-50/40 dark:border-cyan-900/40 dark:bg-cyan-950/20">
                <div className="flex items-center gap-1.5 font-bold text-cyan-950 dark:text-cyan-200 mb-1">
                  <Wrench className="h-4 w-4 text-cyan-600" />
                  <span>Mano de Obra (Servicio Técnico)</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Es <strong>ganancia operativa 100% libre</strong>. Representa el valor del tiempo, diagnóstico y habilidad del técnico. No consume piezas de tu stock.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-indigo-200/70 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                  <Package className="h-4 w-4 text-indigo-600" />
                  <span>Repuestos Cobrados (Inventario)</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  El cliente paga el precio de venta. De ese total, el taller <strong>recupera el costo de compra</strong> para reponer stock y retiene la diferencia como margen comercial.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-amber-200/70 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-200 mb-1">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <span>Materiales Incluidos (Consumibles)</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Insumos menores (estaño, flux, pegamento B7000, cables puente). El cliente paga <strong>Gs. 0 extra</strong>, pero el sistema deduce su costo interno para que la ganancia sea <strong>real y no engañosa</strong>.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950 dark:text-emerald-200 mb-1">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span>Margen de Rentabilidad (%)</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Fórmula: <code className="font-mono bg-white/70 dark:bg-slate-900/60 px-1 py-0.5 rounded">(Ganancia / Total Cobrado) × 100</code>. Es la brújula financiera que te indica si el trabajo sostiene la rentabilidad del taller.
                </p>
              </div>
            </div>
          </section>

          {/* 2. Ejemplos Prácticos Reales */}
          <section className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-cyan-600" />
                2. Ejemplos Prácticos en Guaraníes (Gs.)
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('screen')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                    activeTab === 'screen'
                      ? "bg-cyan-600 text-white shadow-2xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Caso A: Pantalla
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('board')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                    activeTab === 'board'
                      ? "bg-cyan-600 text-white shadow-2xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Caso B: Placa/Pin
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('risk')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                    activeTab === 'risk'
                      ? "bg-cyan-600 text-white shadow-2xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Caso C: Error de Margen
                </button>
              </div>
            </div>

            {/* CASO A: Pantalla con Repuesto */}
            {activeTab === 'screen' && (
              <div className="rounded-xl border border-cyan-200/80 bg-slate-50/50 dark:border-cyan-900/50 dark:bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                      <span>Caso A: Cambio de Módulo / Pantalla Samsung</span>
                      <Badge className="bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 font-bold text-[10px]">
                        Margen Saludable (46.4%)
                      </Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Combina el costo del repuesto con la mano de obra del técnico instalador.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border">
                    <span className="text-muted-foreground text-[11px] block">Costo Repuesto:</span>
                    <span className="font-bold font-mono text-slate-700 dark:text-slate-300 text-sm">
                      Gs. 150.000
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Costo de compra</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border">
                    <span className="text-muted-foreground text-[11px] block">Mano de Obra:</span>
                    <span className="font-bold font-mono text-cyan-600 dark:text-cyan-400 text-sm">
                      Gs. 130.000
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Servicio técnico</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border">
                    <span className="text-muted-foreground text-[11px] block">Total al Cliente:</span>
                    <span className="font-black font-mono text-foreground text-sm">
                      Gs. 280.000
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Precio final cobrado</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-emerald-800 dark:text-emerald-300 text-[11px] block font-semibold">Ganancia Taller:</span>
                    <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                      +Gs. 130.000
                    </span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block mt-0.5 font-bold">
                      46.4% de margen
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 text-xs text-cyan-950 dark:text-cyan-200 space-y-1">
                  <strong>Impacto en Finanzas:</strong> De los Gs. 280.000 que entran a caja, <strong>Gs. 150.000</strong> se reservan para reponer la pantalla en inventario y <strong>Gs. 130.000</strong> quedan libres para pagar la comisión del técnico y las utilidades del taller.
                </div>
              </div>
            )}

            {/* CASO B: Reparación de Placa (Microelectrónica) */}
            {activeTab === 'board' && (
              <div className="rounded-xl border border-emerald-200/80 bg-slate-50/50 dark:border-emerald-900/50 dark:bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                      <span>Caso B: Reparación de Placa / Pin de Carga / Reballing</span>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                        Excelente Rentabilidad (94%)
                      </Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Alto valor técnico. Prácticamente no consume piezas caras de repuesto.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border">
                    <span className="text-muted-foreground text-[11px] block">Costo Repuesto:</span>
                    <span className="font-bold font-mono text-slate-700 dark:text-slate-300 text-sm">
                      Gs. 0
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Sin pieza nueva</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border">
                    <span className="text-muted-foreground text-[11px] block">Consumibles Taller:</span>
                    <span className="font-bold font-mono text-amber-600 dark:text-amber-400 text-sm">
                      Gs. 15.000
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Estaño y flux</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border">
                    <span className="text-muted-foreground text-[11px] block">Total al Cliente:</span>
                    <span className="font-black font-mono text-foreground text-sm">
                      Gs. 250.000
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Servicio técnico</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-emerald-800 dark:text-emerald-300 text-[11px] block font-semibold">Ganancia Taller:</span>
                    <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                      +Gs. 235.000
                    </span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block mt-0.5 font-bold">
                      94% de margen
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs text-emerald-950 dark:text-emerald-200 space-y-1">
                  <strong>Impacto en Finanzas:</strong> Es el tipo de trabajo más rentable para el taller. Casi la totalidad de los <strong>Gs. 250.000</strong> ingresa como ganancia operativa neta, amortizando fácilmente los equipos e insumos del laboratorio.
                </div>
              </div>
            )}

            {/* CASO C: Error de Margen Crítico */}
            {activeTab === 'risk' && (
              <div className="rounded-xl border border-rose-200/80 bg-slate-50/50 dark:border-rose-900/50 dark:bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                      <span>Caso C: Descuento Excesivo o Repuesto Muy Caro</span>
                      <Badge className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px]">
                        Alerta Crítica (5.8%)
                      </Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Peligro financiero: El costo de la pieza absorbe casi toda la ganancia.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border">
                    <span className="text-muted-foreground text-[11px] block">Costo Repuesto:</span>
                    <span className="font-bold font-mono text-rose-700 dark:text-rose-400 text-sm">
                      Gs. 320.000
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Costo muy alto</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border">
                    <span className="text-muted-foreground text-[11px] block">Total al Cliente:</span>
                    <span className="font-bold font-mono text-slate-700 dark:text-slate-300 text-sm">
                      Gs. 340.000
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Cobro insuficiente</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                    <span className="text-rose-800 dark:text-rose-300 text-[11px] block font-semibold">Ganancia Taller:</span>
                    <span className="font-black font-mono text-rose-600 dark:text-rose-400 text-sm">
                      +Gs. 20.000
                    </span>
                    <span className="text-[10px] text-rose-700 dark:text-rose-400 block mt-0.5 font-bold">
                      5.8% de margen
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                    <span className="text-amber-800 dark:text-amber-300 text-[11px] block font-semibold">Riesgo Garantía:</span>
                    <span className="font-black font-mono text-amber-600 dark:text-amber-400 text-sm">
                      Pérdida Inminente
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Si falla la pieza</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-xs text-rose-950 dark:text-rose-200 space-y-1">
                  <strong>Peligro Financiero:</strong> Ganar solo <strong>Gs. 20.000</strong> por arriesgar una pieza de Gs. 320.000 no compensa el tiempo técnico ni la luz del local. Si el cliente regresa por garantía, el taller entra automáticamente en <strong>pérdida económica de más de Gs. 300.000</strong>.
                </div>
              </div>
            )}
          </section>

          {/* 3. Tabla Semáforo de Rentabilidad */}
          <section className="space-y-2.5 pt-2 border-t">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-cyan-600" />
              3. Semáforo de Rentabilidad del Taller
            </h3>

            <div className="overflow-hidden rounded-xl border text-xs">
              <table className="w-full text-left">
                <thead className="bg-muted/50 font-semibold uppercase text-muted-foreground text-[10px]">
                  <tr>
                    <th className="p-2.5">Rango de Margen</th>
                    <th className="p-2.5">Diagnóstico</th>
                    <th className="p-2.5">Recomendación</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="bg-emerald-50/30 dark:bg-emerald-950/10">
                    <td className="p-2.5 font-bold font-mono text-emerald-700 dark:text-emerald-300">50% o más</td>
                    <td className="p-2.5 font-semibold text-emerald-800 dark:text-emerald-200">🚀 Excelente</td>
                    <td className="p-2.5 text-muted-foreground">Reparaciones con gran componente de servicio técnico y destreza manual.</td>
                  </tr>
                  <tr className="bg-teal-50/30 dark:bg-teal-950/10">
                    <td className="p-2.5 font-bold font-mono text-teal-700 dark:text-teal-300">30% a 49%</td>
                    <td className="p-2.5 font-semibold text-teal-800 dark:text-teal-200">🟢 Saludable</td>
                    <td className="p-2.5 text-muted-foreground">Estándar recomendado para cambios de pantallas, baterías y módulos.</td>
                  </tr>
                  <tr className="bg-amber-50/30 dark:bg-amber-950/10">
                    <td className="p-2.5 font-bold font-mono text-amber-700 dark:text-amber-300">15% a 29%</td>
                    <td className="p-2.5 font-semibold text-amber-800 dark:text-amber-200">🟡 Ajustado</td>
                    <td className="p-2.5 text-muted-foreground">Poco margen para imprevistos. Evitar dar descuentos adicionales.</td>
                  </tr>
                  <tr className="bg-rose-50/30 dark:bg-rose-950/10">
                    <td className="p-2.5 font-bold font-mono text-rose-700 dark:text-rose-300">Menos de 15%</td>
                    <td className="p-2.5 font-semibold text-rose-800 dark:text-rose-200">🔴 Alerta Crítica</td>
                    <td className="p-2.5 text-rose-700 dark:text-rose-300 font-medium">Riesgo de pérdida económica. Subir mano de obra o cotizar mejor el repuesto.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Reglas de Oro de Finanzas */}
          <section className="space-y-2 pt-2 border-t">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              4. Tres Reglas de Oro para la Caja y Flujo de Fondos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg border bg-card">
                <span className="font-bold text-foreground block">1. Pedir Seña o Anticipo</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Cobrar al menos el 50% al ingresar el equipo permite pagar el repuesto sin usar capital del taller.
                </p>
              </div>
              <div className="p-2.5 rounded-lg border bg-card">
                <span className="font-bold text-foreground block">2. Cero Repuestos a Pérdida</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  El sistema bloquea precios por debajo del costo de inventario para proteger tu negocio de descuidos.
                </p>
              </div>
              <div className="p-2.5 rounded-lg border bg-card">
                <span className="font-bold text-foreground block">3. Cobro en la Entrega</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  El saldo pendiente debe cobrarse antes de entregar el equipo para garantizar el cierre financiero de la orden.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer fijo */}
        <DialogFooter className="p-3 sm:p-4 border-t bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground">
            Servicio Técnico 4G · Gestión Financiera
          </span>
          <Button
            onClick={onClose}
            className="h-9 px-4 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl gap-1.5"
          >
            <span>Entendido</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
