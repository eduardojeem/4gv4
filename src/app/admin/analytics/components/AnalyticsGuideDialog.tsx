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
import {
  BarChart2,
  TrendingUp,
  Wallet,
  Package,
  Trophy,
  ArrowRight,
  Sparkles,
  Activity,
  Clock,
  Users,
  ShoppingBag,
  Gauge,
  AlertTriangle,
  FileDown,
  Building2,
  CalendarRange,
  Wrench,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AnalyticsGuideSectionKey =
  | 'kpis'
  | 'trends'
  | 'finance'
  | 'inventory'
  | 'rankings'

interface AnalyticsGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSection?: AnalyticsGuideSectionKey
}

interface GuideSectionData {
  id: AnalyticsGuideSectionKey
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

const GUIDE_SECTIONS: Record<AnalyticsGuideSectionKey, GuideSectionData> = {
  kpis: {
    id: 'kpis',
    label: 'KPIs del Negocio',
    icon: <BarChart2 className="h-4 w-4" />,
    badge: 'Metricas Clave',
    title: 'Las 6 Metricas que Resumen tu Negocio',
    description:
      'Los KPI del encabezado son tu termometro diario: te dicen de un vistazo si el negocio esta creciendo, cuanto ganas por venta y si hay alertas urgentes que atender.',
    highlights: [
      {
        title: 'Facturacion Bruta',
        desc: 'Total de dinero que entro por ventas POS + taller de reparaciones en el periodo seleccionado.',
        icon: <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      },
      {
        title: 'Ticket Promedio',
        desc: 'Facturacion Total / Cantidad de Ventas. Te indica cuanto gasta en promedio cada cliente por visita.',
        icon: <Gauge className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
      },
      {
        title: 'Margen de Ganancia',
        desc: '(Ganancia Neta / Facturacion) x 100. Muestra que porcentaje de cada venta queda como utilidad real.',
        icon: <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      },
      {
        title: 'Reparaciones Activas',
        desc: 'Equipos actualmente en el taller. Util para planificar la carga de trabajo de tecnicos.',
        icon: <Wrench className="h-4 w-4 text-teal-600 dark:text-teal-400" />,
      },
      {
        title: 'Alertas del Periodo',
        desc: 'Problemas detectados: stock critico, cajas con diferencias o facturas con datos incompletos.',
        icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      },
      {
        title: 'Comparativa Automatica',
        desc: 'Cada metrica se compara con el periodo anterior equivalente para detectar tendencias de crecimiento o caida.',
        icon: <Activity className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
      },
    ],
    example: {
      title: 'Ejemplo: Interpretando los KPIs del Mes',
      badge: 'Lectura Rapida',
      scenario: 'Ves estos numeros en el encabezado al revisar el mes de agosto:',
      calculation:
        '- Facturacion: Gs. 45.200.000 (+12% ^)\n- Ticket Promedio: Gs. 85.000 (-3% v)\n- Margen: 22% (estable)\n- Reparaciones Activas: 14\n- Alertas: 2',
      result:
        'El negocio crecio en facturacion pero bajo el ticket promedio. Puede indicar mas clientes con compras mas pequenas.',
      explanation:
        'Estrategia: revisar si hay productos de mayor valor para ofrecer y volver a subir el ticket promedio.',
    },
    proTip:
      'El delta (subida o bajada) se calcula comparando el periodo actual con el mismo intervalo de tiempo anterior. Usa el filtro "7 dias" para comparar semanas.',
  },

  trends: {
    id: 'trends',
    label: 'Graficos y Tendencias',
    icon: <TrendingUp className="h-4 w-4" />,
    badge: 'Analisis Visual',
    title: 'Como Leer los Graficos de Ventas',
    description:
      'Los graficos muestran el ritmo de tu negocio: cuando vendes mas, en que turnos hay mas movimiento y como se compara el taller contra el mostrador.',
    highlights: [
      {
        title: 'Area de Ventas Diarias',
        desc: 'Linea azul = Ventas POS (mostrador). Linea verde = Taller. Podes ver que canal genera mas en cada dia.',
        icon: <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      },
      {
        title: 'Barras por Hora del Dia',
        desc: 'Muestra en que franja horaria concentras mas ventas. Ideal para planificar turnos de cajeros.',
        icon: <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
      },
      {
        title: 'Movimiento por Sucursal',
        desc: 'Si tenes mas de una sucursal, ves cual genera mas movimiento POS. Ideal para comparar sedes.',
        icon: <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      },
    ],
    example: {
      title: 'Ejemplo: Detectando el Horario Pico',
      badge: 'Caso Real',
      scenario: 'El grafico de barras por hora muestra picos claros a las 10:00-12:00 y 16:00-18:00.',
      calculation:
        '- 10:00-12:00: Gs. 8.500.000 (35% del dia)\n- 16:00-18:00: Gs. 7.200.000 (30% del dia)\n- Resto del dia: Gs. 8.700.000 (35% restante)',
      result:
        'El 65% de las ventas se concentran en solo 4 horas del dia — los dos turnos pico.',
      explanation:
        'Podes reforzar cajeros en esas franjas y reducir personal en las horas valle para optimizar costos.',
    },
    proTip:
      'Selecciona "Hoy" en el filtro para analizar el ritmo del dia actual en tiempo real. Ideal para ajustes de turno sobre la marcha.',
  },

  finance: {
    id: 'finance',
    label: 'Finanzas',
    icon: <Wallet className="h-4 w-4" />,
    badge: 'Resultado Financiero',
    title: 'Entro, Salio, Quedo — Tu Resultado Real',
    description:
      'La seccion de Finanzas traduce los numeros del negocio a lenguaje simple: cuanto entro, cuanto gastaste, y cuanto quedo de ganancia neta.',
    highlights: [
      {
        title: 'Entro (Ingresos Totales)',
        desc: 'Todo lo facturado por ventas POS + taller + otros ingresos registrados en el periodo.',
        icon: <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      },
      {
        title: 'Salio (Egresos Visibles)',
        desc: 'Costos de mercaderia vendida, gastos operativos de caja, retiros y egresos manuales registrados.',
        icon: <ShoppingBag className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      },
      {
        title: 'Quedo (Ganancia Estimada)',
        desc: 'Ingresos - Egresos = Resultado del periodo. Si hay costos no cargados, el sistema indica "Pendiente".',
        icon: <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      },
    ],
    example: {
      title: 'Ejemplo: Resultado Financiero de una Semana',
      badge: 'Calculo Paso a Paso',
      scenario: 'Analizas la semana del 18 al 24 de agosto:',
      calculation:
        '- Ventas POS: Gs. 12.500.000\n- Taller: Gs. 3.800.000\n- TOTAL ENTRO: Gs. 16.300.000\n\n- Costo mercaderia: Gs. 8.200.000\n- Gastos operativos: Gs. 1.100.000\n- TOTAL SALIO: Gs. 9.300.000\n\n= QUEDO: Gs. 7.000.000 (Margen 42.9%)',
      result: 'Gs. 7.000.000 de ganancia neta en la semana, con un margen saludable del 42.9%.',
      explanation:
        'Si el margen baja del 20%, el sistema lo marca en naranja. Por debajo del 10%, en rojo como advertencia critica.',
    },
    proTip:
      'Si ves "Resultado financiero incompleto", significa que productos vendidos no tienen costo de compra cargado. Completalo en el catalogo para tener el margen exacto.',
  },

  inventory: {
    id: 'inventory',
    label: 'Inventario y Clientes',
    icon: <Package className="h-4 w-4" />,
    badge: 'Stock y Fidelizacion',
    title: 'Stock Inteligente y Clientes que Vuelven',
    description:
      'Dos secciones clave: que productos necesitan reposicion urgente, cuales no se mueven, y que tan fiel es tu base de clientes.',
    highlights: [
      {
        title: 'Poco Stock (Alerta)',
        desc: 'Productos por debajo del umbral minimo configurado. Requieren reposicion antes de quedarte sin stock.',
        icon: <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
      },
      {
        title: 'Productos sin Ventas',
        desc: 'Articulos en stock sin ninguna venta en el periodo. Son capital inmovilizado que podria rotarse.',
        icon: <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      },
      {
        title: 'Clientes que Vuelven',
        desc: 'Porcentaje de clientes del periodo que ya habian comprado antes. Indicador de fidelizacion y satisfaccion.',
        icon: <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      },
    ],
    example: {
      title: 'Ejemplo: Gestion de Stock Inteligente',
      badge: 'Accion Preventiva',
      scenario: 'El sistema detecta 3 productos en estado critico:',
      calculation:
        '- Pantalla iPhone 14: 1 unidad (min: 3) -> REPONER URGENTE\n- Cable USB-C 1m: 2 unidades (min: 5) -> REPONER URGENTE\n- Auriculares BT X: 8 unidades (0 ventas en 30 dias) -> Producto inmovilizado',
      result:
        'Dos productos necesitan reposicion inmediata. Uno esta acumulando sin venderse — candidato a liquidacion.',
      explanation:
        'Actuando antes de quedarte sin stock evitas perder ventas. El producto sin movimiento podria ofrecerse con descuento para recuperar capital.',
    },
    proTip:
      'El % de clientes que vuelven idealmente deberia ser 35% o mas. Si esta por debajo, considera programas de fidelizacion o descuentos por segunda compra.',
  },

  rankings: {
    id: 'rankings',
    label: 'Rankings y Filtros',
    icon: <Trophy className="h-4 w-4" />,
    badge: 'Desempeno del Equipo',
    title: 'Quienes son los Mejores y Como Filtrar',
    description:
      'Los rankings muestran productos estrella, cajeros productivos, clientes VIP y tecnicos con mejor rendimiento. Los filtros acotan el analisis al periodo y sucursal que necesitas.',
    highlights: [
      {
        title: 'Productos Top',
        desc: 'Los articulos mas vendidos por unidades y facturacion en el periodo. Te dice donde esta el volumen del negocio.',
        icon: <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      },
      {
        title: 'Cajeros y Tecnicos',
        desc: 'Quien facturo mas, cuantas reparaciones termino y el tiempo promedio de resolucion por tecnico.',
        icon: <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      },
      {
        title: 'Filtros de Periodo y Sucursal',
        desc: 'Podes analizar Hoy / 7 dias / 30 dias / 90 dias o un rango personalizado, filtrando por sucursal especifica.',
        icon: <CalendarRange className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
      },
      {
        title: 'Exportar PDF y Excel',
        desc: 'Descarga el reporte completo con graficos en PDF o datos en Excel/CSV para contabilidad o gerencia.',
        icon: <FileDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      },
    ],
    example: {
      title: 'Ejemplo: Reporte Mensual para Gerencia',
      badge: 'Flujo Completo',
      scenario: 'Primer lunes del mes: tenes que presentar el desempeno de agosto a la direccion.',
      calculation:
        '1. Selecciona "30 dias" en el filtro de periodo.\n2. Elige "Todas las sucursales" para la vista global.\n3. Rankings > Cajeros: identifica al vendedor del mes.\n4. Rankings > Productos: ve el mas vendido.\n5. Clic en "Descargar PDF" para el informe ejecutivo.',
      result:
        'En menos de 5 minutos tenes un PDF con graficos, KPIs y rankings listo para presentar o enviar.',
      explanation:
        'Tambien podes exportar el CSV para cruzar datos con tu sistema contable o planilla de comisiones.',
    },
    proTip:
      'Usa el filtro de sucursal para comparar rendimiento entre locales. Si una sucursal tiene margen muy diferente, puede indicar diferencias en precios, costos o mix de productos.',
  },
}

export function AnalyticsGuideDialog({
  open,
  onOpenChange,
  initialSection = 'kpis',
}: AnalyticsGuideDialogProps) {
  const [activeSection, setActiveSection] =
    useState<AnalyticsGuideSectionKey>(initialSection)

  const section = GUIDE_SECTIONS[activeSection] || GUIDE_SECTIONS.kpis
  const sectionKeys = Object.keys(GUIDE_SECTIONS) as AnalyticsGuideSectionKey[]
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

  const isGrid4 = section.highlights.length >= 4

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-3xl border border-border/80 shadow-2xl">
        {/* Cabecera */}
        <div className="p-6 pb-4 border-b bg-gradient-to-r from-violet-600/10 via-blue-600/5 to-transparent flex-shrink-0">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-violet-600 text-white shadow-md">
                  <BarChart2 className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Como funciona Analytics
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Guia completa de metricas, graficos, finanzas y rankings con ejemplos reales
                  </DialogDescription>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-bold border-violet-300/40 text-violet-600 dark:text-violet-400 bg-violet-500/5 px-2.5 py-1 rounded-xl hidden sm:flex"
              >
                Panel Administrativo
              </Badge>
            </div>
          </DialogHeader>

          {/* Tabs */}
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
                      ? 'bg-violet-600 text-white shadow-sm'
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

        {/* Contenido dinamico */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          <div className="space-y-5">
            <div className="border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  {section.badge}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <h3 className="text-base font-bold text-foreground">{section.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {section.description}
              </p>
            </div>

            <div className={cn('grid gap-3', isGrid4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
              {section.highlights.map((h, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-card border border-border/70 hover:border-violet-400/40 transition-colors space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-muted">{h.icon}</div>
                    <h4 className="text-xs font-bold text-foreground leading-tight">{h.title}</h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {h.desc}
                  </p>
                </div>
              ))}
            </div>

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
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-xs">
                  Conclusion: {section.example.result}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {section.example.explanation}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed text-violet-950 dark:text-violet-200">
                <strong className="font-bold">Pro Tip:</strong> {section.proTip}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/20 flex items-center justify-between flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="h-8 text-xs rounded-xl font-semibold"
          >
            Anterior
          </Button>

          <div className="flex items-center gap-1">
            {sectionKeys.map((k) => (
              <span
                key={k}
                onClick={() => setActiveSection(k)}
                className={cn(
                  'h-1.5 rounded-full cursor-pointer transition-all',
                  activeSection === k
                    ? 'w-5 bg-violet-600'
                    : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                )}
              />
            ))}
          </div>

          <Button
            size="sm"
            onClick={handleNext}
            className="h-8 text-xs rounded-xl font-bold gap-1 bg-violet-600 hover:bg-violet-700"
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
