'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  Store, 
  ArrowDownRight, 
  ArrowUpRight, 
  Calculator, 
  ShieldCheck, 
  CheckCircle2, 
  HelpCircle,
  Clock
} from 'lucide-react'

interface CashRegisterGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CashRegisterGuideDialog({
  open,
  onOpenChange
}: CashRegisterGuideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Cabecera con degradado */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-6 text-white text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner text-white">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold uppercase tracking-wider">
                Guía Rápida de Operativa
              </Badge>
              <DialogTitle className="text-xl font-bold text-white tracking-tight mt-0.5">
                ¿Cómo funciona la Gestión de Caja?
              </DialogTitle>
            </div>
          </div>
          
          <DialogDescription className="text-blue-100 text-xs leading-relaxed max-w-lg">
            Aprende a controlar la apertura de turnos, movimientos de efectivo y arqueos diarios para mantener tus finanzas 100% cuadradas.
          </DialogDescription>
        </div>

        {/* Pasos de Funcionamiento */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Paso 1: Apertura y Cierre */}
          <div className="p-3.5 rounded-2xl border border-blue-100 dark:border-blue-950/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shadow-xs">
                1
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                Apertura y Cierre de Turno
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
              Inicia tu jornada ingresando el <strong>monto físico inicial</strong> (fondo de cambio). Al terminar, realiza el conteo final para que el sistema concilie automáticamente ventas en efectivo, tarjetas y transferencias.
            </p>
          </div>

          {/* Paso 2: Entradas y Salidas */}
          <div className="p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shadow-xs">
                2
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-indigo-600" />
                Entradas y Salidas Manuales
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
              Registra en segundos gastos menores del local (compras de insumos, pagos rápidos) como <strong>Salidas</strong> o aportes extraordinarios como <strong>Entradas</strong>, indicando siempre el motivo y comprobante.
            </p>
          </div>

          {/* Paso 3: Arqueo y Conciliación */}
          <div className="p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold shadow-xs">
                3
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-emerald-600" />
                Arqueo de Caja y Conteo por Billetes
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
              Utiliza el contador rápido por denominación física. El sistema calculará al instante la diferencia entre el saldo teórico esperado y el conteo real, reportando si la caja está exacta, con sobrante o faltante.
            </p>
          </div>

          {/* Tips de Seguridad */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              <strong className="text-slate-900 dark:text-slate-200">Consejo clave:</strong> Realiza arqueos ciegos a mitad de turno para prevenir desvíos y asegúrate de cerrar la caja antes de apagar el equipo.
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 sm:justify-end">
          <Button
            type="button"
            className="rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            onClick={() => onOpenChange(false)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
