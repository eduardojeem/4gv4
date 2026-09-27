'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
  Sliders,
  RotateCcw,
  Check,
  Loader2,
  Cloud,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  RepairReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS,
  getReceiptSettings,
  patchReceiptSettings,
  printRepairReceipt,
  refreshReceiptSettings,
  RepairPrintPayload
} from '@/lib/repair-receipt'
import { diffRepairReceiptSettings, RECEIPT_LEGAL_TEXT_MAX } from '@/lib/repairs/receipt-settings'
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
}

const PAPER_OPTIONS: Array<{ value: RepairReceiptSettings['paperFormat']; icon: string; label: string; hint: string }> = [
  { value: '80mm', icon: '🧾', label: '80mm', hint: 'Térmica estándar' },
  { value: '58mm', icon: '🏷️', label: '58mm', hint: 'Térmica mini' },
  { value: 'A4', icon: '📄', label: 'A4', hint: 'Hoja completa' },
]

const LOGO_HEIGHTS = [
  { label: 'Compacto', value: 36 },
  { label: 'Estándar', value: 48 },
  { label: 'Grande', value: 60 },
]

const LEGAL_CLAUSES = [
  { label: '+ Pérdida de datos', text: 'La empresa no se responsabiliza por pérdida o daño de información; se recomienda respaldo previo.' },
  { label: '+ 90 días de abandono', text: 'Pasados los 90 días de la notificación de retiro, el equipo se considerará en abandono legal.' },
  { label: '+ Presentación obligatoria', text: 'Es indispensable presentar este comprobante físico para el retiro del equipo.' },
  { label: '+ Exclusión humedad/golpes', text: 'La garantía no cubre daños por golpes, fracturas o contacto con líquidos posteriores a la entrega.' },
]

export function RepairReceiptSettingsDialog({
  open,
  onOpenChange,
  onSettingsSaved
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

  const changes = useMemo(() => diffRepairReceiptSettings(savedSettings, settings), [savedSettings, settings])
  const isDirty = Object.keys(changes).length > 0
  const activeSections = useMemo(() => [
    settings.showLogo,
    settings.showDeliveryControl,
    settings.showFinancialBreakdown,
    settings.showAccessories,
    settings.showImei,
    settings.showCustomerSignature,
    settings.showHash,
  ].filter(Boolean).length, [settings])
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
    toast.success('Configuración guardada para toda la organización')
    onSettingsSaved?.(result.settings)
    onOpenChange(false)
  }

  const handleReset = () => {
    setSettings({ ...DEFAULT_RECEIPT_SETTINGS })
    setMonthsDraft(String(DEFAULT_RECEIPT_SETTINGS.defaultWarrantyMonths))
    toast.info('Valores predeterminados cargados', { description: 'Presioná Guardar para aplicarlos a la organización.' })
  }

  const insertLegalClause = (clause: string) => {
    setSettings((prev) => {
      if (prev.legalText.includes(clause)) return prev
      const legalText = prev.legalText ? `${prev.legalText} ${clause}` : clause
      return legalText.length > RECEIPT_LEGAL_TEXT_MAX ? prev : { ...prev, legalText }
    })
  }

  const commitMonths = (value: string) => {
    const months = clampWarrantyMonths(value, settings.defaultWarrantyMonths)
    update('defaultWarrantyMonths', months)
    setMonthsDraft(String(months))
  }

  const handleTestPrint = () => {
    const samplePayload: RepairPrintPayload = {
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
      company: {
        name: 'Servicio Técnico Especializado',
        phone: '+595 21 555-0123',
        address: 'Palma 456 c/ 14 de Mayo, Asunción'
      }
    }

    printRepairReceipt('customer', samplePayload, settings.paperFormat, settings)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty && !isSaving) {
      const discard = window.confirm('Tenés cambios sin guardar. ¿Querés descartarlos?')
      if (!discard) return
    }
    onOpenChange(nextOpen)
  }

  const toggleRow = (
    id: keyof RepairReceiptSettings,
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
      <div className="space-y-0.5 pr-2">
        <Label htmlFor={`receipt-${String(id)}`} className="text-xs font-bold text-foreground">
          {title}
        </Label>
        <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={`receipt-${String(id)}`}
        checked={checked}
        onCheckedChange={(val) => update(id, val as never)}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-[780px] flex flex-col p-0 overflow-hidden rounded-2xl border shadow-xl">
        <DialogHeader className="border-b bg-muted/30 p-4 pr-12 sm:p-5 sm:pr-12">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold sm:text-lg">
                Personalizar Comprobante de Impresión
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Esta configuración se comparte con todos los usuarios de la organización.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-4 py-2 text-[11px] sm:px-5" role="status">
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : loadError ? <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> : <Cloud className="h-3.5 w-3.5 text-emerald-600" />}
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
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Podés revisar todas las pestañas e imprimir una muestra. Solo un administrador puede cambiar esta configuración.</p>
            </div>
          )}
          <div className="mb-4 grid grid-cols-3 gap-2" aria-label="Resumen de configuración">
            <div className="rounded-lg border bg-card p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Papel</p>
              <p className="mt-0.5 text-sm font-bold">{settings.paperFormat}</p>
            </div>
            <div className="rounded-lg border bg-card p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Secciones</p>
              <p className="mt-0.5 text-sm font-bold">{activeSections} activas</p>
            </div>
            <div className="rounded-lg border bg-card p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Garantía</p>
              <p className="mt-0.5 text-sm font-bold">{formatWarrantyMonths(settings.defaultWarrantyMonths)}</p>
            </div>
          </div>

          {/* Las pestañas quedan fuera de los campos bloqueados. Antes todo iba
              dentro de un fieldset deshabilitado, que también deshabilita los
              botones de las pestañas: quien no era administrador solo podía ver
              la primera. */}
          <Tabs defaultValue="sections" className="space-y-4">
            <TabsList className="grid h-auto grid-cols-3 w-full bg-muted p-1 rounded-xl">
              <TabsTrigger value="sections" className="text-xs font-bold rounded-xl gap-1.5">
                <Sliders className="h-3.5 w-3.5" />
                <span>Secciones</span>
              </TabsTrigger>
              <TabsTrigger value="legal" className="text-xs font-bold rounded-xl gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Términos legales</span><span className="sm:hidden">Términos</span>
              </TabsTrigger>
              <TabsTrigger value="warranty" className="text-xs font-bold rounded-xl gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Garantía y papel</span><span className="sm:hidden">Garantía</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Secciones */}
            <TabsContent value="sections" className="pt-1">
              <fieldset disabled={fieldsLocked} className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
                {/* El logo y sus opciones, juntos. Estaban repartidos: el mismo
                    interruptor aparecía acá y otra vez en «Garantía y papel». */}
                <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5 pr-2">
                      <Label htmlFor="receipt-showLogo" className="text-xs font-bold text-foreground">
                        🖼️ Logo de la empresa en el encabezado
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        {settings.showLogo
                          ? 'Imprime el logo y el nombre de la empresa.'
                          : 'Imprime solo el nombre del local en texto grande (ideal para térmicas sin logo).'}
                      </p>
                    </div>
                    <Switch
                      id="receipt-showLogo"
                      checked={settings.showLogo}
                      onCheckedChange={(val) => update('showLogo', val)}
                    />
                  </div>

                  {settings.showLogo && (
                    <div className="space-y-3 border-t border-border pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-0.5 pr-2">
                          <Label htmlFor="receipt-monochromeLogo" className="text-xs font-semibold text-foreground">
                            Modo monocromático de alto contraste
                          </Label>
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            Convierte logos a color en trazos negros nítidos, ideal para impresoras térmicas.
                          </p>
                        </div>
                        <Switch
                          id="receipt-monochromeLogo"
                          checked={settings.monochromeLogo}
                          onCheckedChange={(val) => update('monochromeLogo', val)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span id="receipt-logo-height" className="text-xs font-semibold text-foreground">Altura del logo</span>
                          <span className="font-mono text-xs font-bold text-primary">{settings.logoHeight}px</span>
                        </div>
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
                              {item.label} ({item.value}px)
                            </button>
                          ))}
                        </div>
                        {!LOGO_HEIGHTS.some((item) => item.value === settings.logoHeight) && (
                          <p className="text-[11px] text-muted-foreground">
                            La altura guardada ({settings.logoHeight}px) no es una de las opciones; elegí una para cambiarla.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {toggleRow('showDeliveryControl', '🛡️ Control de entrega y activación de garantía', 'Imprime el recuadro inferior con fecha de entrega, entregado por y firmas (taller y cliente) para que el mismo papel sirva de garantía al retirar.', settings.showDeliveryControl, 'accent')}
                {toggleRow('showFinancialBreakdown', '💰 Resumen financiero (presupuesto, seña y saldo)', 'Desglosa el presupuesto total, resta la seña cobrada y destaca el saldo a pagar.', settings.showFinancialBreakdown)}
                {toggleRow('showAccessories', '🔌 Accesorios recibidos', 'Muestra cargador, funda, SIM o memorias dejadas junto con el equipo.', settings.showAccessories)}
                {toggleRow('showImei', '📱 IMEI / N° de serie del dispositivo', 'Identificador único del hardware recibido.', settings.showImei)}
                {toggleRow('showCustomerSignature', '✍️ Firma del cliente (recepción)', 'Espacio para que el cliente firme la aceptación de revisión al dejar el equipo.', settings.showCustomerSignature)}
                {toggleRow('showHash', '🔐 Código de verificación', 'Código impreso al pie del ticket para validar que el comprobante es auténtico.', settings.showHash)}
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
                    Se imprime en letra pequeña al pie del ticket que el cliente firma.
                  </p>
                </div>

                <Textarea
                  id="receipt-legalText"
                  rows={4}
                  maxLength={RECEIPT_LEGAL_TEXT_MAX}
                  value={settings.legalText}
                  onChange={(e) => update('legalText', e.target.value)}
                  className="rounded-xl font-mono text-xs leading-relaxed"
                  placeholder="Escribí acá los términos legales..."
                />
                <p className="text-right text-[10px] text-muted-foreground">{settings.legalText.length}/{RECEIPT_LEGAL_TEXT_MAX}</p>

                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Insertar cláusula recomendada
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {LEGAL_CLAUSES.map((clause) => (
                      <Button
                        key={clause.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={settings.legalText.includes(clause.text)}
                        onClick={() => insertLegalClause(clause.text)}
                        className="h-7 rounded-lg px-2.5 text-[11px]"
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
                <div className="space-y-2">
                  <span id="receipt-paper" className="text-xs font-bold text-foreground">Formato de impresión predeterminado</span>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="receipt-paper">
                    {PAPER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={settings.paperFormat === option.value}
                        onClick={() => update('paperFormat', option.value)}
                        className={cn(
                          'rounded-xl border p-3 text-center transition-colors',
                          settings.paperFormat === option.value
                            ? 'border-primary bg-primary/10 font-bold text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        )}
                      >
                        <span className="mb-0.5 block text-base" aria-hidden="true">{option.icon}</span>
                        <span className="block text-xs font-bold">{option.label}</span>
                        <span className="block text-[10px] text-muted-foreground">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">Garantía predeterminada del taller</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
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
                              'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
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
              <Printer className="h-3.5 w-3.5" />
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
              <RotateCcw className="h-3 w-3" />
              <span>Restablecer</span>
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
