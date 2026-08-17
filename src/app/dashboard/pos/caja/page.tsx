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

  // Adjust state during render based on prop/context changes
  const [prevIsAdmin, setPrevIsAdmin] = useState(isAdmin)
  if (isAdmin !== prevIsAdmin) {
    setPrevIsAdmin(isAdmin)
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
  }

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

  // Adjust activeTab during render if permissions restrict it
  if (!canAccessAudit && activeTab === 'audit') {
    setActiveTab('overview')
  }

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
        <TabsList className={`grid w-full max-w-3xl ${canAccessAudit ? 'grid-cols-5' : 'grid-cols-4'} mb-4`}>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="electronic">Cobros</TabsTrigger>
          <TabsTrigger value="report">Reporte</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          {canAccessAudit && <TabsTrigger value="audit">Auditoria</TabsTrigger>}
        </TabsList>

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
            <DialogDescription>
              Registre el monto físico contado en caja para calcular diferencias.
            </DialogDescription>
          </DialogHeader>

          {/* Fix #2: Resumen financiero antes de confirmar cierre */}
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Apertura:</span>
              <span className="font-semibold">
                {new Intl.NumberFormat('es-PY').format(currentRegister.movements.find(m => m.type === 'opening')?.amount ?? 0)} Gs.
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ventas:</span>
              <span className="font-semibold text-emerald-600">
                +{new Intl.NumberFormat('es-PY').format(
                  currentRegister.movements.filter(isPhysicalCashSale).reduce((s, m) => s + m.amount, 0)
                )} Gs.
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entradas:</span>
              <span className="font-semibold text-emerald-600">
                +{new Intl.NumberFormat('es-PY').format(
                  currentRegister.movements.filter(m => m.type === 'cash_in' && isPhysicalManualMovement(m)).reduce((s, m) => s + m.amount, 0)
                )} Gs.
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Salidas:</span>
              <span className="font-semibold text-rose-600">
                -{new Intl.NumberFormat('es-PY').format(
                  currentRegister.movements.filter(m => m.type === 'cash_out' && isPhysicalManualMovement(m)).reduce((s, m) => s + m.amount, 0)
                )} Gs.
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between font-bold">
              <span>Esperado en caja:</span>
              <span className="text-blue-700 dark:text-blue-400">
                {new Intl.NumberFormat('es-PY').format(currentRegister.balance)} Gs.
              </span>
            </div>
            {parsedClosingAmount !== null && (
              <div className={`flex justify-between font-bold ${
                parsedClosingAmount === currentRegister.balance
                  ? 'text-emerald-600'
                  : Math.abs(parsedClosingAmount - currentRegister.balance) > 0
                    ? 'text-amber-600'
                    : ''
              }`}>
                <span>Diferencia:</span>
                <span>
                  {parsedClosingAmount > currentRegister.balance ? '+' : ''}
                  {new Intl.NumberFormat('es-PY').format(parsedClosingAmount - currentRegister.balance)} Gs.
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="closing-counted">Monto real contado en caja</Label>
            <Input
              id="closing-counted"
              type="number"
              inputMode="decimal"
              value={closingCountedAmount}
              onChange={(e) => setClosingCountedAmount(e.target.value)}
              placeholder={`Ej: ${new Intl.NumberFormat('es-PY').format(currentRegister.balance)}`}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Cuente el efectivo físico y escriba el total aquí.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCloseDialogOpen(false)
              setClosingCountedAmount('')
            }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={parsedClosingAmount === null || isSubmitting}
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
              {isSubmitting ? 'Cerrando...' : 'Confirmar Cierre'}
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

