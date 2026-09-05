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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
  saveReceiptSettings,
  printRepairReceipt,
  RepairPrintPayload
} from '@/lib/repair-receipt'

interface RepairReceiptSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettingsSaved?: (settings: RepairReceiptSettings) => void
}

export function RepairReceiptSettingsDialog({
  open,
  onOpenChange,
  onSettingsSaved
}: RepairReceiptSettingsDialogProps) {
  const [settings, setSettings] = useState<RepairReceiptSettings>(DEFAULT_RECEIPT_SETTINGS)
  const [savedSettings, setSavedSettings] = useState<RepairReceiptSettings>(DEFAULT_RECEIPT_SETTINGS)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [canEdit, setCanEdit] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [savedSettings, settings])
  const activeSections = useMemo(() => [
    settings.showLogo,
    settings.showDeliveryControl,
    settings.showFinancialBreakdown,
    settings.showAccessories,
    settings.showImei,
    settings.showCustomerSignature,
    settings.showHash,
  ].filter(Boolean).length, [settings])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (open) setIsLoading(true)
      setLoadError(null)
      try {
        const response = await fetch('/api/repairs/receipt-settings', { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo cargar la configuración.')
        if (!active) return
        const local = getReceiptSettings(payload.organizationId)
        const next = payload.persisted ? payload.data as RepairReceiptSettings : local
        saveReceiptSettings(next, payload.organizationId)
        setOrganizationId(payload.organizationId)
        setCanEdit(payload.canEdit !== false)
        setSavedSettings(next)
        if (open) setSettings(next)
      } catch (error) {
        if (!active) return
        const fallback = getReceiptSettings()
        if (open) {
          setSettings(fallback)
          setSavedSettings(fallback)
          setLoadError(error instanceof Error ? error.message : 'Se usará la última copia disponible en este equipo.')
        }
      } finally {
        if (active && open) setIsLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [open])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/repairs/receipt-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo guardar la configuración.')
      const updated = saveReceiptSettings(payload.data, payload.organizationId || organizationId)
      setSavedSettings(updated)
      toast.success('Configuración guardada para toda la organización')
      onSettingsSaved?.(updated)
      onOpenChange(false)
    } catch (error) {
      toast.error('No se guardaron los cambios', {
        description: error instanceof Error ? error.message : 'Intentá nuevamente.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setSettings({ ...DEFAULT_RECEIPT_SETTINGS })
    toast.info('Valores predeterminados cargados', { description: 'Presioná Guardar para aplicarlos a la organización.' })
  }

  const insertClause = (clause: string) => {
    setSettings(prev => ({
      ...prev,
      legalText: prev.legalText ? `${prev.legalText} ${clause}` : clause
    }))
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-[780px] flex flex-col p-0 overflow-hidden rounded-2xl border shadow-xl">
        {/* Cabecera del Modal */}
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

        <div className="flex items-center gap-2 border-b px-4 py-2 text-[11px] sm:px-5">
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : loadError ? <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> : <Cloud className="h-3.5 w-3.5 text-emerald-600" />}
          <span className={loadError ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}>
            {isLoading ? 'Sincronizando configuración…' : loadError ? `${loadError} Podés revisar, pero necesitás conexión para guardar.` : isDirty ? 'Cambios pendientes de guardar' : 'Configuración sincronizada'}
          </span>
        </div>

        {/* Pestañas de Configuración */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {!canEdit && (
            <div className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Podés revisar e imprimir una muestra. Solo un administrador puede cambiar esta configuración.</p>
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
              <p className="mt-0.5 text-sm font-bold">{settings.defaultWarrantyMonths} meses</p>
            </div>
          </div>
          <fieldset disabled={!canEdit || isLoading || isSaving}>
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

            {/* TAB 1: Secciones Activas / Visibles */}
            <TabsContent value="sections" className="space-y-3 pt-1">
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 p-4 space-y-4">
                {/* 0. Logo vs Solo Nombre del Local */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                      <span>🖼️ Logo de la Empresa en el Encabezado</span>
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {settings.showLogo 
                        ? 'Activado: Imprime la imagen del logo y el nombre de la empresa.' 
                        : 'Desactivado: Imprime SOLO el nombre del local en texto grande y nítido (ideal para térmicas sin logo).'}
                    </p>
                  </div>
                  <Switch
                    aria-label="Mostrar logo de la empresa"
                    checked={settings.showLogo}
                    onCheckedChange={(val) => setSettings(prev => ({ ...prev, showLogo: val }))}
                  />
                </div>

                {/* 1. Control de Entrega y Activación de Garantía */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-indigo-50/50 dark:bg-indigo-950/20">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <span>🛡️ Control de Entrega y Activación de Garantía</span>
                    </Label>
                    <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/70 leading-snug">
                      Imprime el recuadro inferior con fecha de entrega, entregado por y firmas (Taller + Cliente) para que el mismo papel sirva de garantía al retirar.
                    </p>
                  </div>
                  <Switch
                    aria-label="Mostrar control de entrega y garantía"
                    checked={settings.showDeliveryControl}
                    onCheckedChange={(val) => setSettings(prev => ({ ...prev, showDeliveryControl: val }))}
                  />
                </div>

                {/* 2. Anticipo y Saldo Pendiente */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">
                      💰 Resumen Financiero (Presupuesto, Anticipo/Seña y Saldo)
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Desglosa el presupuesto total, resta la seña cobrada y destaca el saldo a pagar.
                    </p>
                  </div>
                  <Switch
                    aria-label="Mostrar resumen financiero"
                    checked={settings.showFinancialBreakdown}
                    onCheckedChange={(val) => setSettings(prev => ({ ...prev, showFinancialBreakdown: val }))}
                  />
                </div>

                {/* 3. Accesorios Recibidos */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">
                      🔌 Accesorios Recibidos
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Muestra cargador, funda, SIM o memorias dejadas junto con el equipo.
                    </p>
                  </div>
                  <Switch
                    aria-label="Mostrar accesorios recibidos"
                    checked={settings.showAccessories}
                    onCheckedChange={(val) => setSettings(prev => ({ ...prev, showAccessories: val }))}
                  />
                </div>

                {/* 4. IMEI / Número de Serie */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">
                      📱 IMEI / N° de Serie del Dispositivo
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Identificador único del hardware recibido.
                    </p>
                  </div>
                  <Switch
                    aria-label="Mostrar IMEI o número de serie"
                    checked={settings.showImei}
                    onCheckedChange={(val) => setSettings(prev => ({ ...prev, showImei: val }))}
                  />
                </div>

                {/* 5. Firma del Cliente al Ingreso */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">
                      ✍️ Recuadro de Firma del Cliente (Recepción Inicial)
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Espacio para que el cliente firme la aceptación de revisión al dejar el equipo.
                    </p>
                  </div>
                  <Switch
                    aria-label="Mostrar firma del cliente"
                    checked={settings.showCustomerSignature}
                    onCheckedChange={(val) => setSettings(prev => ({ ...prev, showCustomerSignature: val }))}
                  />
                </div>

                {/* 6. Hash de Verificación */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">
                      🔐 Código Hash de Seguridad y Verificación
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Código criptográfico impreso al pie del ticket para evitar adulteraciones.
                    </p>
                  </div>
                  <Switch
                    aria-label="Mostrar código de verificación"
                    checked={settings.showHash}
                    onCheckedChange={(val) => setSettings(prev => ({ ...prev, showHash: val }))}
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Términos y Condiciones Legales */}
            <TabsContent value="legal" className="space-y-3 pt-1">
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 p-4 space-y-3">
                <div>
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Texto Legal y Deslinde de Responsabilidad
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Este texto se imprime en letra pequeña al pie del ticket que el cliente firma.
                  </p>
                </div>

                <Textarea
                  rows={4}
                  maxLength={3000}
                  value={settings.legalText}
                  onChange={(e) => setSettings(prev => ({ ...prev, legalText: e.target.value }))}
                  className="rounded-xl font-mono text-xs leading-relaxed"
                  placeholder="Escribe aquí los términos legales..."
                />
                <p className="text-right text-[10px] text-muted-foreground">{settings.legalText.length}/3000</p>

                {/* Píldoras de Cláusulas Rápidas */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Insertar Cláusula Recomendada (1 Clic):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertClause('La empresa no se responsabiliza por pérdida o daño de información; se recomienda respaldo previo.')}
                      className="text-[11px] h-7 px-2.5 rounded-lg border-slate-300 dark:border-slate-700 hover:bg-slate-100"
                    >
                      + Pérdida de Datos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertClause('Pasados los 90 días de la notificación de retiro, el equipo se considerará en abandono legal.')}
                      className="text-[11px] h-7 px-2.5 rounded-lg border-slate-300 dark:border-slate-700 hover:bg-slate-100"
                    >
                      + 90 Días Abandono
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertClause('Es indispensable presentar este comprobante físico para el retiro del equipo.')}
                      className="text-[11px] h-7 px-2.5 rounded-lg border-slate-300 dark:border-slate-700 hover:bg-slate-100"
                    >
                      + Presentación Obligatoria
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertClause('La garantía no cubre daños por golpes, fracturas o contacto con líquidos posteriores a la entrega.')}
                      className="text-[11px] h-7 px-2.5 rounded-lg border-slate-300 dark:border-slate-700 hover:bg-slate-100"
                    >
                      + Exclusión Humedad/Golpes
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: Garantía Predeterminada y Papel */}
            <TabsContent value="warranty" className="space-y-3 pt-1">
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 p-4 space-y-4">
                {/* Formato de Papel */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Formato de Impresión Predeterminado
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      aria-pressed={settings.paperFormat === '80mm'}
                      onClick={() => setSettings(prev => ({ ...prev, paperFormat: '80mm' }))}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        settings.paperFormat === '80mm'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 font-bold text-indigo-700 dark:text-indigo-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base block mb-0.5">🧾</span>
                      <span className="text-xs font-bold block">80mm</span>
                      <span className="text-[10px] text-slate-500 block">Térmica Estándar</span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={settings.paperFormat === '58mm'}
                      onClick={() => setSettings(prev => ({ ...prev, paperFormat: '58mm' }))}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        settings.paperFormat === '58mm'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 font-bold text-indigo-700 dark:text-indigo-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base block mb-0.5">🏷️</span>
                      <span className="text-xs font-bold block">58mm</span>
                      <span className="text-[10px] text-slate-500 block">Térmica Mini</span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={settings.paperFormat === 'A4'}
                      onClick={() => setSettings(prev => ({ ...prev, paperFormat: 'A4' }))}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        settings.paperFormat === 'A4'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 font-bold text-indigo-700 dark:text-indigo-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base block mb-0.5">📄</span>
                      <span className="text-xs font-bold block">A4</span>
                      <span className="text-[10px] text-slate-500 block">Hoja Completa</span>
                    </button>
                  </div>
                </div>

                {/* Configuración del Logo para Impresora Térmica */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block">
                    🖼️ Logo de la Empresa (Optimización Térmica)
                  </Label>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="space-y-0.5 pr-2">
                      <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">
                        Mostrar Logo en el Comprobante
                      </Label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Imprime el logo de tu empresa en la parte superior del encabezado.
                      </p>
                    </div>
                    <Switch
                      aria-label="Mostrar logo en el comprobante"
                      checked={settings.showLogo}
                      onCheckedChange={(val) => setSettings(prev => ({ ...prev, showLogo: val }))}
                    />
                  </div>

                  {settings.showLogo && (
                    <>
                      <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
                        <div className="space-y-0.5 pr-2">
                          <Label className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1">
                            <span>🖤 Modo Monocromático de Alto Contraste</span>
                          </Label>
                          <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-snug">
                            Convierte automáticamente logos a color en trazos negros nítidos sin sombras grises difusas, ideal para cabezales de impresoras térmicas.
                          </p>
                        </div>
                        <Switch
                          aria-label="Usar logo monocromático"
                          checked={settings.monochromeLogo}
                          onCheckedChange={(val) => setSettings(prev => ({ ...prev, monochromeLogo: val }))}
                        />
                      </div>

                      <div className="space-y-1.5 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Altura del Logo en el Ticket:
                          </Label>
                          <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {settings.logoHeight || 48}px
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {[
                            { label: 'Compacto', val: 36 },
                            { label: 'Estándar', val: 48 },
                            { label: 'Grande', val: 60 }
                          ].map(item => (
                            <button
                              key={item.val}
                              type="button"
                              aria-pressed={(settings.logoHeight || 48) === item.val}
                              onClick={() => setSettings(prev => ({ ...prev, logoHeight: item.val }))}
                              className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                (settings.logoHeight || 48) === item.val
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              {item.label} ({item.val}px)
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Garantía por defecto */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Duración por Defecto (Meses)
                      </Label>
                      <input
                        type="number"
                        min="0"
                        max="36"
                        value={settings.defaultWarrantyMonths}
                        onChange={(e) => setSettings(prev => ({ ...prev, defaultWarrantyMonths: parseInt(e.target.value) || 0 }))}
                        className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Tipo de Cobertura
                      </Label>
                      <select
                        value={settings.defaultWarrantyType}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          defaultWarrantyType: e.target.value as RepairReceiptSettings['defaultWarrantyType'],
                        }))}
                        className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold"
                      >
                        <option value="full">Completa (Mano de obra y repuestos)</option>
                        <option value="labor">Solo mano de obra</option>
                        <option value="parts">Solo repuestos</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Notas de Garantía Predeterminadas
                    </Label>
                    <Textarea
                      rows={2}
                      maxLength={1000}
                      value={settings.defaultWarrantyNotes}
                      onChange={(e) => setSettings(prev => ({ ...prev, defaultWarrantyNotes: e.target.value }))}
                      className="rounded-xl text-xs font-sans"
                      placeholder="Condiciones de garantía predeterminadas..."
                    />
                    <p className="text-right text-[10px] text-muted-foreground">{settings.defaultWarrantyNotes.length}/1000</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          </fieldset>
        </div>

        {/* Pie de Acciones */}
        <DialogFooter className="border-t bg-muted/30 p-3 sm:p-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestPrint}
              disabled={isLoading || isSaving}
              className="rounded-xl text-xs font-bold gap-1.5 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Muestra</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isLoading || isSaving || !canEdit}
              className="rounded-xl text-xs text-slate-500 hover:text-slate-800 gap-1"
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
              disabled={isLoading || isSaving || !isDirty || !canEdit}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold gap-1.5 shadow-sm"
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
