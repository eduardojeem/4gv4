'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Printer,
  Settings2,
  ShieldCheck,
  FileText,
  Globe,
  Sliders,
  RotateCcw,
  Check,
  Loader2,
  Cloud,
  AlertCircle,
  Eye,
  Image as ImageIcon,
  PackageCheck,
  PenLine,
  QrCode,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  RepairReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS,
  generateRepairReceiptHTML,
  getReceiptSettings,
  patchReceiptSettings,
  printRepairReceipt,
  refreshReceiptSettings,
  type CompanyInfo,
  RepairPrintPayload
} from '@/lib/repair-receipt'
import {
  abandonmentClause,
  CLAUSE_TOPICS,
  DAMAGE_EXCLUSION_CLAUSE,
  DATA_LOSS_CLAUSE,
  diffRepairReceiptSettings,
  PICKUP_CLAUSE,
  RECEIPT_ABANDONMENT_DAYS_MAX,
  RECEIPT_LEGAL_TEXT_MAX,
} from '@/lib/repairs/receipt-settings'
import {
  clampWarrantyMonths,
  formatWarrantyMonths,
  WARRANTY_MONTH_PRESETS,
  WARRANTY_MONTHS_MAX,
  WARRANTY_MONTHS_MIN,
  WARRANTY_NOTES_MAX,
  WARRANTY_TYPE_LABELS,
  WARRANTY_TYPES,
  type WarrantyType,
} from '@/lib/repairs/warranty'
import { cn } from '@/lib/utils'

interface RepairReceiptSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettingsSaved?: (settings: RepairReceiptSettings) => void
  /**
   * Los datos reales de la empresa para la muestra. Antes la muestra salía
   * siempre como «Servicio Técnico Especializado» y sin logo: no se podía ver
   * cómo quedaba el logo propio ni su tamaño.
   */
  company?: CompanyInfo
}

const PAPER_OPTIONS: Array<{ value: RepairReceiptSettings['paperFormat']; label: string; hint: string }> = [
  { value: '80mm', label: '80 mm', hint: 'Térmica estándar' },
  { value: '58mm', label: '58 mm', hint: 'Térmica chica' },
  { value: 'A4', label: 'A4', hint: 'Hoja completa' },
]

/** Ancho real del papel en pantalla (96 ppp), para que la vista previa sea fiel. */
const PREVIEW_WIDTH_PX: Record<RepairReceiptSettings['paperFormat'], number> = {
  '80mm': 302,
  '58mm': 219,
  'A4': 794,
}
const PREVIEW_COLUMN_PX = 340

const SAMPLE_COMPANY: CompanyInfo = {
  name: 'Nombre de tu taller',
  phone: '021 000 000',
  address: 'Dirección del taller',
}

const LOGO_HEIGHTS = [
  { label: 'Compacto', value: 36 },
  { label: 'Estándar', value: 48 },
  { label: 'Grande', value: 60 },
]

// El mismo texto que agrega el comprobante: si se inserta acá, el comprobante
// lo detecta por el tema y no lo repite. El abandono no está: ya tiene su propio
// campo con los días.
const LEGAL_CLAUSES = [
  { label: '+ Pérdida de datos', text: DATA_LOSS_CLAUSE, topic: CLAUSE_TOPICS.dataLoss },
  { label: '+ Presentación obligatoria', text: PICKUP_CLAUSE, topic: CLAUSE_TOPICS.pickup },
  { label: '+ Exclusión golpes/líquidos', text: DAMAGE_EXCLUSION_CLAUSE, topic: CLAUSE_TOPICS.damage },
]

export function RepairReceiptSettingsDialog({
  open,
  onOpenChange,
  onSettingsSaved,
  company,
}: RepairReceiptSettingsDialogProps) {
  const [settings, setSettings] = useState<RepairReceiptSettings>(DEFAULT_RECEIPT_SETTINGS)
  const [savedSettings, setSavedSettings] = useState<RepairReceiptSettings>(DEFAULT_RECEIPT_SETTINGS)
  // Si ya llegó la configuración para esta apertura del diálogo.
  const [syncedForOpen, setSyncedForOpen] = useState(false)
  const [lastOpen, setLastOpen] = useState(open)
  const [isSaving, setIsSaving] = useState(false)
  const [canEdit, setCanEdit] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Lo que se está tipeando en «meses», aparte del valor guardado: si el número
  // se acotaba en cada tecla, borrar el campo lo dejaba en 0 y no se podía
  // escribir otro valor.
  const [monthsDraft, setMonthsDraft] = useState(String(DEFAULT_RECEIPT_SETTINGS.defaultWarrantyMonths))
  // Lo mismo con los días de abandono: borrar el campo lo dejaba en 0 al instante.
  const [daysDraft, setDaysDraft] = useState(String(DEFAULT_RECEIPT_SETTINGS.abandonmentDays))

  const changes = useMemo(() => diffRepairReceiptSettings(savedSettings, settings), [savedSettings, settings])
  const isDirty = Object.keys(changes).length > 0
  // Al abrir de nuevo se vuelve a sincronizar. Se ajusta durante el render, como
  // recomienda React para estado que depende de una prop, en vez de hacerlo
  // dentro del efecto.
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setSyncedForOpen(false)
      setLoadError(null)
    }
  }
  const isLoading = open && !syncedForOpen
  const fieldsLocked = !canEdit || isLoading || isSaving

  const update = <K extends keyof RepairReceiptSettings>(key: K, value: RepairReceiptSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    // Solo al abrir. Antes también pedía la configuración al cerrar el diálogo.
    if (!open) return
    let active = true

    void refreshReceiptSettings({ force: true }).then((snapshot) => {
      if (!active) return
      const next = snapshot?.settings ?? getReceiptSettings()
      setSettings(next)
      setSavedSettings(next)
      setMonthsDraft(String(next.defaultWarrantyMonths))
      setDaysDraft(String(next.abandonmentDays))
      if (snapshot) {
        setCanEdit(snapshot.canEdit)
      } else {
        setLoadError('No se pudo sincronizar con el servidor. Se muestra la última copia de este equipo.')
      }
      setSyncedForOpen(true)
    })

    return () => { active = false }
  }, [open])

  const handleSave = async () => {
    if (!isDirty) return
    setIsSaving(true)
    // Solo lo que cambió. Si mientras tanto alguien fijó la garantía desde el
    // formulario de reparación, este guardado no se la pisa.
    const result = await patchReceiptSettings(changes)
    setIsSaving(false)

    if ('error' in result) {
      toast.error('No se guardaron los cambios', { description: result.error })
      return
    }

    setSettings(result.settings)
    setSavedSettings(result.settings)
    setMonthsDraft(String(result.settings.defaultWarrantyMonths))
    setDaysDraft(String(result.settings.abandonmentDays))
    toast.success('Configuración guardada para toda la organización')
    onSettingsSaved?.(result.settings)
    onOpenChange(false)
  }

  const handleReset = () => {
    // Reemplaza también el texto legal propio: se confirma antes.
    if (!window.confirm('Se cargan los valores de fábrica, incluido el texto legal. No se aplican hasta que guardes. ¿Continuar?')) return
    setSettings({ ...DEFAULT_RECEIPT_SETTINGS })
    setMonthsDraft(String(DEFAULT_RECEIPT_SETTINGS.defaultWarrantyMonths))
    setDaysDraft(String(DEFAULT_RECEIPT_SETTINGS.abandonmentDays))
    toast.info('Valores de fábrica cargados', { description: 'Presioná Guardar para aplicarlos a la organización.' })
  }

  const commitDays = (value: string) => {
    const parsed = Number.parseInt(value, 10)
    const days = Number.isFinite(parsed)
      ? Math.min(RECEIPT_ABANDONMENT_DAYS_MAX, Math.max(0, parsed))
      : settings.abandonmentDays
    update('abandonmentDays', days)
    setDaysDraft(String(days))
  }

  const insertLegalClause = (clause: string) => {
    setSettings((prev) => {
      if (LEGAL_CLAUSES.some((item) => item.text === clause && item.topic.test(prev.legalText))) return prev
      // Cada cláusula en su renglón: el comprobante respeta los saltos de línea.
      const legalText = prev.legalText.trim() ? `${prev.legalText.trimEnd()}\n${clause}` : clause
      return legalText.length > RECEIPT_LEGAL_TEXT_MAX ? prev : { ...prev, legalText }
    })
  }

  const commitMonths = (value: string) => {
    const months = clampWarrantyMonths(value, settings.defaultWarrantyMonths)
    update('defaultWarrantyMonths', months)
    setMonthsDraft(String(months))
  }

  const buildSamplePayload = (): RepairPrintPayload => ({
      ticketNumber: 'R-2026-MUESTRA',
      date: new Date(),
      customer: {
        name: 'Cliente de Prueba',
        phone: '+595 981 123456',
        document: '4.567.890-1',
        address: 'Av. Central 123'
      },
      devices: [{
        typeLabel: 'Smartphone',
        brand: 'Samsung',
        model: 'Galaxy S23 Ultra',
        serialNumber: 'SN9876543210',
        imei: '358901234567890',
        issue: 'Cambio de pantalla táctil y módulo de carga',
        accessories: 'Cargador original 25W, funda protectora',
        description: 'Rayones leves en laterales, pantalla trizada',
        technician: 'Carlos Técnico',
        estimatedCost: 350000,
        paidAmount: 100000,
        deposit: 100000,
        ticketNumber: 'R-2026-MUESTRA'
      }],
      estimatedCost: 350000,
      paidAmount: 100000,
      warrantyMonths: settings.defaultWarrantyMonths,
      warrantyType: settings.defaultWarrantyType,
      warrantyNotes: settings.defaultWarrantyNotes,
      // Un código de ejemplo, para que el QR también se vea en la muestra.
      verificationHash: 'muestra',
      trackingUrl: 'https://www.mitiendapy.com/mi-tienda/mis-reparaciones/R-2026-MUESTRA?verify=muestra',
      storeUrl: 'https://www.mitiendapy.com/mi-tienda/inicio',
      company: company?.name ? company : SAMPLE_COMPANY,
  })

  const handleTestPrint = () => {
    printRepairReceipt('customer', buildSamplePayload(), settings.paperFormat, settings)
  }

  // Vista previa en vivo del mismo HTML que se imprime. Antes había que imprimir
  // una muestra para ver cada cambio.
  const previewHtml = useMemo(
    () => (open ? generateRepairReceiptHTML('customer', buildSamplePayload(), settings.paperFormat, settings) : ''),
    // buildSamplePayload solo depende de settings y company.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, settings, company]
  )
  const previewFrameRef = useRef<HTMLIFrameElement>(null)
  const [previewHeight, setPreviewHeight] = useState(900)
  const paperWidth = PREVIEW_WIDTH_PX[settings.paperFormat]
  const previewScale = Math.min(1, PREVIEW_COLUMN_PX / paperWidth)
  const measurePreview = () => {
    const body = previewFrameRef.current?.contentDocument?.body
    if (body) setPreviewHeight(Math.max(300, body.scrollHeight + 24))
  }
  const hasCompanyLogo = Boolean(company?.logo)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty && !isSaving) {
      const discard = window.confirm('Tenés cambios sin guardar. ¿Querés descartarlos?')
      if (!discard) return
    }
    onOpenChange(nextOpen)
  }

  const toggleRow = (
    id: keyof RepairReceiptSettings,
    Icon: LucideIcon,
    title: string,
    description: string,
    checked: boolean,
    tone: 'default' | 'accent' = 'default'
  ) => (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border p-3',
        tone === 'accent' ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/30'
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5 pr-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-0.5">
          <Label htmlFor={`receipt-${String(id)}`} className="text-xs font-bold text-foreground">
            {title}
          </Label>
          <p id={`receipt-${String(id)}-hint`} className="text-xs leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={`receipt-${String(id)}`}
        checked={checked}
        aria-describedby={`receipt-${String(id)}-hint`}
        onCheckedChange={(val) => update(id, val as never)}
      />
    </div>
  )

  const preview = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Eye className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Vista previa ({settings.paperFormat === 'A4' ? 'A4' : settings.paperFormat.replace('mm', ' mm')})
        </p>
        <span className="text-xs text-muted-foreground">Datos de ejemplo</span>
      </div>
      <div className="overflow-hidden rounded-xl border bg-muted/40 p-3">
        <div
          className="mx-auto overflow-hidden bg-white shadow-sm"
          style={{ width: paperWidth * previewScale, height: previewHeight * previewScale }}
        >
          {previewHtml && (
            <iframe
              ref={previewFrameRef}
              title="Vista previa del comprobante"
              // Sin scripts: el HTML trae la orden de imprimir al cargar.
              sandbox="allow-same-origin"
              srcDoc={previewHtml}
              onLoad={measurePreview}
              style={{
                width: paperWidth,
                height: previewHeight,
                border: 0,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-[780px] lg:max-w-[1180px] flex flex-col p-0 overflow-hidden rounded-2xl border shadow-xl">
        <DialogHeader className="border-b bg-muted/30 p-4 pr-12 sm:p-5 sm:pr-12">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold sm:text-lg">
                Personalizar comprobante de impresión
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Se aplica a los comprobantes de reparación de toda la organización.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-4 py-2 text-xs sm:px-5" role="status">
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" /> : loadError ? <AlertCircle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" /> : <Cloud className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />}
          <span className={loadError ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}>
            {isLoading
              ? 'Sincronizando configuración…'
              : loadError
                ? `${loadError} Podés revisar, pero necesitás conexión para guardar.`
                : isDirty
                  ? `${Object.keys(changes).length} ${Object.keys(changes).length === 1 ? 'cambio pendiente' : 'cambios pendientes'} de guardar`
                  : 'Configuración sincronizada'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {!canEdit && (
            <div className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>Podés revisar todas las pestañas e imprimir una muestra. Solo un administrador puede cambiar esta configuración.</p>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_366px]">
          {/* Las pestañas quedan fuera de los campos bloqueados. Antes todo iba
              dentro de un fieldset deshabilitado, que también deshabilita los
              botones de las pestañas: quien no era administrador solo podía ver
              la primera. */}
          <Tabs defaultValue="sections" className="min-w-0 space-y-4">
            <TabsList className="grid h-auto grid-cols-3 w-full bg-muted p-1 rounded-xl">
              <TabsTrigger value="sections" className="text-xs font-bold rounded-xl gap-1.5">
                <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Formato</span>
              </TabsTrigger>
              <TabsTrigger value="legal" className="text-xs font-bold rounded-xl gap-1.5">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Términos</span>
              </TabsTrigger>
              <TabsTrigger value="warranty" className="text-xs font-bold rounded-xl gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Garantía</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Papel, logo y secciones */}
            <TabsContent value="sections" className="pt-1">
              <fieldset disabled={fieldsLocked} className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
                {/* El papel va con el resto del formato: antes estaba escondido
                    en la pestaña de garantía. */}
                <div className="space-y-2">
                  <span id="receipt-paper" className="text-xs font-bold text-foreground">Papel</span>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="receipt-paper">
                    {PAPER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={settings.paperFormat === option.value}
                        onClick={() => update('paperFormat', option.value)}
                        className={cn(
                          'rounded-xl border p-2.5 text-center transition-colors',
                          settings.paperFormat === option.value
                            ? 'border-primary bg-primary/10 font-bold text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        )}
                      >
                        <span className="block text-sm font-bold">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* El logo y sus opciones, juntos. Estaban repartidos: el mismo
                    interruptor aparecía acá y otra vez en «Garantía y papel». */}
                <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5 pr-2">
                      <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <div className="space-y-0.5">
                        <Label htmlFor="receipt-showLogo" className="text-xs font-bold text-foreground">
                          Logo de la empresa en el encabezado
                        </Label>
                        <p id="receipt-showLogo-hint" className="text-xs text-muted-foreground">
                          {!settings.showLogo
                            ? 'Imprime solo el nombre del local en texto grande.'
                            : company && !hasCompanyLogo
                              ? 'Tu organización no tiene logo cargado: se imprime solo el nombre. Podés subirlo en Sitio web.'
                              : 'Imprime el logo y el nombre de la empresa.'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="receipt-showLogo"
                      checked={settings.showLogo}
                      aria-describedby="receipt-showLogo-hint"
                      onCheckedChange={(val) => update('showLogo', val)}
                    />
                  </div>

                  {settings.showLogo && (
                    <div className="space-y-3 border-t border-border pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-0.5 pr-2">
                          <Label htmlFor="receipt-monochromeLogo" className="text-xs font-semibold text-foreground">
                            Logo en blanco y negro de alto contraste
                          </Label>
                          <p id="receipt-monochromeLogo-hint" className="text-xs leading-snug text-muted-foreground">
                            Solo en papel térmico (80 y 58 mm): pasa el logo a negro nítido. En A4 se imprime a color.
                          </p>
                        </div>
                        <Switch
                          id="receipt-monochromeLogo"
                          checked={settings.monochromeLogo}
                          aria-describedby="receipt-monochromeLogo-hint"
                          onCheckedChange={(val) => update('monochromeLogo', val)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span id="receipt-logo-height" className="text-xs font-semibold text-foreground">Tamaño del logo</span>
                        <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="receipt-logo-height">
                          {LOGO_HEIGHTS.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              aria-pressed={settings.logoHeight === item.value}
                              onClick={() => update('logoHeight', item.value)}
                              className={cn(
                                'rounded-lg border py-1.5 text-xs font-bold transition-colors',
                                settings.logoHeight === item.value
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border text-muted-foreground hover:border-primary/40'
                              )}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        {!LOGO_HEIGHTS.some((item) => item.value === settings.logoHeight) && (
                          <p className="text-xs text-muted-foreground">
                            El tamaño guardado ({settings.logoHeight}px) no es una de las opciones; elegí una para cambiarlo.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {toggleRow('showFinancialBreakdown', Wallet, 'Resumen de pago', 'Presupuesto total, seña cobrada y saldo a pagar al retirar.', settings.showFinancialBreakdown)}
                {toggleRow('showAccessories', PackageCheck, 'Accesorios recibidos', 'Cargador, funda, SIM o memorias que dejó el cliente con el equipo.', settings.showAccessories)}
                {toggleRow('showImei', Smartphone, 'IMEI o número de serie', 'Identifica el equipo recibido.', settings.showImei)}
                {toggleRow('showCustomerSignature', PenLine, 'Firma del cliente al dejar el equipo', 'Recuadro de firma con aclaración y C.I.', settings.showCustomerSignature)}
                {toggleRow('showDeliveryControl', ShieldCheck, 'Control de entrega y garantía', 'Recuadro con fecha de entrega y firmas del taller y del cliente: el mismo papel sirve de certificado de garantía.', settings.showDeliveryControl, 'accent')}
                {toggleRow('showHash', QrCode, 'Código QR de seguimiento', 'El cliente lo escanea para ver el estado de su reparación; también valida que el comprobante es auténtico.', settings.showHash)}
                {toggleRow('showStoreWebsite', Globe, 'Dirección de tu tienda online', 'Al pie del comprobante, por ejemplo www.mitiendapy.com/tu-tienda/inicio. Siempre con el dominio de producción.', settings.showStoreWebsite)}
              </fieldset>
            </TabsContent>
            {/* TAB 2: Términos legales */}
            <TabsContent value="legal" className="pt-1">
              <fieldset disabled={fieldsLocked} className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
                <div>
                  <Label htmlFor="receipt-legalText" className="text-xs font-bold text-foreground">
                    Texto legal y deslinde de responsabilidad
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Se imprime al pie del comprobante que el cliente firma. Si lo dejás vacío, no se imprime.
                  </p>
                </div>

                <Textarea
                  id="receipt-legalText"
                  rows={4}
                  maxLength={RECEIPT_LEGAL_TEXT_MAX}
                  value={settings.legalText}
                  onChange={(e) => update('legalText', e.target.value)}
                  className="rounded-xl text-xs leading-relaxed"
                  placeholder="Escribí acá los términos legales..."
                />
                <p className="text-right text-[10px] text-muted-foreground">{settings.legalText.length}/{RECEIPT_LEGAL_TEXT_MAX}</p>

                <div className="space-y-1">
                  <Label htmlFor="receipt-abandonment-days" className="text-xs font-semibold text-foreground">
                    Días para considerar abandonado el equipo
                  </Label>
                  <Input
                    id="receipt-abandonment-days"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={RECEIPT_ABANDONMENT_DAYS_MAX}
                    step={1}
                    value={daysDraft}
                    onChange={(e) => {
                      setDaysDraft(e.target.value)
                      if (e.target.value.trim() !== '') commitDays(e.target.value)
                    }}
                    onBlur={(e) => commitDays(e.target.value)}
                    className="h-9 w-32 rounded-xl text-xs font-bold"
                    aria-describedby="receipt-abandonment-help"
                  />
                  <p id="receipt-abandonment-help" className="text-xs text-muted-foreground">
                    {settings.abandonmentDays > 0
                      ? `Se imprime: «${abandonmentClause(settings.abandonmentDays)}»`
                      : 'Con 0 no se imprime la cláusula de abandono.'}
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-bold text-muted-foreground">
                    Agregar cláusula recomendada
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {LEGAL_CLAUSES.map((clause) => (
                      <Button
                        key={clause.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={clause.topic.test(settings.legalText)}
                        onClick={() => insertLegalClause(clause.text)}
                        className="h-7 rounded-lg px-2.5 text-xs"
                      >
                        {clause.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </fieldset>
            </TabsContent>

            {/* TAB 3: Garantía predeterminada y papel */}
            <TabsContent value="warranty" className="pt-1">
              <fieldset disabled={fieldsLocked} className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">Garantía predeterminada del taller</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      La toman las órdenes nuevas y es la misma que se edita desde el formulario de reparación y desde Ajustes.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="receipt-warranty-months" className="text-xs font-semibold text-foreground">
                        Duración (meses, de {WARRANTY_MONTHS_MIN} a {WARRANTY_MONTHS_MAX})
                      </Label>
                      <Input
                        id="receipt-warranty-months"
                        type="number"
                        inputMode="numeric"
                        min={WARRANTY_MONTHS_MIN}
                        max={WARRANTY_MONTHS_MAX}
                        step={1}
                        value={monthsDraft}
                        onChange={(e) => {
                          setMonthsDraft(e.target.value)
                          if (e.target.value.trim() !== '') commitMonths(e.target.value)
                        }}
                        onBlur={(e) => commitMonths(e.target.value)}
                        className="h-9 rounded-xl text-xs font-bold"
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        {WARRANTY_MONTH_PRESETS.map((months) => (
                          <button
                            key={months}
                            type="button"
                            aria-pressed={settings.defaultWarrantyMonths === months}
                            onClick={() => commitMonths(String(months))}
                            className={cn(
                              'rounded-md border px-1.5 py-0.5 text-xs font-semibold transition-colors',
                              settings.defaultWarrantyMonths === months
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border text-muted-foreground hover:border-primary/40'
                            )}
                          >
                            {formatWarrantyMonths(months)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="receipt-warranty-type" className="text-xs font-semibold text-foreground">
                        Tipo de cobertura
                      </Label>
                      <Select
                        value={settings.defaultWarrantyType}
                        onValueChange={(value) => update('defaultWarrantyType', value as WarrantyType)}
                        disabled={fieldsLocked || settings.defaultWarrantyMonths === 0}
                      >
                        <SelectTrigger id="receipt-warranty-type" className="h-9 rounded-xl text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WARRANTY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{WARRANTY_TYPE_LABELS[type]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="receipt-warranty-notes" className="text-xs font-semibold text-foreground">
                      Notas de garantía predeterminadas
                    </Label>
                    <Textarea
                      id="receipt-warranty-notes"
                      rows={3}
                      maxLength={WARRANTY_NOTES_MAX}
                      value={settings.defaultWarrantyNotes}
                      onChange={(e) => update('defaultWarrantyNotes', e.target.value)}
                      disabled={fieldsLocked || settings.defaultWarrantyMonths === 0}
                      className="rounded-xl font-sans text-xs"
                      placeholder="Condiciones de garantía predeterminadas..."
                    />
                    <p className="text-right text-[10px] text-muted-foreground">
                      {settings.defaultWarrantyNotes.length}/{WARRANTY_NOTES_MAX}
                    </p>
                  </div>
                </div>
              </fieldset>
            </TabsContent>
          </Tabs>

          {preview}
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/30 p-3 sm:p-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestPrint}
              disabled={isLoading || isSaving}
              className="gap-1.5 rounded-xl text-xs font-bold"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Imprimir muestra</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={fieldsLocked}
              className="gap-1 rounded-xl text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Valores de fábrica</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isLoading || isSaving || !isDirty || !canEdit || Boolean(loadError)}
              className="gap-1.5 rounded-xl text-xs font-bold shadow-sm"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span>{isSaving ? 'Guardando…' : isDirty ? 'Guardar configuración' : 'Guardado'}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
