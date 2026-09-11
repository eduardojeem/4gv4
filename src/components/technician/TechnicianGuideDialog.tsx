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
  Wrench,
  Sparkles,
  CheckCircle2,
  Clock,
  PauseCircle,
  PackageCheck,
  Search,
  LayoutGrid,
  List as ListIcon,
  HelpCircle,
  Smartphone,
  Key,
  ShieldCheck,
  Lightbulb,
} from 'lucide-react'

interface TechnicianGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TechnicianGuideDialog({
  open,
  onOpenChange,
}: TechnicianGuideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header con gradiente moderno */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-6 text-white text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner text-white">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold uppercase tracking-wider">
                  Guía Operativa
                </Badge>
                <span className="text-[11px] text-indigo-200">Panel de Servicio Técnico</span>
              </div>
              <DialogTitle className="text-xl font-black text-white tracking-tight mt-0.5">
                ¿Cómo funciona el Panel Técnico?
              </DialogTitle>
            </div>
          </div>

          <DialogDescription className="text-indigo-100 text-xs leading-relaxed max-w-xl">
            Aprende a gestionar las órdenes de trabajo desde el ingreso hasta la entrega al cliente, con ejemplos prácticos y flujos recomendados.
          </DialogDescription>
        </div>

        {/* Contenido con scroll interno */}
        <div className="p-6 space-y-6 max-h-[68vh] overflow-y-auto">
          {/* SECCIÓN 1: FLUJO DE ESTADOS PASO A PASO */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              1. Flujo de Estados de una Reparación (Paso a Paso)
            </h3>

            <div className="grid gap-3">
              {/* Paso 1: Recibido */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black">
                      1
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      Recibido (Ingreso en Mostrador)
                    </h4>
                  </div>
                  <Badge variant="outline" className="bg-slate-100 text-slate-700 text-[10px] font-bold">
                    Estado: Recibido
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                  El equipo es recibido en el mostrador. Se genera el ticket con los datos del cliente, la falla declarada y el patrón/PIN de desbloqueo.
                </p>
                <div className="ml-8 rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5 text-[11px] text-indigo-900 dark:border-indigo-950/60 dark:bg-indigo-950/20 dark:text-indigo-200">
                  <strong>💡 Ejemplo real:</strong> Llega un <em>Samsung S22 Ultra</em> con ticket <code>#REP-1042</code>. Falla declarada: <em>&quot;No enciende tras caer al agua. Se entrega con funda y cable.&quot;</em> El técnico toma el equipo y lo coloca en su mesa de trabajo.
                </div>
              </div>

              {/* Paso 2: Diagnóstico */}
              <div className="p-3.5 rounded-2xl border border-amber-100 dark:border-amber-950/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-black shadow-2xs">
                      2
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Search className="h-3.5 w-3.5 text-amber-600" />
                      En Diagnóstico (Revisión Inicial)
                    </h4>
                  </div>
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 text-[10px] font-bold">
                    Estado: Diagnóstico
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                  El técnico desarma el equipo, mide placa madre, prueba consumos y determina qué piezas o servicios se requieren para presupuestar.
                </p>
                <div className="ml-8 rounded-xl border border-amber-200/60 bg-amber-100/50 p-2.5 text-[11px] text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                  <strong>💡 Ejemplo real:</strong> Se abre el teléfono con plancha térmica. Se observa sulfato en pin de carga y pantalla rota. Se carga en el sistema el repuesto <em>&quot;Módulo Display OLED&quot;</em> y se pasa presupuesto al cliente vía WhatsApp.
                </div>
              </div>

              {/* Paso 3: En Reparación */}
              <div className="p-3.5 rounded-2xl border border-blue-100 dark:border-blue-950/50 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black shadow-2xs">
                      3
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-blue-600" />
                      En Reparación (Trabajo en Proceso)
                    </h4>
                  </div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 text-[10px] font-bold">
                    Estado: En Reparación
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                  El cliente aprobó el presupuesto. El técnico aplica la mano de obra: microsoldadura, reemplazo de componentes, limpieza química o flasheo.
                </p>
                <div className="ml-8 rounded-xl border border-blue-200/60 bg-blue-100/50 p-2.5 text-[11px] text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
                  <strong>💡 Ejemplo real:</strong> Se retira el módulo dañado, se limpia el chasis con alcohol isopropílico, se suelda nuevo conector FPC y se adhiere la nueva pantalla con pegamento B7000.
                </div>
              </div>

              {/* Paso 4: Pausado */}
              <div className="p-3.5 rounded-2xl border border-purple-100 dark:border-purple-950/50 bg-purple-50/40 dark:bg-purple-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-black shadow-2xs">
                      4
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <PauseCircle className="h-3.5 w-3.5 text-purple-600" />
                      Pausado / Esperando Piezas
                    </h4>
                  </div>
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 text-[10px] font-bold">
                    Estado: Pausado
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                  Úsalo cuando la reparación no pueda continuar de inmediato porque se solicitó un repuesto al proveedor o se espera autorización del cliente.
                </p>
                <div className="ml-8 rounded-xl border border-purple-200/60 bg-purple-100/50 p-2.5 text-[11px] text-purple-950 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-200">
                  <strong>💡 Ejemplo real:</strong> Se necesita una batería específica para <em>Xiaomi Poco X3</em> que llega del distribuidor en 48 hs. Al pausarlo, no afecta tus métricas de tiempo de reparación activo.
                </div>
              </div>

              {/* Paso 5: Listo */}
              <div className="p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-950/50 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-black shadow-2xs">
                      5
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Listo para Entrega (Control de Calidad OK)
                    </h4>
                  </div>
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    Estado: Listo
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                  El equipo fue probado exhaustivamente (cámaras, llamadas, carga, táctil, sensores). Se guarda en la caja de entrega y se notifica al cliente para que retire.
                </p>
                <div className="ml-8 rounded-xl border border-emerald-200/60 bg-emerald-100/50 p-2.5 text-[11px] text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <strong>💡 Ejemplo real:</strong> Se realiza el checklist de control de calidad. El botón de WhatsApp permite enviar el mensaje predefinido: <em>&quot;Hola Juan, tu Samsung S22 Ultra ya está reparado y listo para retirar en nuestra sucursal.&quot;</em>
                </div>
              </div>

              {/* Paso 6: Entregado */}
              <div className="p-3.5 rounded-2xl border border-teal-100 dark:border-teal-950/50 bg-teal-50/40 dark:bg-teal-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white text-xs font-black shadow-2xs">
                      6
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <PackageCheck className="h-3.5 w-3.5 text-teal-600" />
                      Entregado al Cliente & Garantía
                    </h4>
                  </div>
                  <Badge variant="outline" className="bg-teal-100 text-teal-700 text-[10px] font-bold">
                    Estado: Entregado
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                  El cliente retira el equipo, cancela el saldo adeudado y se activa la garantía configurada (ej. 90 días). La orden queda formalmente cerrada.
                </p>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: LAS 3 VISTAS DE TRABAJO */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 text-indigo-500" />
              2. Cómo aprovechar las 3 Vistas de Trabajo
            </h3>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                    <ListIcon className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Vista Lista (Default)</h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  La vista más densa y rápida. Muestra en un vistazo PINs de desbloqueo, cliente, tiempo transcurrido y permite cambiar de estado con un solo clic.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Vista Tarjetas (Cards)</h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Idéntica a la sección principal de reparaciones. Ideal para ver fotos del equipo, costos desglosados y etiquetas de prioridad destacadas.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Vista Kanban</h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tablero ágil por columnas. Puedes arrastrar una tarjeta desde <em>&quot;Recibido&quot;</em> hasta <em>&quot;Listo&quot;</em> de manera táctil y visual.
                </p>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: CONSEJOS CLAVE */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              Consejos de Buenas Prácticas en el Taller
            </h4>
            <ul className="text-xs text-amber-900/90 dark:text-amber-200/90 space-y-1.5 list-disc pl-5 leading-relaxed">
              <li>
                <strong>Verifica siempre la clave de desbloqueo:</strong> En la tabla de la lista verás si el cliente dejó PIN o patrón antes de empezar a trabajar.
              </li>
              <li>
                <strong>Atajo de teclado rápido:</strong> Pulsa la tecla <kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] font-mono shadow-2xs dark:bg-slate-800">/</kbd> en cualquier momento para buscar por cliente o dispositivo al instante.
              </li>
              <li>
                <strong>Prioridad Urgente:</strong> Las reparaciones marcadas como urgentes se destacan con borde e indicador rojo para ser atendidas en primer lugar.
              </li>
              <li>
                <strong>Filtro &quot;Mis Reparaciones&quot;:</strong> Actívalo en la barra superior para ocultar los equipos asignados a otros técnicos y concentrarte en tus órdenes.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 sm:justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs px-6"
          >
            Entendido, volver al panel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
