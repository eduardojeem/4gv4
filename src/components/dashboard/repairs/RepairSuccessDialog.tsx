'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle2, 
  Printer, 
  MessageSquare, 
  Layers, 
  FileText, 
  FileCheck2, 
  Smartphone
} from 'lucide-react'
import { 
  RepairPrintPayload, 
  printRepairReceipt, 
  openRepairWhatsApp,
  getReceiptSettings,
  REPAIR_RECEIPT_SETTINGS_EVENT,
} from '@/lib/repair-receipt'
import { formatCurrency } from '@/lib/currency'
import { RepairReceiptSettingsDialog } from '@/components/dashboard/repairs/RepairReceiptSettingsDialog'

interface RepairSuccessDialogProps {
  open: boolean
  onClose: () => void
  data: RepairPrintPayload | null
}

export function RepairSuccessDialog({
  open,
  onClose,
  data
}: RepairSuccessDialogProps) {
  const [paperFormat, setPaperFormat] = useState<'80mm' | '58mm' | 'A4'>('80mm')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const syncPaper = () => setPaperFormat(getReceiptSettings().paperFormat)
    syncPaper()
    window.addEventListener(REPAIR_RECEIPT_SETTINGS_EVENT, syncPaper)
    return () => window.removeEventListener(REPAIR_RECEIPT_SETTINGS_EVENT, syncPaper)
  }, [])

  const handleFormatChange = (format: '80mm' | '58mm' | 'A4') => {
    setPaperFormat(format)
  }

  // El corte va despues de TODOS los hooks: el dialogo vive montado con `data`
  // en null y recibe el payload recien cuando la reparacion se creo. Declarar un
  // hook debajo de este return cambia la cantidad de hooks entre un render y el
  // siguiente, y React tira "Rendered more hooks than during the previous
  // render" justo al terminar de cargar la reparacion, que es cuando hay que
  // ofrecer la impresion.
  if (!data) return null

  const mainDevice = data.devices[0]
  const totalCost = data.finalCost ?? data.estimatedCost ?? data.devices.reduce((acc, d) => acc + (d.finalCost ?? d.estimatedCost ?? 0), 0)
  const paidAmount = data.paidAmount ?? data.deposit ?? data.devices.reduce((acc, d) => acc + (d.paidAmount ?? d.deposit ?? 0), 0)
  const pendingBalance = Math.max(0, totalCost - paidAmount)

  const handlePrintBoth = () => {
    printRepairReceipt('customer', data, paperFormat)
    setTimeout(() => {
      printRepairReceipt('technician', data, paperFormat)
    }, 600)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl">
          {/* Encabezado con Éxito */}
          <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md mb-3 shadow-inner">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>

            <DialogTitle className="text-xl font-bold text-white tracking-tight">
              ¡Reparación Ingresada con Éxito!
            </DialogTitle>
            
            <DialogDescription className="text-emerald-100 text-xs mt-1">
              {data.ticketNumber ? `Orden N° ${data.ticketNumber}` : 'Orden registrada'} • {data.customer.name}
            </DialogDescription>

            {/* Tarjeta Resumen Rápida */}
            <div className="mt-4 p-3 rounded-2xl bg-black/20 backdrop-blur-md border border-white/15 flex items-center justify-between text-left">
              <div className="min-w-0 flex items-center gap-2">
                <div className="p-2 rounded-xl bg-white/15 shrink-0">
                  <Smartphone className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs truncate text-white">
                    {mainDevice ? `${mainDevice.brand} ${mainDevice.model}` : 'Equipo en taller'}
                  </p>
                  <p className="text-[11px] text-emerald-100 truncate">
                    {mainDevice?.issue || 'Revisión técnica'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[10px] text-emerald-200 uppercase font-semibold">
                  {paidAmount > 0 ? 'Saldo' : 'Total'}
                </p>
                <p className="text-sm font-black text-white">
                  {formatCurrency(paidAmount > 0 ? pendingBalance : totalCost)}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Selector de Papel */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 pl-2">
                Formato de Papel:
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleFormatChange('80mm')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    paperFormat === '80mm'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  🧾 80mm
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange('58mm')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    paperFormat === '58mm'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  🏷️ 58mm
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange('A4')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    paperFormat === 'A4'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  📄 A4
                </button>
              </div>
            </div>

            {/* Acciones Principales */}
            <div className="space-y-2">
              {/* Imprimir Ambos (Atajo Maestro) */}
              <Button 
                className="w-full h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 shadow-md dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                onClick={handlePrintBoth}
              >
                <Layers className="h-4 w-4" />
                <span>🖨️ Imprimir Ambos (Cliente + Ficha Técnica)</span>
              </Button>

              <div className="grid grid-cols-2 gap-2">
                {/* Comprobante Cliente */}
                <Button 
                  variant="outline"
                  className="h-11 rounded-2xl border-slate-300 dark:border-slate-700 font-bold gap-2 text-xs hover:border-slate-400" 
                  onClick={() => printRepairReceipt('customer', data, paperFormat)}
                >
                  <Printer className="h-4 w-4 text-emerald-600" />
                  <span>Ticket Cliente</span>
                </Button>
                
                {/* WhatsApp Directo */}
                <Button 
                  variant="outline"
                  className="h-11 rounded-2xl border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/20 font-bold gap-2 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80"
                  onClick={() => openRepairWhatsApp(data)}
                >
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <span>Enviar WhatsApp</span>
                </Button>
              </div>

              {/* Opciones de Ficha Técnica */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Fichas para el Taller / Técnico:
                </p>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-xl font-semibold text-xs gap-1.5"
                    onClick={() => printRepairReceipt('technician', data, paperFormat)}
                  >
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    <span>Ficha Simple</span>
                  </Button>

                  <Button 
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-xl border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 font-semibold text-xs gap-1.5 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60"
                    onClick={() => printRepairReceipt('technician_detailed', data, paperFormat)}
                  >
                    <FileCheck2 className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Ficha Completa (PIN/Check)</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 gap-1.5"
            >
              <span>⚙️ Configurar Comprobante</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="rounded-xl text-xs font-semibold"
              onClick={onClose}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RepairReceiptSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        onSettingsSaved={(newSettings) => {
          setPaperFormat(newSettings.paperFormat)
        }}
      />
    </>
  )
}
