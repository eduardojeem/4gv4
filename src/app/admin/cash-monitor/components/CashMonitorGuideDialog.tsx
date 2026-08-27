'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Monitor,
  Store,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Clock,
  CreditCard,
  History,
  ShieldAlert,
  Printer,
  Search,
  Wallet,
  AlertTriangle,
  Lock,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  XCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type MonitorGuideSectionKey = 'live' | 'discrepancy' | 'actions' | 'alerts' | 'export'

interface CashMonitorGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSection?: MonitorGuideSectionKey
}

interface GuideSectionData {
  id: MonitorGuideSectionKey
  label: string
  icon: React.ReactNode
  badge: string
  title: string
  description: string
  highlights: {
    title: string
    desc: string
    icon: React.ReactNode
  }[]
  example: {
    title: string
    badge: string
    scenario: string
    calculation: string
    result: string
    explanation: string
  }
  proTip: string
}

const GUIDE_SECTIONS: Record<MonitorGuideSectionKey, GuideSectionData> = {
  live: {
    id: 'live',
    label: 'Supervisión en Vivo',
    icon: <Monitor className="h-4 w-4" />,
    badge: 'Tiempo Real',
    title: 'Monitoreo Centralizado de Cajas Activas',
    description: 'Controla en un solo panel todas las terminales de cobro abiertas en tus sucursales, su saldo estimado en gaveta y el ritmo de ventas.',
    highlights: [
      {
        title: '1. Cajas con Turno Abierto',
        desc: 'Muestra los operadores activos, tiempo transcurrido desde la apertura y el total recaudado al instante.',
        icon: <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      },
      {
        title: '2. Estimación de Gaveta en Vivo',
        desc: 'Calcula el efectivo físico actual: Fondo Inicial + Ventas Efectivo + Ingresos - Egresos.',
        icon: <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      },
      {
        title: '3. Medios Digitales (Tarjeta/QR)',
        desc: 'Las ventas digitales impactan en bancos/billeteras, desglosándose por separado del efectivo.',
        icon: <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      },
      {
        title: '4. Sesiones en Múltiples Navegadores',
        desc: 'Monitorea en cuántas ventanas, pestañas o dispositivos simultáneos está operando la misma caja.',
        icon: <Monitor className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      }
    ],
    example: {
      title: 'Ejemplo: Supervisión de Conexiones Simultáneas',
      badge: 'Escenario Operativo',
      scenario: 'La Caja 1 está abierta, pero el sistema indica "2 conexiones activas":',
      calculation: '• Caja 1 (Terminal A): Cajero cobrando normalmente. \n• Caja 1 (Terminal B): Otra computadora abrió la misma sesión por error.',
      result: 'El monitor te advierte visualmente de las conexiones simultáneas para evitar duplicidad de cobros o descuadres.',
      explanation: 'Puedes ordenar que cierren la pestaña extra y auditar si ambas conexiones afectaron el efectivo físico esperado.'
    },
    proTip: 'Si una caja está activa en más de 1 navegador (ej: 2 pestañas), el indicador de "Conexiones" te alertará para que el operador cierre las instancias sobrantes.'
  },

  discrepancy: {
    id: 'discrepancy',
    label: 'Arqueos y Descuadres',
    icon: <Calculator className="h-4 w-4" />,
    badge: 'Auditoría Forense',
    title: 'Diagnóstico de Sobrantes (+) y Faltantes (-)',
    description: 'Comprende con precisión milimétrica la fórmula de arqueo Z y cómo el sistema clasifica las diferencias de caja.',
    highlights: [
      {
        title: 'Fórmula Oficial del Cierre Z',
        desc: 'Saldo Esperado = Fondo Inicial + Ventas Efectivo + Ingresos Manuales - Egresos/Gastos.\nDiferencia = Saldo Real Contado - Saldo Esperado.',
        icon: <Calculator className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      },
      {
        title: 'Diagnóstico de los 3 Estados',
        desc: '• Exacto (✓): Diferencia = Gs. 0.\n• Sobrante (▲): Diferencia > 0 (hay más dinero del esperado).\n• Faltante (▼): Diferencia < 0 (falta dinero en gaveta).',
        icon: <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      },
      {
        title: 'KPI "Dif. Acumulada" Pericial',
        desc: 'Calcula el balance neto del período y desglosa el monto exacto acumulado en sobrantes versus el acumulado en faltantes.',
        icon: <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      }
    ],
    example: {
      title: 'Ejemplo: Cierre Z con Sobrante vs. Faltante',
      badge: 'Cálculo de Auditoría',
      scenario: 'Dos cajeros cierran su turno al final del día:',
      calculation: '• Turno A: Esperado Gs. 500.000 | Conteo Físico Gs. 520.000 ➔ Dif: +Gs. 20.000 (Sobrante ▲)\n• Turno B: Esperado Gs. 800.000 | Conteo Físico Gs. 750.000 ➔ Dif: -Gs. 50.000 (Faltante ▼)',
      result: 'Diferencia Acumulada Neta: -Gs. 30.000 (Faltante Neto)\nDesglose: ▲ +Gs. 20.000 Sobrantes | ▼ -Gs. 50.000 Faltantes',
      explanation: 'El sistema no oculta los faltantes con los sobrantes: te muestra ambos números con total transparencia para auditar la causa raíz.'
    },
    proTip: 'Un sobrante no es necesariamente bueno: puede indicar que un cajero cobró de más, no entregó un vuelto o no registró un ticket de venta.'
  },

  actions: {
    id: 'actions',
    label: 'Control Remoto',
    icon: <Lock className="h-4 w-4" />,
    badge: 'Seguridad Admin',
    title: 'Acciones Administrativas a Distancia',
    description: 'Herramientas de intervención remota para resolver incidencias operativas sin estar físicamente frente a la terminal.',
    highlights: [
      {
        title: 'Cierre Remoto de Caja',
        desc: 'Fuerza el arqueo y cierre de una caja si el cajero olvidó cerrarla al retirarse o ante un cambio de guardia urgente.',
        icon: <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
      },
      {
        title: 'Suspensión Temporal',
        desc: 'Pausa momentáneamente los cobros en una caja (ej. horario de colación o revisión técnica) sin clausurar la sesión.',
        icon: <PauseCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      },
      {
        title: 'Bloqueo de Seguridad',
        desc: 'Impide cualquier operación en la terminal ante sospecha de fraude o vulneración hasta que el administrador la desbloquee.',
        icon: <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
      },
      {
        title: 'Reapertura de Turno',
        desc: 'Habilita excepcionalmente una sesión cerrada para rectificar un arqueo erróneo justificado en la bitácora.',
        icon: <RotateCcw className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      }
    ],
    example: {
      title: 'Ejemplo: Cajero Olvidó Cerrar el Turno de la Tarde',
      badge: 'Caso Práctico',
      scenario: 'Son las 21:00 hs, el local cerró y la Caja 1 quedó con estado "Abierta (En Vivo)" porque el cajero se retiró con prisa.',
      calculation: '1. El administrador ingresa a /admin/cash-monitor.\n2. Abre el menú de acciones de la Caja 1 y selecciona "Cerrar Remotamente".\n3. Ingresa el motivo: "Cierre administrativo por fin de jornada".',
      result: 'La sesión queda cerrada formalmente con registro del saldo teórico, liberando la terminal para el turno de la mañana siguiente.',
      explanation: 'Toda acción remota queda registrada con fecha, hora, usuario admin e IP en la Bitácora de Auditoría.'
    },
    proTip: 'Todas las acciones remotas quedan blindadas en la pestaña "Auditoría" con su respectivo motivo justificado para trazabilidad legal.'
  },

  alerts: {
    id: 'alerts',
    label: 'Matriz de Alertas',
    icon: <AlertTriangle className="h-4 w-4" />,
    badge: 'Detección Automática',
    title: 'Sistema de Alertas Inteligentes y Umbrales',
    description: 'El monitor evalúa continuamente patrones anómalos y notifica eventos que requieren intervención de supervisión.',
    highlights: [
      {
        title: 'Severidad Crítica (🔴)',
        desc: 'Descuadre masivo (> Gs. 100.000), bloqueo forzado de seguridad o acceso no autorizado a la gaveta.',
        icon: <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
      },
      {
        title: 'Severidad Alta (🟠)',
        desc: 'Turno abierto por más de 12 horas consecutivas o múltiples egresos manuales en un intervalo corto.',
        icon: <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      },
      {
        title: 'Severidad Media / Baja (🟡 / 🔵)',
        desc: 'Inactividad prolongada con dinero en gaveta o aviso de saldo elevado sugerido para retiro a tesorería.',
        icon: <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      }
    ],
    example: {
      title: 'Ejemplo: Resolución de Alerta por Descuadre',
      badge: 'Flujo de Supervisión',
      scenario: 'Aparece una alerta: "Descuadre Crítico en Caja 2 (Faltante de Gs. 85.000)".',
      calculation: '1. El supervisor hace clic en la alerta y revisa el SessionDetailSheet.\n2. Detecta que hubo un pago a proveedor de Gs. 85.000 no registrado como egreso.\n3. Resuelve la alerta añadiendo la nota: "Faltante justificado con Factura Contado N° 1042".',
      result: 'La alerta pasa al historial de "Resueltas" con el sello del supervisor y la nota de respaldo.',
      explanation: 'Permite mantener la lista de alertas activas en cero y documentar las contingencias.'
    },
    proTip: 'En la pestaña "Alertas", puedes marcar como leídas las notificaciones leves y documentar con nota de resolución las alertas de descuadre.'
  },

  export: {
    id: 'export',
    label: 'Reportes y PDF',
    icon: <FileDown className="h-4 w-4" />,
    badge: 'Descargas Corporativas',
    title: 'Exportación Pericial en PDF y CSV',
    description: 'Genera informes institucionales estructurados para contabilidad, gerencia o fiscalizaciones internas.',
    highlights: [
      {
        title: 'PDF Multi-Sección Corporativo',
        desc: 'Separa en bloques visuales: Sección 1 (Cajas en vivo), Sección 2 (Turnos cerrados y arqueos), Sección 3 (Alertas pendientes).',
        icon: <FileDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
      },
      {
        title: 'Filtro por Períodos Homogéneo',
        desc: 'Exporta con un clic la semana en curso (por defecto), el turno de hoy, el mes cerrado o el año completo.',
        icon: <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      },
      {
        title: 'CSV de Auditoría Completa',
        desc: 'Descarga todas las filas con apertura, cierre, cajeros, fondo inicial, ventas desglosadas, ingresos, egresos y diferencias.',
        icon: <Printer className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      }
    ],
    example: {
      title: 'Ejemplo: Reporte Semanal para Gerencia',
      badge: 'Entrega Administrativa',
      scenario: 'Lunes por la mañana: debes entregar el balance de cajas de la semana anterior a la dirección.',
      calculation: '1. Dejas el filtro en "Esta Semana (Por Defecto)".\n2. Haces clic en "Descargar PDF".\n3. El sistema compila automáticamente el banner corporativo, los 10 KPIs clave y la tabla de turnos con diagnóstico.',
      result: 'Obtienes un documento PDF en orientación horizontal listo para imprimir o enviar por correo/WhatsApp.',
      explanation: 'Ahorra horas de consolidación manual en planillas Excel garantizando datos 100% auditables.'
    },
    proTip: 'Puedes cambiar el selector a "Este Mes" antes de hacer clic en "Descargar PDF" para obtener el cierre mensual completo de la empresa.'
  }
}

export function CashMonitorGuideDialog({
  open,
  onOpenChange,
  initialSection = 'live'
}: CashMonitorGuideDialogProps) {
  const [activeSection, setActiveSection] = useState<MonitorGuideSectionKey>(initialSection)

  const section = GUIDE_SECTIONS[activeSection] || GUIDE_SECTIONS.live

  const sectionKeys = Object.keys(GUIDE_SECTIONS) as MonitorGuideSectionKey[]
  const currentIndex = sectionKeys.indexOf(activeSection)

  const handleNext = () => {
    if (currentIndex < sectionKeys.length - 1) {
      setActiveSection(sectionKeys[currentIndex + 1])
    } else {
      onOpenChange(false)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setActiveSection(sectionKeys[currentIndex - 1])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-3xl border border-border/80 shadow-2xl">
        {/* Cabecera Principal */}
        <div className="p-6 pb-4 border-b bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md">
                  <Monitor className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Manual Interactivo del Monitor de Cajas
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Guía completa de supervisión en tiempo real, fórmulas de arqueo Z y control administrativo
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-bold border-primary/30 text-primary bg-primary/5 px-2.5 py-1 rounded-xl hidden sm:flex">
                Módulo Administrativo
              </Badge>
            </div>
          </DialogHeader>

          {/* Selector de Pestañas de la Guía */}
          <div className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-none">
            {sectionKeys.map((key) => {
              const item = GUIDE_SECTIONS[key]
              const isSelected = activeSection === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSection(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
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
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          <div className="space-y-6">
            {/* Título de la Sección Activa */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {section.badge}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <h3 className="text-base font-bold text-foreground">{section.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {section.description}
                </p>
              </div>
            </div>

            {/* Puntos Clave de la Sección */}
            <div className={cn("grid gap-3", section.highlights.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
              {section.highlights.map((h, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-card border border-border/70 hover:border-primary/40 transition-colors space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-muted text-foreground">
                      {h.icon}
                    </div>
                    <h4 className="text-xs font-bold text-foreground truncate">{h.title}</h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">
                    {h.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Tarjeta de Ejemplo Práctico con Fórmulas */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <h4 className="text-xs font-bold text-foreground">{section.example.title}</h4>
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold rounded-lg">
                  {section.example.badge}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {section.example.scenario}
              </p>

              <div className="p-3 rounded-xl bg-background/80 border border-border/60 font-mono text-xs text-foreground whitespace-pre-line leading-relaxed">
                {section.example.calculation}
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 dark:text-emerald-200">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">
                  🎯 Conclusión: {section.example.result}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {section.example.explanation}
                </p>
              </div>
            </div>

            {/* Consejo Pro */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-950 dark:text-blue-200">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="font-bold">Consejo de Auditoría:</strong> {section.proTip}
              </p>
            </div>
          </div>
        </div>

        {/* Footer con Navegación */}
        <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="h-8 text-xs rounded-xl font-semibold"
          >
            ← Anterior
          </Button>

          <div className="flex items-center gap-1">
            {sectionKeys.map((k, i) => (
              <span
                key={k}
                onClick={() => setActiveSection(k)}
                className={cn(
                  'h-1.5 rounded-full cursor-pointer transition-all',
                  activeSection === k ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                )}
              />
            ))}
          </div>

          <Button
            size="sm"
            onClick={handleNext}
            className="h-8 text-xs rounded-xl font-bold gap-1 shadow-xs"
          >
            {currentIndex === sectionKeys.length - 1 ? (
              'Entendido, Cerrar'
            ) : (
              <>
                <span>Siguiente: {GUIDE_SECTIONS[sectionKeys[currentIndex + 1]]?.label}</span>
                <ArrowRight className="h-3 w-3" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
