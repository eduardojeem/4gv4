'use client'

import React, { useState, useEffect } from 'react'
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
  Clock,
  CreditCard,
  FileText,
  History,
  ShieldAlert,
  Smartphone,
  Printer,
  Search,
  Banknote,
  Wallet,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type GuideSectionKey = 'overview' | 'electronic' | 'report' | 'history' | 'audit'

interface CashRegisterGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSection?: GuideSectionKey
}

interface SectionContent {
  id: GuideSectionKey
  label: string
  icon: React.ReactNode
  badge: string
  title: string
  description: string
  steps: {
    title: string
    desc: string
    icon: React.ReactNode
  }[]
  example: {
    title: string
    scenario: string
    calculation: string
    result: string
  }
  tip: string
}

const SECTIONS_DATA: Record<GuideSectionKey, SectionContent> = {
  overview: {
    id: 'overview',
    label: 'Resumen',
    icon: <Store className="h-4 w-4" />,
    badge: 'Operativa Diaria',
    title: 'Control de Efectivo y Turno Activo',
    description: 'Gestión en tiempo real del dinero físico en el cajón, entradas, salidas y arqueos de turno.',
    steps: [
      {
        title: '1. Apertura con Fondo Inicial',
        desc: 'Inicia el día ingresando el monto de cambio (ej. 100.000 Gs.). Este saldo es el punto de partida.',
        icon: <Clock className="h-3.5 w-3.5 text-blue-600" />
      },
      {
        title: '2. Registro de Ingresos y Egresos (Alt+E / Alt+S)',
        desc: 'Registra aportes extras o salidas rápidas de caja (compras de insumos, pagos de flete) con motivo.',
        icon: <ArrowUpRight className="h-3.5 w-3.5 text-indigo-600" />
      },
      {
        title: '3. Arqueo Físico y Cierre Z (Alt+A)',
        desc: 'Cuenta físicamente los billetes y monedas. El sistema compara el conteo real contra el saldo teórico.',
        icon: <Calculator className="h-3.5 w-3.5 text-emerald-600" />
      }
    ],
    example: {
      title: 'Ejemplo de Cuadre de Caja',
      scenario: 'Abres la caja con 100.000 Gs. Durante el turno vendes 250.000 Gs en efectivo, 150.000 Gs por tarjeta y pagas 20.000 Gs por insumos de limpieza.',
      calculation: 'Fondo Inicial (100.000) + Ventas Efectivo (250.000) - Gasto Limpieza (20.000) = 330.000 Gs.',
      result: 'En el cajón físico debe haber exactamente 330.000 Gs. Los 150.000 Gs de tarjeta van al banco y no afectan el efectivo físico.'
    },
    tip: 'Utiliza los atajos de teclado Alt+E (Entrada), Alt+S (Salida) y Alt+A (Arqueo) para agilizar la atención en mostrador.'
  },

  electronic: {
    id: 'electronic',
    label: 'Cobros',
    icon: <CreditCard className="h-4 w-4" />,
    badge: 'Conciliación Digital',
    title: 'Cobros Electrónicos, POS y Transferencias QR',
    description: 'Control de pagos con tarjeta de débito/crédito, transferencias bancarias SIPAP y cobros QR.',
    steps: [
      {
        title: '1. Registro Automático de Ventas Digitales',
        desc: 'Cada venta pagada con tarjeta o transferencia se registra aquí con su código de transacción.',
        icon: <CreditCard className="h-3.5 w-3.5 text-blue-600" />
      },
      {
        title: '2. Verificación de Referencias y Lotes',
        desc: 'Compara el número de comprobante/lote emitido por el POS físico con el registrado en el sistema.',
        icon: <Search className="h-3.5 w-3.5 text-violet-600" />
      },
      {
        title: '3. Conciliación y Liquidación',
        desc: 'Marca como "Acreditado" una vez que el dinero figure en la cuenta bancaria del comercio.',
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      }
    ],
    example: {
      title: 'Ejemplo de Cobro con Tarjeta',
      scenario: 'Un cliente abona una reparación de 200.000 Gs con Tarjeta de Crédito en el POS físico.',
      calculation: 'Importe Bruto: 200.000 Gs. • Comisión estimada del procesador (2.5%): 5.000 Gs.',
      result: 'El panel registra la venta electrónica y permite dar seguimiento a los 195.000 Gs netos hasta su acreditación bancaria.'
    },
    tip: 'Guarda los tickets de POS por lote diario para cotejar rápidamente con los extractos de Bancard o Dinelco.'
  },

  report: {
    id: 'report',
    label: 'Reporte',
    icon: <FileText className="h-4 w-4" />,
    badge: 'Finanzas y Cierre Z',
    title: 'Reportes Periódicos y Cierre Z',
    description: 'Generación de balances por fecha, análisis de ventas por forma de cobro e impresión de tickets térmicos.',
    steps: [
      {
        title: '1. Selección de Rango de Fechas',
        desc: 'Filtra por Hoy, Turno Actual, Semana o Mes para auditar el rendimiento del negocio.',
        icon: <Clock className="h-3.5 w-3.5 text-blue-600" />
      },
      {
        title: '2. Análisis de Métricas y Ganancias',
        desc: 'Revisa ingresos netos, total vendido por cada método de pago y volumen de transacciones.',
        icon: <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
      },
      {
        title: '3. Impresión de Ticket Z y Exportación',
        desc: 'Imprime el Comprobante de Cierre Z en formato térmico (80mm/58mm) o exporta a planilla Excel/CSV.',
        icon: <Printer className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
      }
    ],
    example: {
      title: 'Ejemplo de Reporte Mensual',
      scenario: 'Deseas conocer la recaudación total de la sucursal del 01 al 31 del mes.',
      calculation: 'Ventas Totales: 45.000.000 Gs. (Efectivo: 25M, Tarjetas: 15M, Transferencias: 5M) • Egresos: 8.000.000 Gs.',
      result: 'El reporte genera el Flujo Neto (+37.000.000 Gs.) con gráficos comparativos y desglose por cajero.'
    },
    tip: 'El Cierre Z es el comprobante fiscal y operativo oficial para respaldar la contabilidad de fin de turno.'
  },

  history: {
    id: 'history',
    label: 'Historial',
    icon: <History className="h-4 w-4" />,
    badge: 'Registro Histórico',
    title: 'Historial Inmutable de Turnos Pasados',
    description: 'Consulta de todas las sesiones de caja cerradas anteriormente con sus arqueos y responsables.',
    steps: [
      {
        title: '1. Listado Cronológico de Cierres',
        desc: 'Visualiza cada turno cerrado con fecha, hora, operador responsable y saldo final declarado.',
        icon: <History className="h-3.5 w-3.5 text-slate-600" />
      },
      {
        title: '2. Identificación de Desvíos o Sobrantes',
        desc: 'Revisa el indicador de diferencia: Verde (Cuadrada), Ámbar (Sobrante) o Rojo (Faltante).',
        icon: <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
      },
      {
        title: '3. Reimpresión de Comprobantes Z',
        desc: 'Abre cualquier cierre anterior para reimprimir el ticket térmico o revisar observaciones anotadas.',
        icon: <Printer className="h-3.5 w-3.5 text-blue-600" />
      }
    ],
    example: {
      title: 'Ejemplo de Auditoría de Cierre Anterior',
      scenario: 'El supervisor necesita revisar por qué hubo un faltante el viernes pasado en el turno de la tarde.',
      calculation: 'Saldo Esperado: 1.200.000 Gs. • Saldo Contado Declarado: 1.180.000 Gs. • Diferencia: -20.000 Gs.',
      result: 'El supervisor abre el cierre en el Historial, revisa las notas ("Diferencia por vuelto mal dado") y reimprime el acta firmada.'
    },
    tip: 'Puedes consultar el historial en cualquier momento sin afectar la caja que se encuentra abierta en el presente.'
  },

  audit: {
    id: 'audit',
    label: 'Auditoría',
    icon: <ShieldAlert className="h-4 w-4" />,
    badge: 'Seguridad y Trazabilidad',
    title: 'Bitácora de Auditoría y Eventos Críticos',
    description: 'Registro de seguridad inmutable que almacena cada acción realizada en la caja con usuario, fecha y hora.',
    steps: [
      {
        title: '1. Registro Automático de Eventos',
        desc: 'Cada apertura, egreso, ingreso, arqueo y cierre genera un registro imborrable en el log de auditoría.',
        icon: <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
      },
      {
        title: '2. Trazabilidad por Usuario',
        desc: 'Identifica exactamente qué empleado o técnico realizó un movimiento o modificó un parámetro de caja.',
        icon: <Clock className="h-3.5 w-3.5 text-violet-600" />
      },
      {
        title: '3. Filtros Forenses y Búsqueda',
        desc: 'Filtra por tipo de evento o busca montos sospechosos para prevenir fugas de efectivo o fraudes.',
        icon: <Search className="h-3.5 w-3.5 text-emerald-600" />
      }
    ],
    example: {
      title: 'Ejemplo de Trazabilidad de un Retiro',
      scenario: 'Se detecta un egreso manual de 150.000 Gs a mitad de jornada.',
      calculation: 'Registro: 26/08/2026 16:42:10 • Usuario: carlos@empresa.com • Acción: CASH_OUT • Motivo: Pago proveedor de pantallas.',
      result: 'El administrador confirma en segundos quién autorizó la salida de dinero y el motivo justificado.'
    },
    tip: 'La bitácora de auditoría es inalterable, lo que garantiza total transparencia contable ante cualquier revisión administrativa.'
  }
}

export function CashRegisterGuideDialog({
  open,
  onOpenChange,
  initialSection = 'overview'
}: CashRegisterGuideDialogProps) {
  const [activeSection, setActiveSection] = useState<GuideSectionKey>(initialSection)

  useEffect(() => {
    if (open && initialSection) {
      setActiveSection(initialSection)
    }
  }, [open, initialSection])

  const section = SECTIONS_DATA[activeSection] || SECTIONS_DATA.overview

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] p-0 overflow-hidden rounded-3xl border-border shadow-2xl flex flex-col">
        
        {/* Cabecera con degradado */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-5 sm:p-6 text-white text-left relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner text-white">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold uppercase tracking-wider">
                  {section.badge}
                </Badge>
                <DialogTitle className="text-xl font-bold text-white tracking-tight mt-0.5">
                  ¿Cómo funciona el módulo de Caja?
                </DialogTitle>
              </div>
            </div>
          </div>
          
          <DialogDescription className="text-blue-100 text-xs leading-relaxed max-w-xl">
            {section.description}
          </DialogDescription>

          {/* Selector de Pestañas Interactivas dentro de la Guía */}
          <div className="flex items-center gap-1.5 pt-4 overflow-x-auto no-scrollbar">
            {(Object.keys(SECTIONS_DATA) as GuideSectionKey[]).map((key) => {
              const item = SECTIONS_DATA[key]
              const isSelected = activeSection === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSection(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0",
                    isSelected
                      ? "bg-white text-slate-900 shadow-md scale-105"
                      : "bg-white/15 text-white/90 hover:bg-white/25 hover:text-white"
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Contenido Dinámico de la Sección */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-left">
          
          <div className="border-b border-border/50 pb-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {section.title}
            </h3>
          </div>

          {/* Pasos de Funcionamiento */}
          <div className="space-y-2.5">
            {section.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors space-y-1"
              >
                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                  {step.icon}
                  {step.title}
                </h4>
                <p className="text-xs text-muted-foreground pl-5 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Tarjeta de Ejemplo Práctico de Negocio */}
          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20 space-y-2">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
              <Banknote className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {section.example.title}
              </h4>
            </div>
            
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>Situación:</strong> {section.example.scenario}
            </p>

            <div className="p-2.5 rounded-xl bg-background/80 border border-blue-200/60 dark:border-blue-900/40 text-xs font-mono font-medium text-blue-950 dark:text-blue-100">
              {section.example.calculation}
            </div>

            <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              💡 <strong>Resultado:</strong> {section.example.result}
            </p>
          </div>

          {/* Tip / Buena Práctica */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
              <strong>Consejo clave:</strong> {section.tip}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-muted/20 border-t border-border/50 sm:justify-between flex flex-row items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Sección actual: <strong>{section.label}</strong>
          </span>
          <Button
            type="button"
            className="rounded-xl text-xs font-bold px-6 shadow-md"
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
