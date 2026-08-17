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
  Package, 
  Wrench, 
  History, 
  ShieldCheck, 
  CheckCircle2, 
  Layers
} from 'lucide-react'

interface RepairsInventoryGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RepairsInventoryGuideDialog({
  open,
  onOpenChange
}: RepairsInventoryGuideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Cabecera con degradado */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-900 p-6 text-white text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner text-white">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold uppercase tracking-wider">
                Guía del Taller
              </Badge>
              <DialogTitle className="text-xl font-bold text-white tracking-tight mt-0.5">
                ¿Cómo funciona Repuestos y Servicios?
              </DialogTitle>
            </div>
          </div>
          
          <DialogDescription className="text-indigo-100 text-xs leading-relaxed max-w-lg">
            Controla el stock de repuestos del taller, estandariza precios de mano de obra y audita movimientos de inventario.
          </DialogDescription>
        </div>

        {/* Pasos de Funcionamiento */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Paso 1: Stock de Repuestos */}
          <div className="p-3.5 rounded-2xl border border-blue-100 dark:border-blue-950/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shadow-xs">
                1
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-blue-600" />
                Stock de Repuestos del Taller
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
              Administra módulos, pantallas, baterías, pines de carga y circuitos. Al asignar un repuesto a una orden de reparación, el stock se descuenta automáticamente del inventario.
            </p>
          </div>

          {/* Paso 2: Servicios y Mano de Obra */}
          <div className="p-3.5 rounded-2xl border border-purple-100 dark:border-purple-950/60 bg-purple-50/40 dark:bg-purple-950/20 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold shadow-xs">
                2
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-purple-600" />
                Catálogo de Servicios y Mano de Obra
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
              Define tarifas estandarizadas de trabajo técnico (ej: <em>Limpieza por humedad</em>, <em>Reballing IC</em>, <em>Software / Flasheo</em>) para acelerar la presupuestación en el mostrador.
            </p>
          </div>

          {/* Paso 3: Historial y Auditoría */}
          <div className="p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold shadow-xs">
                3
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-emerald-600" />
                Auditoría y Trazabilidad de Movimientos
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
              Registra entradas por compras a proveedores y salidas por consumo o piezas defectuosas, manteniendo el costo promedio ponderado y la valoración real del depósito.
            </p>
          </div>

          {/* Tips de Rendimiento */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              <strong className="text-slate-900 dark:text-slate-200">Recomendación:</strong> Configura el stock mínimo en cada repuesto para recibir alertas automáticas antes de quedarte sin insumos críticos.
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
