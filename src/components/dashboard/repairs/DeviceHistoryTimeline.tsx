'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Repair, RepairNote } from '@/types/repairs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Shield, ShieldCheck, ShieldAlert, CheckCircle2, User,
  History, Smartphone, FileText, Plus, Loader2, ChevronRight,
  Sparkles
} from 'lucide-react'
import { statusConfig } from '@/config/repair-constants'
import { formatCurrency } from '@/lib/currency'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { getWarrantyStatus, getDaysRemaining, formatWarrantyDuration, formatWarrantyExpiration } from '@/lib/warranty-utils'
import { useRepairs } from '@/contexts/RepairsContext'
import { toast } from 'sonner'
import { STATUS_META, type CaseStatus } from '@/components/dashboard/after-sales/after-sales-meta'

interface WarrantyCaseRow {
  id: string
  case_number: string | null
  status: CaseStatus
  reason?: string
  notes?: string | null
  created_at?: string
  generated_repair_id?: string | null
  generated_repair?: { ticket_number: string | null } | null
}

interface DeviceHistoryTimelineProps {
  repair: Repair
  onSelectPreviousRepair?: (repair: Repair) => void
  onOpenWarrantyModal?: () => void
  onNoteAdded?: (newNotes: RepairNote[]) => void
}

export function DeviceHistoryTimeline({
  repair,
  onSelectPreviousRepair,
  onOpenWarrantyModal,
  onNoteAdded
}: DeviceHistoryTimelineProps) {
  const { repairs } = useRepairs()
  const [warrantyCases, setWarrantyCases] = useState<WarrantyCaseRow[]>([])
  const [activeTab, setActiveTab] = useState<'timeline' | 'previous_visits' | 'notes'>('timeline')

  // Nueva nota técnica
  const [newNoteText, setNewNoteText] = useState('')
  const [authorName, setAuthorName] = useState('Técnico')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [localNotes, setLocalNotes] = useState<RepairNote[]>(repair.notes || [])

  useEffect(() => {
    setLocalNotes(repair.notes || [])
  }, [repair.notes])

  // Cargar casos de garantía de posventa asociados a esta reparación
  useEffect(() => {
    let isMounted = true
    async function loadCases() {
      try {
        const res = await fetch(`/api/after-sales?repair_id=${repair.id}&limit=10`)
        if (!res.ok) return
        const data = await res.json()
        if (data?.success && isMounted) {
          setWarrantyCases((data.data as WarrantyCaseRow[]) || [])
        }
      } catch (err) {
        console.error('Error cargando casos de garantia:', err)
      }
    }
    loadCases()
    return () => { isMounted = false }
  }, [repair.id])

  // Buscar reparaciones previas del mismo celular (mismo cliente y mismo modelo/dispositivo, excluyendo la actual)
  const previousRepairs = useMemo(() => {
    if (!repairs || repairs.length === 0) return []

    const currentSerial = (repair.serialNumber || repair.imei || '').trim().toLowerCase()
    const currentCustomer = (repair.customer?.name || '').trim().toLowerCase()
    const currentDevice = (repair.device || '').trim().toLowerCase()
    const currentModel = (repair.model || '').trim().toLowerCase()
    const currentId = repair.id

    return repairs.filter((r) => {
      if (r.id === currentId) return false

      const rSerial = (r.serialNumber || r.imei || '').trim().toLowerCase()

      // 1. Coincidencia exacta por IMEI / Número de serie
      if (currentSerial && rSerial && currentSerial === rSerial) {
        return true
      }

      // 2. Coincidencia secundaria por cliente + dispositivo/modelo
      const rCustomer = (r.customer?.name || '').trim().toLowerCase()
      const rDevice = (r.device || '').trim().toLowerCase()
      const rModel = (r.model || '').trim().toLowerCase()

      const customerMatch = currentCustomer && rCustomer && (currentCustomer === rCustomer || r.customer?.id === repair.customer?.id)
      const deviceMatch = (currentModel && rModel && currentModel === rModel) || (currentDevice && rDevice && currentDevice === rDevice)

      return customerMatch && deviceMatch
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [repairs, repair])

  // Guardar nueva nota técnica
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNoteText.trim()) {
      toast.error('Escribe el contenido de la nota')
      return
    }

    setIsSavingNote(true)
    try {
      const newNote: RepairNote = {
        id: Date.now(),
        text: newNoteText.trim(),
        author: authorName.trim() || 'Técnico',
        timestamp: new Date().toISOString(),
        isInternal: true
      }

      const updatedNotes = [...localNotes, newNote]

      const res = await fetch(`/api/repairs/${repair.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: updatedNotes })
      })

      if (!res.ok) {
        throw new Error('Error al guardar la nota')
      }

      setLocalNotes(updatedNotes)
      setNewNoteText('')
      onNoteAdded?.(updatedNotes)
      toast.success('Nota técnica añadida a la bitácora')
    } catch {
      toast.error('No se pudo guardar la nota')
    } finally {
      setIsSavingNote(false)
    }
  }

  // Métricas de garantía de la reparación actual
  const warrantyStatus = getWarrantyStatus(repair.warrantyExpiresAt)
  const daysRemaining = getDaysRemaining(repair.warrantyExpiresAt)
  const hasWarranty = repair.warrantyExpiresAt || (repair.warrantyMonths && repair.warrantyMonths > 0)

  return (
    <div className="space-y-4">
      {/* Selector de Vistas del Historial */}
      <div className="flex items-center gap-2 border-b pb-2 flex-wrap">
        <Button
          type="button"
          variant={activeTab === 'timeline' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('timeline')}
          className="h-8 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
        >
          <History className="h-3.5 w-3.5" />
          <span>Línea de Tiempo del Servicio</span>
        </Button>

        <Button
          type="button"
          variant={activeTab === 'previous_visits' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('previous_visits')}
          className="h-8 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>Visitas Anteriores del Celular</span>
          {previousRepairs.length > 0 && (
            <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4">
              {previousRepairs.length}
            </Badge>
          )}
        </Button>

        <Button
          type="button"
          variant={activeTab === 'notes' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('notes')}
          className="h-8 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Bitácora Técnica ({localNotes.length})</span>
        </Button>
      </div>

      {/* ─── PESTAÑA 1: LÍNEA DE TIEMPO DEL SERVICIO ACTUAL ─── */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          {/* Banner de Estado de Garantía */}
          {hasWarranty && (
            <div className={cn(
              "p-3.5 rounded-2xl border flex items-start justify-between gap-3 shadow-xs",
              warrantyStatus === 'active'
                ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
                : warrantyStatus === 'expiring'
                ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60"
                : "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-xl text-white shrink-0 shadow-xs",
                  warrantyStatus === 'active' ? "bg-emerald-600" : warrantyStatus === 'expiring' ? "bg-amber-600" : "bg-rose-600"
                )}>
                  {warrantyStatus === 'active' ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {warrantyStatus === 'active' ? 'Garantía Vigente' : warrantyStatus === 'expiring' ? 'Garantía por Vencer' : 'Garantía Expirada'}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {formatWarrantyDuration(repair.warrantyMonths)}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {repair.warrantyExpiresAt ? (
                      <>Vence el <strong>{formatWarrantyExpiration(repair.warrantyExpiresAt)}</strong> ({daysRemaining > 0 ? `${daysRemaining} días restantes` : 'vencida'})</>
                    ) : (
                      'Iniciará su cómputo al momento de entregar el equipo al cliente.'
                    )}
                  </p>
                </div>
              </div>

              {repair.status === 'entregado' && onOpenWarrantyModal && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onOpenWarrantyModal}
                  className="text-xs h-7 gap-1 font-bold border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 hover:bg-amber-100 shrink-0"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Procesar Garantía
                </Button>
              )}
            </div>
          )}

          {/* Timeline de Hitos */}
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            
            {/* 1. Ingreso / Recepción */}
            <div className="relative">
              <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                1
              </div>
              <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    📥 Recepción e Ingreso al Taller
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {format(new Date(repair.createdAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                  </span>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  <p><strong>Problema declarado:</strong> {repair.issue}</p>
                  <p className="text-muted-foreground"><strong>Presupuesto inicial estimado:</strong> {formatCurrency(repair.estimatedCost)}</p>
                  {repair.technician && (
                    <p className="text-muted-foreground"><strong>Técnico inicial asignado:</strong> {repair.technician.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Repuestos y Diagnóstico Técnico */}
            <div className="relative">
              <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                2
              </div>
              <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5 shadow-xs space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    🔬 Diagnóstico & Repuestos Utilizados
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {repair.parts?.length || 0} piezas
                  </Badge>
                </div>
                
                {repair.parts && repair.parts.length > 0 ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="divide-y border rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-950/40">
                      {repair.parts.map((p, idx) => (
                        <div key={idx} className="flex justify-between p-2">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {p.name} {p.quantity > 1 && `(x${p.quantity})`}
                          </span>
                          <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                            {formatCurrency(p.cost * (p.quantity || 1))}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Mano de obra técnica: <strong>{formatCurrency(repair.laborCost || 0)}</strong></span>
                      <span>Total Presupuestado: <strong>{formatCurrency(repair.finalCost || repair.estimatedCost)}</strong></span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No se requirieron piezas de repuesto o solo mano de obra.</p>
                )}
              </div>
            </div>

            {/* 3. Entrega & Cierre */}
            {repair.status === 'entregado' && (
              <div className="relative">
                <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                  3
                </div>
                <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5 shadow-xs space-y-1.5 border-emerald-200 dark:border-emerald-800/60">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Entrega Efectiva al Cliente
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {repair.pickedUpAt ? format(new Date(repair.pickedUpAt), "d 'de' MMMM yyyy, HH:mm", { locale: es }) : 'Entregado'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    El equipo fue retirado satisfactoriamente por <strong>{repair.customer.name}</strong>. En esta fecha comenzó a correr el período de garantía.
                  </p>
                </div>
              </div>
            )}

            {/* 4. Casos de Garantía / Reingresos */}
            {warrantyCases.length > 0 && (
              <div className="relative">
                <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                  4
                </div>
                <div className="rounded-xl border bg-purple-50/50 dark:bg-purple-950/20 p-3.5 shadow-xs space-y-2.5 border-purple-200 dark:border-purple-800/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-purple-600" />
                      Reclamos de Garantía Post-Venta Registrados
                    </span>
                    <Badge className="bg-purple-600 text-white text-[10px]">
                      {warrantyCases.length} caso{warrantyCases.length > 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {warrantyCases.map((c) => {
                      const meta = STATUS_META[c.status] ?? STATUS_META.open
                      return (
                        <div key={c.id} className="p-2.5 rounded-lg border bg-white dark:bg-slate-900 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              Reclamo #{c.case_number || c.id.slice(0, 8)}
                            </span>
                            <Badge variant="outline" className={cn("text-[10px]", meta.className)}>
                              {meta.label}
                            </Badge>
                          </div>
                          {c.reason && (
                            <p className="text-slate-600 dark:text-slate-400"><strong>Motivo:</strong> {c.reason}</p>
                          )}
                          {c.generated_repair?.ticket_number && (
                            <p className="text-purple-700 dark:text-purple-300 font-medium">
                              ↳ Reingresó como nueva orden: #{c.generated_repair.ticket_number}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── PESTAÑA 2: VISITAS ANTERIORES DEL CELULAR ─── */}
      {activeTab === 'previous_visits' && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border space-y-1 text-xs">
            <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-cyan-600" />
              Historial de Visitas: {repair.brand} {repair.model}
            </p>
            <p className="text-muted-foreground text-[11px]">
              Cliente: <strong>{repair.customer.name}</strong> · Tel: {repair.customer.phone || 'Sin teléfono'}
            </p>
          </div>

          {previousRepairs.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
              <Sparkles className="h-8 w-8 text-cyan-500 mx-auto opacity-80" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Primera visita registrada para este equipo
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No existen reparaciones previas registradas en el sistema para este cliente con el modelo {repair.brand} {repair.model}.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground">
                Se encontraron {previousRepairs.length} reparación(es) previa(s) de este equipo:
              </p>

              {previousRepairs.map((prev) => {
                const statusMeta = statusConfig[prev.status]
                const prevWarranty = getWarrantyStatus(prev.warrantyExpiresAt)
                return (
                  <div
                    key={prev.id}
                    className="p-3.5 rounded-xl border bg-white dark:bg-slate-900 hover:border-cyan-300 dark:hover:border-cyan-800 transition-all shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          #{prev.ticketNumber || prev.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(prev.createdAt), "d 'de' MMM yyyy", { locale: es })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[10px] font-medium", statusMeta?.color)}>
                          {statusMeta?.label || prev.status}
                        </Badge>
                        {prev.warrantyExpiresAt && (
                          <Badge variant="outline" className={cn(
                            "text-[10px]",
                            prevWarranty === 'active' ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-300 text-slate-600"
                          )}>
                            Garantía {prevWarranty === 'active' ? 'Vigente' : 'Expirada'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="text-slate-800 dark:text-slate-200">
                        <strong>Falla reparada:</strong> {prev.issue}
                      </p>
                      {prev.parts && prev.parts.length > 0 && (
                        <p className="text-muted-foreground text-[11px]">
                          <strong>Repuestos usados:</strong> {prev.parts.map(p => p.name).join(', ')}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                        <span>Técnico: <strong>{prev.technician?.name || 'No asignado'}</strong></span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          Total: {formatCurrency(prev.finalCost || prev.estimatedCost)}
                        </span>
                      </div>
                    </div>

                    {onSelectPreviousRepair && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectPreviousRepair(prev)}
                        className="w-full text-xs h-7 font-bold text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 gap-1 border border-cyan-200/60 dark:border-cyan-900/40"
                      >
                        <span>Ver Ficha Técnica Completa de esta Reparación</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── PESTAÑA 3: BITÁCORA TÉCNICA Y NOTAS ─── */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* Formulario para agregar nueva nota técnica */}
          <form onSubmit={handleAddNote} className="p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-900 space-y-2.5">
            <div className="flex items-center justify-between">
              <label htmlFor="timeline-note-text" className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-cyan-600" />
                Registrar Nota Técnica en la Bitácora
              </label>
              <Input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Nombre del técnico"
                className="h-7 w-36 text-xs"
              />
            </div>

            <Textarea
              id="timeline-note-text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Ej: Se limpió sulfato en pin de carga, consumo testeado en 1.8A, display responde correctamente..."
              rows={2}
              className="text-xs resize-none"
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={isSavingNote || !newNoteText.trim()}
                className="h-8 text-xs font-bold gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {isSavingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Guardar en Historial
              </Button>
            </div>
          </form>

          {/* Lista de notas existentes */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Notas Registradas ({localNotes.length})
            </h4>

            {localNotes.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                No hay notas técnicas registradas aún en este servicio.
              </div>
            ) : (
              <div className="space-y-2">
                {localNotes.map((note, idx) => (
                  <div key={note.id || idx} className="p-3 rounded-xl border bg-white dark:bg-slate-900 shadow-xs space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <User className="h-3 w-3 text-cyan-600" />
                        {note.author || 'Técnico'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {note.timestamp ? format(new Date(note.timestamp), "d MMM yyyy, HH:mm", { locale: es }) : ''}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed pl-4 border-l-2 border-slate-200 dark:border-slate-800">
                      {note.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
