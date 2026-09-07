'use client'

import { useEffect, useState } from 'react'
import {
  BookOpenCheck,
  CalendarClock,
  Briefcase,
  Calculator,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  WalletCards,
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
  HelpCircle,
  Coins,
  ReceiptText,
  UsersRound,
  CircleDollarSign,
  ChartNoAxesCombined,
  Settings2,
  Wrench,
  ShoppingBag,
  Info,
  Calendar,
  Percent,
  Download,
  FileDown,
  FileText,
  Printer,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  exportFinanceGuideToPdf,
  exportFinanceGuideToMarkdown,
  printFinanceGuide,
  type GuideContentType,
} from '@/lib/finances/finance-guide-exporter'

const sectionDisplayNames: Record<string, string> = {
  resumen: 'Resumen y Rutina',
  gastos: 'Gastos y Cuentas',
  nomina: 'Nómina y Sueldos',
  rentabilidad: 'Rentabilidad y Costos',
  configuracion: 'Configuración y Reglas',
  tips: 'Tips y Errores',
}

interface FinanceBusinessGuideModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  initialTab?: string
}

function normalizeTab(tab?: string): string {
  if (!tab) return 'resumen'
  const lower = tab.toLowerCase().trim()
  if (lower.includes('resumen') || lower === 'rutina') return 'resumen'
  if (lower.includes('gasto')) return 'gastos'
  if (lower.includes('nomina') || lower.includes('nómina')) return 'nomina'
  if (lower.includes('rentabilidad') || lower.includes('margen')) return 'rentabilidad'
  if (lower.includes('configuracion') || lower.includes('configuración') || lower.includes('regla')) return 'configuracion'
  if (lower.includes('tip') || lower.includes('error')) return 'tips'
  return 'resumen'
}

export function FinanceBusinessGuideModal({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  initialTab = 'resumen',
}: FinanceBusinessGuideModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen

  const [activeTab, setActiveTab] = useState<string>(() => normalizeTab(initialTab))
  const [filterMode, setFilterMode] = useState<'all' | 'manual' | 'examples'>('all')
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const showManual = filterMode === 'all' || filterMode === 'manual'
  const showExamples = filterMode === 'all' || filterMode === 'examples'

  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(normalizeTab(initialTab))
    }
  }, [open, initialTab])

  const handleDownloadPdf = async (allSections: boolean, contentType: GuideContentType = 'all') => {
    try {
      setIsExportingPdf(true)
      const typeLabel =
        contentType === 'manual'
          ? 'Manual de Procedimientos'
          : contentType === 'examples'
          ? 'Casos y Ejemplos en Gs.'
          : 'Manual Completo'

      toast.info(
        allSections
          ? `Generando ${typeLabel} en PDF...`
          : `Generando PDF (${typeLabel}) de ${sectionDisplayNames[activeTab] || 'la sección'}...`,
        { duration: 2500 }
      )
      await exportFinanceGuideToPdf({
        sectionKey: activeTab,
        allSections,
        contentType,
      })
      toast.success(
        allSections
          ? `${typeLabel} descargado con éxito en PDF`
          : `${typeLabel} (${sectionDisplayNames[activeTab] || 'Sección'}) descargado en PDF`
      )
    } catch (err) {
      console.error('Error al exportar PDF:', err)
      toast.error('Ocurrió un error al generar el PDF. Por favor intentá nuevamente.')
    } finally {
      setIsExportingPdf(false)
    }
  }

  const handleDownloadMarkdown = (allSections: boolean, contentType: GuideContentType = 'all') => {
    try {
      exportFinanceGuideToMarkdown({
        sectionKey: activeTab,
        allSections,
        contentType,
      })
      toast.success(
        allSections
          ? `Documento Markdown descargado (${contentType === 'manual' ? 'Manual' : contentType === 'examples' ? 'Ejemplos' : 'Completo'})`
          : `Guía (${sectionDisplayNames[activeTab] || 'sección'}) descargada (.md)`
      )
    } catch (err) {
      console.error('Error al exportar Markdown:', err)
      toast.error('Error al descargar el archivo Markdown.')
    }
  }

  const handlePrint = (allSections: boolean, contentType: GuideContentType = 'all') => {
    try {
      printFinanceGuide({
        sectionKey: activeTab,
        allSections,
        contentType,
      })
    } catch (err) {
      console.error('Error al abrir impresión:', err)
      toast.error('No se pudo abrir la ventana de impresión.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}

      <DialogContent className="flex h-[92vh] max-h-[95dvh] w-[95vw] max-w-6xl xl:max-w-7xl 2xl:max-w-[1400px] flex-col overflow-hidden p-0 sm:rounded-2xl shadow-2xl border-border/80 transition-all">
        {/* Header compacto con gradiente suave y botón de descarga */}
        <div className="flex flex-col gap-2.5 border-b border-border/80 bg-gradient-to-r from-primary/10 via-primary/5 to-background px-4 sm:px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <DialogHeader className="pr-2 text-left">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                <BookOpenCheck className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                    Manual Práctico de Gestión Financiera
                  </DialogTitle>
                  <Badge variant="outline" className="hidden sm:inline-flex border-primary/30 bg-primary/10 text-primary text-[10px] font-semibold py-0 h-4">
                    Guaraníes (Gs.)
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                  Guía paso a paso, casos reales en Gs., fórmulas y control operativo para tu negocio.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Menú de Descarga / Exportación en Encabezado */}
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExportingPdf}
                  className="h-8 gap-1.5 rounded-lg border-primary/30 bg-background/90 text-xs font-semibold shadow-xs hover:bg-primary/10 hover:text-primary transition-all"
                  title="Descargar o imprimir la guía de finanzas"
                >
                  {isExportingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>Descargar / Imprimir</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2">
                <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>¿Qué deseas descargar?</span>
                  <Badge variant="outline" className="text-[10px] font-normal">PDF / Docs</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />

                {/* OPCIÓN 1: SOLO EL MANUAL DE PROCEDIMIENTOS */}
                <DropdownMenuItem
                  onClick={() => void handleDownloadPdf(true, 'manual')}
                  disabled={isExportingPdf}
                  className="cursor-pointer gap-2.5 rounded-lg py-2 text-xs"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
                    <BookOpenCheck className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">📘 Manual de Procedimientos (PDF)</span>
                    <span className="text-[10px] text-muted-foreground">Reglas, metodologías, rutinas diaria/semanal y tips</span>
                  </div>
                </DropdownMenuItem>

                {/* OPCIÓN 2: SOLO LOS CASOS PRÁCTICOS Y EJEMPLOS */}
                <DropdownMenuItem
                  onClick={() => void handleDownloadPdf(true, 'examples')}
                  disabled={isExportingPdf}
                  className="cursor-pointer gap-2.5 rounded-lg py-2 text-xs"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                    <Coins className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">📊 Cuaderno de Ejemplos en Gs. (PDF)</span>
                    <span className="text-[10px] text-muted-foreground">Casos reales con números, costos de repuestos y fórmulas</span>
                  </div>
                </DropdownMenuItem>

                {/* OPCIÓN 3: MANUAL COMPLETO INTEGRAL */}
                <DropdownMenuItem
                  onClick={() => void handleDownloadPdf(true, 'all')}
                  disabled={isExportingPdf}
                  className="cursor-pointer gap-2.5 rounded-lg py-2 text-xs"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600">
                    <FileDown className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">📚 Manual Completo + Ejemplos (PDF)</span>
                    <span className="text-[10px] text-muted-foreground">Compendio integral unificado de las 5 secciones</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1.5" />
                <DropdownMenuLabel className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sección Actual: {sectionDisplayNames[activeTab] || 'Activa'}
                </DropdownMenuLabel>

                <DropdownMenuItem
                  onClick={() => void handleDownloadPdf(false, 'manual')}
                  disabled={isExportingPdf}
                  className="cursor-pointer gap-2 rounded-md py-1.5 text-xs"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  <span>Descargar Manual de {sectionDisplayNames[activeTab] || 'Sección'} (PDF)</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => void handleDownloadPdf(false, 'examples')}
                  disabled={isExportingPdf}
                  className="cursor-pointer gap-2 rounded-md py-1.5 text-xs"
                >
                  <Calculator className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Descargar Ejemplos de {sectionDisplayNames[activeTab] || 'Sección'} (PDF)</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1.5" />
                <DropdownMenuItem
                  onClick={() => handlePrint(true, 'all')}
                  className="cursor-pointer gap-2 rounded-md py-1.5 text-xs"
                >
                  <Printer className="h-3.5 w-3.5 text-amber-600" />
                  <span>Imprimir / Vista Previa</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDownloadMarkdown(true, 'all')}
                  className="cursor-pointer gap-2 rounded-md py-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5 text-sky-600" />
                  <span>Exportar en Markdown (.md)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs de navegación de secciones */}
        <div className="border-b border-border/60 bg-muted/30 px-4 sm:px-6 py-1">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val)}
            className="w-full"
          >
            <TabsList className="h-8 w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
              <TabsTrigger
                value="resumen"
                className="gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
              >
                <CircleDollarSign className="h-3.5 w-3.5" />
                Resumen y Rutina
              </TabsTrigger>
              <TabsTrigger
                value="gastos"
                className="gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
              >
                <ReceiptText className="h-3.5 w-3.5" />
                Gastos y Cuentas
              </TabsTrigger>
              <TabsTrigger
                value="nomina"
                className="gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
              >
                <UsersRound className="h-3.5 w-3.5" />
                Nómina y Sueldos
              </TabsTrigger>
              <TabsTrigger
                value="rentabilidad"
                className="gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
              >
                <ChartNoAxesCombined className="h-3.5 w-3.5" />
                Rentabilidad
              </TabsTrigger>
              <TabsTrigger
                value="configuracion"
                className="gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Configuración
              </TabsTrigger>
              <TabsTrigger
                value="tips"
                className="gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Tips y Errores
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Selector de Contenido: Todo vs Manual vs Ejemplos */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-border/40 bg-muted/15 px-4 sm:px-6 py-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground text-[11px] sm:text-xs">Filtro de lectura:</span>
            <span className="hidden sm:inline text-[11px]">Elegí ver el marco operativo o las simulaciones en Gs.</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={filterMode === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterMode('all')}
              className="h-6.5 rounded-md px-2 text-[11px] font-semibold"
            >
              Ver Todo
            </Button>
            <Button
              variant={filterMode === 'manual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterMode('manual')}
              className="h-6.5 rounded-md px-2 text-[11px] font-semibold gap-1 text-blue-700 dark:text-blue-300"
            >
              <BookOpenCheck className="h-3 w-3" />
              <span>Solo Manual y Rutinas</span>
            </Button>
            <Button
              variant={filterMode === 'examples' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterMode('examples')}
              className="h-6.5 rounded-md px-2 text-[11px] font-semibold gap-1 text-emerald-700 dark:text-emerald-300"
            >
              <Coins className="h-3 w-3" />
              <span>Solo Ejemplos (Gs.)</span>
            </Button>
          </div>
        </div>

        {/* Contenedor scrolleable */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-5 text-sm space-y-6">
          {/* TAB 1: RESUMEN Y RUTINA */}
          {activeTab === 'resumen' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-bold text-foreground text-base">
                  <CircleDollarSign className="h-5 w-5 text-primary" />
                  Cómo administrar la sección Resumen
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  El <strong>Resumen</strong> te ofrece una radiografía en tiempo real: compara el <strong>Resultado Económico</strong> (las ganancias netas tras todos los costos y gastos) con el <strong>Flujo de Fondos</strong> (dinero efectivamente cobrado menos pagado), alertando sobre compromisos vencidos y costos faltantes.
                </p>
              </div>

              {/* Comparación visual devengado vs caja */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Resultado Económico</span>
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                        Devengado
                      </Badge>
                    </div>
                    {showManual && (
                      <>
                        <p className="mt-2.5 text-xs text-muted-foreground">
                          Calcula la ganancia real del período independientemente de si ya se cobró todo:
                        </p>
                        <p className="mt-1.5 font-mono text-xs font-bold text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
                          Ingresos Totales − Costos − Gastos − Nómina = Ganancia Neta
                        </p>
                      </>
                    )}
                  </div>
                  {showExamples && (
                    <div className="mt-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2.5 text-[11px] sm:text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Caso real en Gs.:</span> Si vendiste por Gs. 1.000.000 con costo de Gs. 600.000 y gastos de Gs. 200.000, tu ganancia es Gs. 200.000, incluso si el cliente pagará en cuotas.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">2. Flujo de Fondos</span>
                      <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                        Caja / Banco
                      </Badge>
                    </div>
                    {showManual && (
                      <>
                        <p className="mt-2.5 text-xs text-muted-foreground">
                          Mide el dinero físico o bancario real que se movió en el período:
                        </p>
                        <p className="mt-1.5 font-mono text-xs font-bold text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
                          Total Cobrado en Mano − Total Pagado = Flujo Neto
                        </p>
                      </>
                    )}
                  </div>
                  {showExamples && (
                    <div className="mt-3 rounded-lg bg-blue-500/5 border border-blue-500/20 p-2.5 text-[11px] sm:text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Caso real en Gs.:</span> Si cobraste señas por Gs. 400.000 y pagaste alquiler por Gs. 300.000, tu flujo neto es Gs. +100.000 en el período.
                    </div>
                  )}
                </div>
              </div>

              {/* Rutina de Gestión */}
              {showManual && (
                <div className="space-y-3">
                  <h4 className="font-bold text-foreground flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    Rutina recomendada para administrar el negocio
                  </h4>
                  <div className="grid gap-3.5 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                      <p className="text-xs font-bold text-primary">Rutina Diaria</p>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                        1. Apertura de caja con fondo inicial.<br />
                        2. Registro inmediato de compras chicas.<br />
                        3. Arqueo ciego de caja al cierre para detectar faltantes.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Rutina Semanal</p>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                        1. Revisión de pagos vencidos y próximos.<br />
                        2. Carga de facturas de proveedores.<br />
                        3. Resolver alertas amarillas de costos faltantes.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                      <p className="text-xs font-bold text-purple-600 dark:text-purple-400">Rutina Mensual</p>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                        1. Preparar y auditar la nómina.<br />
                        2. Aprobar y registrar transferencias a empleados.<br />
                        3. Evaluar rentabilidad por producto y técnico.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GASTOS Y CUENTAS POR PAGAR */}
          {activeTab === 'gastos' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-bold text-foreground text-base">
                  <ReceiptText className="h-5 w-5 text-primary" />
                  Cómo administrar la sección Gastos y Cuentas por Pagar
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  En esta sección registrás todas las obligaciones del negocio: compras de repuestos, stock, alquiler, servicios, delivery e impuestos. La regla de oro: <strong>Registrar un gasto no significa pagarlo</strong>. Podés registrar compras a crédito a 30 o 60 días y luego asentar pagos parciales o totales.
                </p>
              </div>

              {/* Diseño adaptativo para pantallas amplias y pequeñas */}
              <div className={filterMode === 'all' ? "grid gap-5 lg:grid-cols-12" : "space-y-5"}>
                {showManual && (
                  <div className={filterMode === 'all' ? "lg:col-span-7 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs" : "rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs"}>
                    <h4 className="font-bold text-foreground text-sm mb-3">Pasos para una correcta administración de gastos:</h4>
                    <ol className="space-y-2.5 text-xs text-muted-foreground list-decimal pl-5">
                      <li>
                        <strong className="text-foreground">Cargar el gasto apenas recibís la factura o remisión:</strong> Hacé clic en <em>Nuevo gasto</em>. Ingresá el proveedor, categoría contable, importe y fecha de vencimiento.
                      </li>
                      <li>
                        <strong className="text-foreground">Diferenciar Fecha Contable vs. Fecha de Vencimiento:</strong> La fecha contable indica a qué mes corresponde el gasto (ej. la luz de agosto). La fecha de vencimiento indica cuándo tenés plazo para pagarla.
                      </li>
                      <li>
                        <strong className="text-foreground">Registrar Abonos y Pagos Parciales:</strong> En la tabla de gastos, hacé clic en <em>Pagar</em>. Podés abonar una parte (ej. Gs. 500.000 de Gs. 1.500.000) o la totalidad. El estado cambiará a <em>Pago parcial</em> y mantendrá el saldo pendiente visible.
                      </li>
                      <li>
                        <strong className="text-foreground">Pagos en efectivo requieren Caja Abierta:</strong> Si pagás en efectivo, el sistema te solicitará seleccionar la sesión de caja abierta para descontar el dinero automáticamente del arqueo diario.
                      </li>
                    </ol>
                  </div>
                )}

                {showExamples && (
                  <div className={filterMode === 'all' ? "lg:col-span-5 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 sm:p-5 text-xs flex flex-col justify-between" : "rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 sm:p-5 text-xs"}>
                    <div>
                      <h4 className="font-bold text-blue-700 dark:text-blue-300 text-sm mb-2 flex items-center gap-1.5">
                        <Briefcase className="h-4 w-4" />
                        Ejemplo Práctico: Compra de Repuestos a Crédito
                      </h4>
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 mt-2">
                        <div className="rounded-lg bg-background/80 p-3 border border-border/70">
                          <p className="font-semibold text-foreground">Registro Inicial:</p>
                          <p className="mt-1 text-muted-foreground">• Factura de proveedor: <strong>Gs. 2.000.000</strong> a 30 días.</p>
                          <p className="text-muted-foreground">• Estado inicial: <span className="font-bold text-amber-600">Pendiente</span>.</p>
                          <p className="text-muted-foreground">• Pendiente actual: <strong>Gs. 2.000.000</strong> (no descuenta caja todavía).</p>
                        </div>
                        <div className="rounded-lg bg-background/80 p-3 border border-border/70">
                          <p className="font-semibold text-foreground">Abono Quincenal:</p>
                          <p className="mt-1 text-muted-foreground">• Pagás un anticipo de <strong>Gs. 800.000</strong> por transferencia.</p>
                          <p className="text-muted-foreground">• Estado actualizado: <span className="font-bold text-sky-600">Pago parcial</span>.</p>
                          <p className="text-muted-foreground">• Saldo por saldar: <strong>Gs. 1.200.000</strong> en próximos vencimientos.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: NÓMINA Y SUELDOS */}
          {activeTab === 'nomina' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-bold text-foreground text-base">
                  <UsersRound className="h-5 w-5 text-primary" />
                  Cómo administrar la Nómina y Salarios
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  El módulo de nómina automatiza la liquidación de tu equipo: combina los <strong>sueldos base</strong> configurados con las <strong>comisiones</strong> generadas por ventas y reparaciones de técnicos en el mes.
                </p>
              </div>

              {/* El ciclo de 4 pasos */}
              {showManual && (
                <div className="space-y-3">
                  <h4 className="font-bold text-foreground text-sm">El Ciclo de Nómina en 4 Pasos:</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                    <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs mb-2">1</span>
                      <p className="font-bold text-foreground">Preparar</p>
                      <p className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
                        Hacé clic en <em>Preparar nómina</em> para el período deseado. El sistema calculará automáticamente comisiones y salarios base.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs mb-2">2</span>
                      <p className="font-bold text-foreground">Revisar y Ajustar</p>
                      <p className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
                        Verificá el desglose de cada empleado. Podés ingresar adelantos ya otorgados o bonos extras antes de fijar los números.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs mb-2">3</span>
                      <p className="font-bold text-foreground">Aprobar</p>
                      <p className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
                        Hacé clic en <em>Aprobar corrida</em>. Esto fija contablemente el gasto de salarios del mes. <em>(Aprobar no significa pagar todavía)</em>.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs mb-2">4</span>
                      <p className="font-bold text-foreground">Registrar Pagos</p>
                      <p className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
                        A medida que entregues el dinero o hagas las transferencias, hacé clic en <em>Registrar pago</em> para impactar en el flujo de caja.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ejemplo real de técnico */}
              {showExamples && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 sm:p-5 text-xs">
                  <h4 className="font-bold text-purple-700 dark:text-purple-300 text-sm mb-2 flex items-center gap-1.5">
                    <Wrench className="h-4 w-4" />
                    Ejemplo Práctico: Liquidación de Técnico de Taller
                  </h4>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 bg-background/80 p-3.5 rounded-lg border border-border/70">
                    <div>
                      <p className="text-muted-foreground">Sueldo Base mensual:</p>
                      <p className="font-bold text-foreground text-sm mt-0.5">Gs. 2.800.000</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Mano de obra reparada:</p>
                      <p className="font-bold text-foreground text-sm mt-0.5">Gs. 6.000.000</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Comisión (10% MO):</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">Gs. 600.000</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Neto a Percibir:</p>
                      <p className="font-bold text-primary text-sm mt-0.5">Gs. 3.400.000</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RENTABILIDAD */}
          {activeTab === 'rentabilidad' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-bold text-foreground text-base">
                  <ChartNoAxesCombined className="h-5 w-5 text-primary" />
                  Cómo administrar la sección Rentabilidad
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Esta sección te permite saber exactamente qué productos, reparaciones, técnicos o sucursales dejan más dinero limpio en tu negocio. Calcula la <strong>Utilidad Bruta</strong> (Ingresos − Costo directo de mercadería o repuesto) y el <strong>Margen %</strong> real.
                </p>
              </div>

              {showManual && (
                <div className="grid gap-4 md:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <Percent className="h-4 w-4 text-primary" />
                      Cómo leer los márgenes por colores:
                    </h4>
                    <div className="space-y-2 pt-1">
                      <p className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
                        <span><strong>Verde (&gt; 15%):</strong> Margen saludable y rentable para el negocio.</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-amber-500 shrink-0" />
                        <span><strong>Amarillo (0% a 15%):</strong> Margen ajustado. Requiere revisar costos de compra o precios de venta.</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-rose-500 shrink-0" />
                        <span><strong>Rojo (&lt; 0%):</strong> Venta o reparación a pérdida. Estás perdiendo dinero en esa operación.</span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Atención a la "Cobertura Incompleta":
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Si vendiste un producto o realizaste una reparación sin costo de repuesto cargado, el sistema te mostrará una insignia de advertencia.
                    </p>
                    <p className="text-muted-foreground leading-relaxed font-semibold">
                      Tip: Clickeá la fila para abrir su detalle y cargar el costo histórico. Esto evitará que tu margen aparezca inflado artificialmente al 100%.
                    </p>
                  </div>
                </div>
              )}

              {/* Ejemplo de reparación */}
              {showExamples && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 text-xs">
                  <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm mb-1.5 flex items-center gap-1.5">
                    <Coins className="h-4 w-4" />
                    Ejemplo: Reparación de Pantalla iPhone 13
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Cobraste <strong>Gs. 450.000</strong>. La pantalla costó <strong>Gs. 150.000</strong>. Tu ganancia bruta es <strong>Gs. 300.000</strong> (Margen del 66.6%). Con esos Gs. 300.000 financiás el alquiler del local y los salarios del personal técnico.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CONFIGURACIÓN */}
          {activeTab === 'configuracion' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-bold text-foreground text-base">
                  <Settings2 className="h-5 w-5 text-primary" />
                  Cómo administrar la sección Configuración
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Aquí defines las bases de remuneración de tu empresa: asignás el <strong>Sueldo Base</strong> a cada colaborador y creás <strong>Reglas de Comisión Automáticas</strong> para incentivar a vendedores y técnicos.
                </p>
              </div>

              {showManual && (
                <div className="grid gap-4 md:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <UsersRound className="h-4 w-4 text-primary" />
                      1. Personal y Sueldos Base:
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Asigná el salario fijo mensual de cada empleado. Podés definir montos distintos por colaborador y establecer desde qué fecha tiene vigencia. Al preparar la nómina, el sistema tomará este importe como punto de partida.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-2">
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary" />
                      2. Creación de Reglas de Comisión:
                    </h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• <strong>Alcance:</strong> Por colaborador individual o por rol comercial general.</li>
                      <li>• <strong>Origen:</strong> Venta de productos, reparación general o mano de obra técnica.</li>
                      <li>• <strong>Tipo:</strong> Porcentaje (%) o importe fijo en guaraníes.</li>
                      <li>• <strong>Vigencia:</strong> Fecha desde la cual comenzará a calcularse.</li>
                    </ul>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-5 text-xs">
                <h4 className="font-bold text-foreground mb-1">Buenas prácticas de configuración:</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Las reglas nuevas se crean en estado <strong>Borrador</strong> para que puedas revisarlas con tranquilidad. Una vez verificadas, hacé clic en <strong>Aprobar regla</strong> para que comience a aplicarse a las operaciones futuras. Si una regla queda obsoleta, usá <strong>Retirar</strong>: dejará de comisionar hacia adelante pero conservará el historial intacto.
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: TIPS Y ERRORES COMUNES */}
          {activeTab === 'tips' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
                <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Los 5 Tips de Oro para una Administración Financiera Exitosa
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div className="rounded-lg bg-muted/40 p-3.5 border border-border/60">
                    <p className="font-bold text-foreground">1. Costo obligatorio</p>
                    <p className="mt-1 text-muted-foreground">Nunca dejes productos o repuestos sin costo; distorsionaría tu ganancia real al 100%.</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3.5 border border-border/60">
                    <p className="font-bold text-foreground">2. Arqueo ciego diario</p>
                    <p className="mt-1 text-muted-foreground">Contar el efectivo físico antes de ver el monto del sistema elimina desvíos y faltantes.</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3.5 border border-border/60">
                    <p className="font-bold text-foreground">3. Fecha contable vs pago</p>
                    <p className="mt-1 text-muted-foreground">La fecha contable afecta el resultado del mes; la fecha de pago afecta el saldo de caja o banco.</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3.5 border border-border/60">
                    <p className="font-bold text-foreground">4. Auditar nómina antes</p>
                    <p className="mt-1 text-muted-foreground">Usá <em>Preparar Nómina</em>, corroborá con el equipo y aprobá antes de transferir.</p>
                  </div>
                </div>
              </div>

              {/* Errores comunes */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  Solución a Errores Comunes
                </h4>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs">
                    <p className="font-bold text-rose-700 dark:text-rose-400">
                      "No puedo registrar un pago de gasto en efectivo"
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      <strong>Solución:</strong> Todo pago en efectivo debe salir de una caja abierta de la sucursal. Abrí la sesión de caja del día o seleccioná método de pago bancario / cheque.
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs">
                    <p className="font-bold text-amber-700 dark:text-amber-400">
                      "Aprobé la nómina pero el dinero no se descontó de la cuenta"
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      <strong>Solución:</strong> Aprobar reconoce el compromiso contable. Para descontar el dinero, hacé clic en <strong>Pagar</strong> en la corrida de nómina.
                    </p>
                  </div>

                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs">
                    <p className="font-bold text-blue-700 dark:text-blue-400">
                      "¿Por qué tengo Ganancia Neta positiva pero poco saldo en el banco?"
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      <strong>Causa frecuente:</strong> Compraste mercadería o repuestos que todavía están en las estanterías (stock), o tus clientes tienen cuotas a crédito por vencer en los próximos meses.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border/80 bg-muted/20 px-4 sm:px-6 py-2.5">
          <p className="text-[11px] text-muted-foreground hidden lg:block">
            Los ejemplos son ilustrativos y no alteran tus registros contables reales.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDownloadPdf(false, 'manual')}
              disabled={isExportingPdf}
              className="h-7.5 gap-1.5 rounded-lg border-blue-500/30 bg-blue-500/5 text-xs font-semibold text-blue-700 hover:bg-blue-500/15 dark:text-blue-300 shadow-2xs"
              title={`Descargar solo el Manual de Procedimientos de ${sectionDisplayNames[activeTab] || 'la sección'}`}
            >
              <BookOpenCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Descargar PDF Manual ({sectionDisplayNames[activeTab] || 'Sección'})</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDownloadPdf(false, 'examples')}
              disabled={isExportingPdf}
              className="h-7.5 gap-1.5 rounded-lg border-emerald-500/30 bg-emerald-500/5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300 shadow-2xs"
              title={`Descargar solo los Ejemplos Prácticos en Gs. de ${sectionDisplayNames[activeTab] || 'la sección'}`}
            >
              <Coins className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Descargar PDF Ejemplos ({sectionDisplayNames[activeTab] || 'Sección'})</span>
            </Button>

            <Button onClick={() => setOpen(false)} className="h-7.5 rounded-lg text-xs font-semibold">
              Entendido, volver a Finanzas
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
