'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from 'lucide-react'
import { useCashRegisterContext } from '../contexts/CashRegisterContext'
import { CashCountModal } from '../components/CashCountModal'
import { useAuth } from '@/contexts/auth-context'
import { isPhysicalCashSale, isPhysicalManualMovement } from '../lib/cash-balance'

import { CashRegisterHeader } from './components/CashRegisterHeader'
import { CashRegisterOverview } from './components/CashRegisterOverview'
import { CashRegisterReport } from './components/CashRegisterReport'
import { CashRegisterHistory } from './components/CashRegisterHistory'
import { CashRegisterAudit } from './components/CashRegisterAudit'
import { ElectronicPaymentsPanel } from './components/ElectronicPaymentsPanel'
import { OpenCashRegisterDialog } from '../components/OpenCashRegisterDialog'
import { POSCashMovementDialog } from '../components/POSCashMovementDialog'

export default function CashRegisterPage() {
  const router = useRouter()
  const {
    registers,
    activeRegisterId,
    setActiveRegisterId,
    openRegister,
    closeRegister,
    addMovement,
    performCashCount,
    userPermissions,
    getCurrentRegister
  } = useCashRegisterContext()

  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canAccessAudit = user?.role === 'admin' || userPermissions.canViewAuditLog === true

  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>(() => {
    if (typeof window === 'undefined') return 'simple'
    if (!isAdmin) return 'simple'
    try {
      const saved = localStorage.getItem('pos_caja_view_mode')
      return saved === 'advanced' || saved === 'simple' ? saved : 'advanced'
    } catch {
      return 'advanced'
    }
  })

  // Sync viewMode when isAdmin changes
  useEffect(() => {
    if (!isAdmin) {
      setViewMode('simple')
    } else {
      try {
        const saved = localStorage.getItem('pos_caja_view_mode')
        setViewMode(saved === 'advanced' || saved === 'simple' ? saved : 'advanced')
      } catch {
        setViewMode('advanced')
      }
    }
  }, [isAdmin])

  const [isOpenRegisterDialogOpen, setIsOpenRegisterDialogOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingNote, setOpeningNote] = useState('')
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [movementType, setMovementType] = useState<'in' | 'out'>('in')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementNote, setMovementNote] = useState('')

  const [isCashCountModalOpen, setIsCashCountModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!activeRegisterId && registers && registers.length > 0) {
      setActiveRegisterId(registers[0].id)
    }
  }, [registers, activeRegisterId, setActiveRegisterId])

  const parsedMovementAmount = useMemo(() => {
    const n = Number(movementAmount)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [movementAmount])

  const [closingCountedAmount, setClosingCountedAmount] = useState('')

  const parsedClosingAmount = useMemo(() => {
    const n = Number(closingCountedAmount)
    return Number.isFinite(n) && n >= 0 ? n : null
  }, [closingCountedAmount])

  const currentRegister = getCurrentRegister

  const openAuditPage = () => {
    router.push('/dashboard/pos/caja/auditoria')
  }

  const openHistoryPage = () => {
    router.push('/dashboard/pos/caja/historial')
  }

  // Fix #12: estabilizar openMovementDialog con useCallback para keyboard shortcut deps
  const openMovementDialog = useCallback((type: 'in' | 'out') => {
    setMovementType(type)
    setMovementAmount('')
    setMovementNote('')
    setIsMovementDialogOpen(true)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return

      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      const key = event.key.toLowerCase()
      if (key === 'e') {
        event.preventDefault()
        openMovementDialog('in')
      } else if (key === 's') {
        event.preventDefault()
        openMovementDialog('out')
      } else if (key === 'a') {
        event.preventDefault()
        setIsCashCountModalOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // Fix #12: incluir openMovementDialog en deps (ahora estabilizado con useCallback)
  }, [openMovementDialog])

  // Reset activeTab to 'overview' when audit access is revoked
  useEffect(() => {
    if (!canAccessAudit && activeTab === 'audit') {
      setActiveTab('overview')
    }
  }, [canAccessAudit, activeTab])

  useEffect(() => {
    if (!isAdmin) return
    try {
      localStorage.setItem('pos_caja_view_mode', viewMode)
    } catch {
      // no-op
    }
  }, [isAdmin, viewMode])

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
      <CashRegisterHeader />


      {isAdmin && (
        <div className="flex justify-end">
          <div className="inline-flex rounded-lg border bg-card p-1 gap-1">
            <Button
              size="sm"
              variant={viewMode === 'simple' ? 'default' : 'ghost'}
              onClick={() => setViewMode('simple')}
            >
              Modo simple
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'advanced' ? 'default' : 'ghost'}
              onClick={() => setViewMode('advanced')}
            >
              Modo avanzado
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="w-full overflow-x-auto no-scrollbar pb-1 mb-4">
          <TabsList className={`inline-flex w-auto min-w-full sm:min-w-0 sm:grid sm:max-w-3xl ${canAccessAudit ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} p-1 h-auto bg-muted/60 dark:bg-muted/30 rounded-xl border border-border/50`}>
            <TabsTrigger value="overview" className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg">Resumen</TabsTrigger>
            <TabsTrigger value="electronic" className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg">Cobros</TabsTrigger>
            <TabsTrigger value="report" className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg">Reporte</TabsTrigger>
            <TabsTrigger value="history" className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg">Historial</TabsTrigger>
            {canAccessAudit && <TabsTrigger value="audit" className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg">Auditoría</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          {activeTab === 'overview' && (
            <CashRegisterOverview
              onOpenRegister={() => setIsOpenRegisterDialogOpen(true)}
              onCloseRegister={() => setIsCloseDialogOpen(true)}
              onCashIn={() => openMovementDialog('in')}
              onCashOut={() => openMovementDialog('out')}
              onCashCount={() => setIsCashCountModalOpen(true)}
              advancedMode={isAdmin && viewMode === 'advanced'}
            />
          )}
        </TabsContent>

        <TabsContent value="electronic" className="space-y-4">
          {activeTab === 'electronic' && <ElectronicPaymentsPanel />}
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          {activeTab === 'report' && (
            <CashRegisterReport
              onCloseRegister={() => setIsCloseDialogOpen(true)}
              advancedMode={isAdmin && viewMode === 'advanced'}
            />
          )}
        </TabsContent>

        <TabsContent value="history">
          {activeTab === 'history' && (
            <CashRegisterHistory
              onOpenFullHistory={openHistoryPage}
              onOpenAudit={openAuditPage}
            />
          )}
        </TabsContent>

        {canAccessAudit && (
          <TabsContent value="audit">
            {activeTab === 'audit' && (
              <CashRegisterAudit onOpenFullAudit={openAuditPage} />
            )}
          </TabsContent>
        )}
      </Tabs>

      <OpenCashRegisterDialog
        open={isOpenRegisterDialogOpen}
        onOpenChange={setIsOpenRegisterDialogOpen}
        amount={openingAmount}
        onAmountChange={setOpeningAmount}
        note={openingNote}
        onNoteChange={setOpeningNote}
        registerName={registers.find((register) => register.id === activeRegisterId)?.name}
        isSubmitting={isSubmitting}
        onSubmit={async (amount, note) => {
          setIsSubmitting(true)
          try {
            const opened = await openRegister(amount, note, user?.id)
            if (opened) {
              setIsOpenRegisterDialogOpen(false)
              setOpeningAmount('')
              setOpeningNote('')
            }
          } finally {
            setIsSubmitting(false)
          }
        }}
      />

      <Dialog open={isCloseDialogOpen} onOpenChange={(open) => {
        setIsCloseDialogOpen(open)
        if (!open) setClosingCountedAmount('')
      }}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl bg-card border-border shadow-2xl">
          <DialogHeader className="p-5 sm:p-6 border-b bg-muted/30 text-left">
            <DialogTitle className="text-lg font-bold">Cerrar Turno de Caja</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Registre el monto físico contado en caja para conciliar y calcular diferencias.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 sm:p-6 space-y-4">
            {/* Resumen financiero antes de confirmar cierre */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fondo de Apertura:</span>
                <span className="font-semibold tabular-nums">
                  {new Intl.NumberFormat('es-PY').format(currentRegister.movements.find(m => m.type === 'opening')?.amount ?? 0)} Gs.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ventas en Efectivo:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{new Intl.NumberFormat('es-PY').format(
                    currentRegister.movements.filter(isPhysicalCashSale).reduce((s, m) => s + m.amount, 0)
                  )} Gs.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ingresos Manuales:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{new Intl.NumberFormat('es-PY').format(
                    currentRegister.movements.filter(m => m.type === 'cash_in' && isPhysicalManualMovement(m)).reduce((s, m) => s + m.amount, 0)
                  )} Gs.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Egresos / Retiros:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  -{new Intl.NumberFormat('es-PY').format(
                    currentRegister.movements.filter(m => m.type === 'cash_out' && isPhysicalManualMovement(m)).reduce((s, m) => s + m.amount, 0)
                  )} Gs.
                </span>
              </div>
              <div className="h-px bg-border/60 my-1" />
              <div className="flex justify-between font-bold text-sm">
                <span>Esperado en caja:</span>
                <span className="text-primary tabular-nums">
                  {new Intl.NumberFormat('es-PY').format(currentRegister.balance)} Gs.
                </span>
              </div>
              {parsedClosingAmount !== null && (
                <div className={`flex justify-between font-bold text-sm pt-1 border-t border-dashed border-border/60 ${
                  parsedClosingAmount === currentRegister.balance
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : Math.abs(parsedClosingAmount - currentRegister.balance) > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : ''
                }`}>
                  <span>Diferencia:</span>
                  <span className="tabular-nums">
                    {parsedClosingAmount > currentRegister.balance ? '+' : ''}
                    {new Intl.NumberFormat('es-PY').format(parsedClosingAmount - currentRegister.balance)} Gs.
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="closing-counted" className="text-xs font-semibold text-foreground">
                Monto real contado en efectivo físico
              </Label>
              <Input
                id="closing-counted"
                type="text"
                inputMode="numeric"
                value={closingCountedAmount}
                onChange={(e) => setClosingCountedAmount(e.target.value.replace(/\D/g, ''))}
                placeholder={`Ej: ${new Intl.NumberFormat('es-PY').format(currentRegister.balance)}`}
                className="h-11 text-base font-bold font-mono tabular-nums rounded-xl"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Cuente el dinero físico real del cajón e ingrese el total aquí.
              </p>
            </div>
          </div>

          <DialogFooter className="p-4 sm:px-6 bg-muted/20 border-t border-border/50 flex flex-row items-center justify-between sm:justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setIsCloseDialogOpen(false)
              setClosingCountedAmount('')
            }} className="h-10 text-xs rounded-xl flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={parsedClosingAmount === null || isSubmitting}
              className="h-10 text-xs font-bold rounded-xl flex-1 sm:flex-none shadow-md"
              onClick={async () => {
                if (parsedClosingAmount === null) return
                setIsSubmitting(true)
                try {
                  const closed = await closeRegister(parsedClosingAmount, user?.id)
                  if (closed) {
                    setIsCloseDialogOpen(false)
                    setClosingCountedAmount('')
                  }
                } finally {
                  setIsSubmitting(false)
                }
              }}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Cerrando turno...' : 'Confirmar Cierre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <POSCashMovementDialog
        open={isMovementDialogOpen}
        onOpenChange={setIsMovementDialogOpen}
        onAddMovement={addMovement}
        initialType={movementType}
        currentBalance={getCurrentRegister?.balance || 0}
      />

      <CashCountModal
        isOpen={isCashCountModalOpen}
        onClose={() => setIsCashCountModalOpen(false)}
        onConfirm={(count) => performCashCount({
          ...count,
          timestamp: new Date().toISOString(),
          countedBy: user?.id || 'system'
        })}
        systemBalance={getCurrentRegister.balance || 0}
      />

    </div>
  )
}

