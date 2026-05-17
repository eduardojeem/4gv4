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
import { useCashRegisterContext } from '../contexts/CashRegisterContext'
import { CashCountModal } from '../components/CashCountModal'
import { useAuth } from '@/contexts/auth-context'

import { CashRegisterHeader } from './components/CashRegisterHeader'
import { CashRegisterOverview } from './components/CashRegisterOverview'
import { CashRegisterReport } from './components/CashRegisterReport'
import { CashRegisterHistory } from './components/CashRegisterHistory'
import { CashRegisterAudit } from './components/CashRegisterAudit'

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

  useEffect(() => {
    if (!activeRegisterId && registers && registers.length > 0) {
      setActiveRegisterId(registers[0].id)
    }
  }, [registers, activeRegisterId, setActiveRegisterId])

  const parsedOpeningAmount = useMemo(() => {
    const n = Number(openingAmount)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [openingAmount])

  const parsedMovementAmount = useMemo(() => {
    const n = Number(movementAmount)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [movementAmount])

  // Fix #13: monto de apertura requiere > 0 para ser válido (monto 0 no permitido)
  const isOpeningAmountValid = parsedOpeningAmount > 0

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
        <TabsList className={`grid w-full max-w-2xl ${canAccessAudit ? 'grid-cols-4' : 'grid-cols-3'} mb-4`}>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
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

      <Dialog open={isOpenRegisterDialogOpen} onOpenChange={setIsOpenRegisterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
            <DialogDescription>
              Ingrese el monto inicial en caja para comenzar el turno.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Monto Inicial</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Nota (Opcional)</Label>
              <Input
                id="note"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                placeholder="Ej. Turno manana"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpenRegisterDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={!isOpeningAmountValid}
              onClick={() => {
                openRegister(parsedOpeningAmount, openingNote, user?.id)
                setIsOpenRegisterDialogOpen(false)
                setOpeningAmount('')
                setOpeningNote('')
              }}
            >
              Abrir Caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  currentRegister.movements.filter(m => m.type === 'sale').reduce((s, m) => s + m.amount, 0)
                )} Gs.
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entradas:</span>
              <span className="font-semibold text-emerald-600">
                +{new Intl.NumberFormat('es-PY').format(
                  currentRegister.movements.filter(m => m.type === 'cash_in').reduce((s, m) => s + m.amount, 0)
                )} Gs.
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Salidas:</span>
              <span className="font-semibold text-rose-600">
                -{new Intl.NumberFormat('es-PY').format(
                  currentRegister.movements.filter(m => m.type === 'cash_out').reduce((s, m) => s + m.amount, 0)
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
              disabled={parsedClosingAmount === null}
              onClick={() => {
                if (parsedClosingAmount === null) return
                closeRegister(parsedClosingAmount, user?.id)
                setIsCloseDialogOpen(false)
                setClosingCountedAmount('')
              }}
            >
              Confirmar Cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{movementType === 'in' ? 'Registrar Ingreso' : 'Registrar Egreso'}</DialogTitle>
            <DialogDescription>
              {movementType === 'in'
                ? 'Ingrese el monto a agregar a la caja.'
                : 'Ingrese el monto a retirar de la caja.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="mov-amount">Monto</Label>
              <Input
                id="mov-amount"
                type="number"
                inputMode="decimal"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                autoFocus
                placeholder="0"
              />
              <div className="flex flex-wrap gap-2 mt-1">
                {[5000, 10000, 20000, 50000, 100000].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setMovementAmount(amount.toString())}
                  >
                    {new Intl.NumberFormat('es-PY').format(amount)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mov-note">Motivo / Nota</Label>
              <Input
                id="mov-note"
                value={movementNote}
                onChange={(e) => setMovementNote(e.target.value)}
                placeholder={movementType === 'in' ? 'Ej. Cambio inicial' : 'Ej. Pago a proveedor'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovementDialogOpen(false)}>Cancelar</Button>
            <Button
              variant={movementType === 'out' ? 'destructive' : 'default'}
              disabled={parsedMovementAmount <= 0}
              onClick={() => {
                if (parsedMovementAmount <= 0) return
                addMovement(
                  // Fix: tipos correctos 'cash_in' / 'cash_out'
                  movementType === 'in' ? 'cash_in' : 'cash_out',
                  parsedMovementAmount,
                  movementNote || (movementType === 'in' ? 'Ingreso' : 'Egreso')
                )
                setIsMovementDialogOpen(false)
              }}
            >
              {movementType === 'in' ? 'Registrar Ingreso' : 'Registrar Egreso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

