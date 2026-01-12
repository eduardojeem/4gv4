'use client'

import React, { useState, useEffect } from 'react'
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
import { ZClosureHistoryModal } from '../components/ZClosureHistoryModal'
import { AuditLogModal } from '../components/AuditLogModal'
import { CashCountModal } from '../components/CashCountModal'
import { PermissionsModal } from '../components/PermissionsModal'
import { useAuth } from '@/contexts/auth-context'

import { CashRegisterHeader } from './components/CashRegisterHeader'
import { CashRegisterOverview } from './components/CashRegisterOverview'
import { CashRegisterReport } from './components/CashRegisterReport'
import { CashRegisterHistory } from './components/CashRegisterHistory'
import { CashRegisterAudit } from './components/CashRegisterAudit'

export default function CashRegisterPage() {
  const {
    registers,
    activeRegisterId,
    setActiveRegisterId,
    openRegister,
    closeRegister,
    addMovement,
    userPermissions,
    setUserPermissions,
    auditLog,
    performCashCount,
    zClosureHistory,
    getCurrentRegister
  } = useCashRegisterContext()

  const { user } = useAuth()

  const [isOpenRegisterDialogOpen, setIsOpenRegisterDialogOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('0')
  const [openingNote, setOpeningNote] = useState('')
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)

  // Movement Dialog State
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [movementType, setMovementType] = useState<'in' | 'out'>('in')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementNote, setMovementNote] = useState('')

  // Modal states
  const [isCashCountModalOpen, setIsCashCountModalOpen] = useState(false)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [isAuditLogModalOpen, setIsAuditLogModalOpen] = useState(false)
  const [isZClosureHistoryModalOpen, setIsZClosureHistoryModalOpen] = useState(false)

  // Initialize active register if needed
  useEffect(() => {
    if (!activeRegisterId && registers && registers.length > 0) {
      setActiveRegisterId(registers[0].id)
    }
  }, [registers, activeRegisterId, setActiveRegisterId])

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <CashRegisterHeader
        onOpenPermissions={() => setIsPermissionsModalOpen(true)}
        onOpenAudit={() => setIsAuditLogModalOpen(true)}
      />

      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <TabsList className="grid w-full max-w-md grid-cols-4 mb-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="report">Reporte</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="audit">Auditoría</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <CashRegisterOverview
            onOpenRegister={() => setIsOpenRegisterDialogOpen(true)}
            onCloseRegister={() => setIsCloseDialogOpen(true)}
            onCashIn={() => {
              setMovementType('in')
              setMovementAmount('')
              setMovementNote('')
              setIsMovementDialogOpen(true)
            }}
            onCashOut={() => {
              setMovementType('out')
              setMovementAmount('')
              setMovementNote('')
              setIsMovementDialogOpen(true)
            }}
            onCashCount={() => setIsCashCountModalOpen(true)}
          />
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <CashRegisterReport onCloseRegister={() => setIsCloseDialogOpen(true)} />
        </TabsContent>

        <TabsContent value="history">
          <CashRegisterHistory
            onOpenFullHistory={() => setIsZClosureHistoryModalOpen(true)}
            onOpenAudit={() => setIsAuditLogModalOpen(true)}
          />
        </TabsContent>

        <TabsContent value="audit">
          <CashRegisterAudit onOpenFullAudit={() => setIsAuditLogModalOpen(true)} />
        </TabsContent>
      </Tabs>

      {/* --- Modals --- */}

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
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Nota (Opcional)</Label>
              <Input
                id="note"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                placeholder="Ej. Turno mañana"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpenRegisterDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              const amount = parseFloat(openingAmount) || 0
              openRegister(amount, openingNote, user?.id)
              setIsOpenRegisterDialogOpen(false)
              setOpeningAmount('0')
              setOpeningNote('')
            }}>Abrir Caja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
            <DialogDescription>
              Confirmar cierre del turno actual. El saldo permanecerá registrado y podrás ver el detalle en reportes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => {
              closeRegister()
              setIsCloseDialogOpen(false)
            }}>Cerrar Caja</Button>
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
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                autoFocus
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
                placeholder={movementType === 'in' ? "Ej. Cambio inicial" : "Ej. Pago a proveedor"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovementDialogOpen(false)}>Cancelar</Button>
            <Button
              variant={movementType === 'out' ? "destructive" : "default"}
              onClick={() => {
                const amount = parseFloat(movementAmount)
                if (!amount || amount <= 0) {
                  return
                }
                addMovement(movementType, amount, movementNote || (movementType === 'in' ? 'Ingreso' : 'Egreso'))
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
        onConfirm={(count) => performCashCount(count)}
        systemBalance={getCurrentRegister.balance || 0}
      />

      <PermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        currentPermissions={userPermissions}
        onSave={setUserPermissions}
      />

      <AuditLogModal
        isOpen={isAuditLogModalOpen}
        onClose={() => setIsAuditLogModalOpen(false)}
        auditLog={auditLog}
      />

      <ZClosureHistoryModal
        isOpen={isZClosureHistoryModalOpen}
        onClose={() => setIsZClosureHistoryModalOpen(false)}
        closures={zClosureHistory}
        onExportData={(filteredClosures) => {
          console.log('Exporting closures:', filteredClosures)
        }}
        onViewDetails={(closure) => {
          // Optional: Handle viewing details of a closure
          console.log('View details', closure)
        }}
      />
    </div>
  )
}
