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
  Check 
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

  useEffect(() => {
    if (open) {
      setSettings(getReceiptSettings())
    }
  }, [open])

  const handleSave = () => {
    const updated = saveReceiptSettings(settings)
    toast.success('Configuración de comprobantes guardada correctamente')
    onSettingsSaved?.(updated)
    onOpenChange(false)
  }

  const handleReset = () => {
    setSettings(DEFAULT_RECEIPT_SETTINGS)
    toast.info('Se han restablecido los valores por defecto')
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

    saveReceiptSettings(settings)
    printRepairReceipt('customer', samplePayload, settings.paperFormat)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Cabecera del Modal */}
        <DialogHeader className="p-5 pb-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-300">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Personalizar Comprobante de Impresión
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-xs mt-0.5">
                Configura qué datos, términos legales y sellos de garantía se imprimen para el cliente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Pestañas de Configuración */}
        <div className="flex-1 overflow-y-auto p-5">
          <Tabs defaultValue="sections" className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
              <TabsTrigger value="sections" className="text-xs font-bold rounded-xl gap-1.5">
                <Sliders className="h-3.5 w-3.5" />
                <span>Secciones</span>
              </TabsTrigger>
              <TabsTrigger value="legal" className="text-xs font-bold rounded-xl gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>Términos Legales</span>
              </TabsTrigger>
              <TabsTrigger value="warranty" className="text-xs font-bold rounded-xl gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Garantía y Papel</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Secciones Activas / Visibles */}
            <TabsContent value="sections" className="space-y-3 pt-1">
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Elementos que aparecerán en el Comprobante
                </h4>

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
                  value={settings.legalText}
                  onChange={(e) => setSettings(prev => ({ ...prev, legalText: e.target.value }))}
                  className="rounded-xl font-mono text-xs leading-relaxed"
                  placeholder="Escribe aquí los términos legales..."
                />

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
                        onChange={(e) => setSettings(prev => ({ ...prev, defaultWarrantyType: e.target.value as any }))}
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
                      value={settings.defaultWarrantyNotes}
                      onChange={(e) => setSettings(prev => ({ ...prev, defaultWarrantyNotes: e.target.value }))}
                      className="rounded-xl text-xs font-sans"
                      placeholder="Condiciones de garantía predeterminadas..."
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Pie de Acciones */}
        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestPrint}
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
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold gap-1.5 shadow-sm"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Guardar Configuración</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
