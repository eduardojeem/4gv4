'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { ArrowLeft, FileText, HelpCircle, RefreshCw, Store, Wifi, WifiOff } from 'lucide-react'
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'
import { toast } from 'sonner'
import { CashRegisterGuideDialog } from './CashRegisterGuideDialog'

interface CashRegisterHeaderProps {
  auditPageHref?: string
}

export const CashRegisterHeader = React.memo(function CashRegisterHeader({ auditPageHref = '/dashboard/pos/caja/auditoria' }: CashRegisterHeaderProps) {
  const {
    registers,
    activeRegisterId,
    setActiveRegisterId,
    getCurrentRegister,
    isOnline,
    syncWithServer
  } = useCashRegisterContext()

  const [isSyncing, setIsSyncing] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  const registerName = useMemo(
    () => registers.find(r => r.id === activeRegisterId)?.name || 'Caja principal',
    [registers, activeRegisterId]
  )

  const isRegisterOpen = getCurrentRegister.isOpen

  const handleSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const success = await syncWithServer()
      if (success) toast.success('Datos sincronizados')
      else toast.error('Error al sincronizar')
    } catch {
      toast.error('Error al sincronizar')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
              <Button asChild variant="outline" size="icon" className="size-11 shrink-0" aria-label="Volver a POS">
                <Link href="/dashboard/pos">
                <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>

            <div className="min-w-0 space-y-1">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex items-start gap-2">
                <Store className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <span className="break-words">Caja: {registerName}</span>
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={isRegisterOpen ? 'default' : 'secondary'}>
                  {isRegisterOpen ? 'Turno abierto' : 'Turno cerrado'}
                </Badge>

                <Badge variant="outline" className="gap-1 font-medium">
                  {isOnline ? <Wifi className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <WifiOff className="h-3 w-3 text-rose-600 dark:text-rose-400" />}
                  {isOnline ? 'En línea' : 'Sin conexión'}
                </Badge>

                <span className="hidden md:inline">•</span>
                <span className="hidden capitalize md:inline">{new Date().toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>

              <p className="text-xs text-muted-foreground">
                {isRegisterOpen
                  ? 'Operativa activa: registre entradas/salidas y realice arqueos periódicos.'
                  : 'Operativa pausada: abra la caja para iniciar el turno.'}
              </p>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGuide(true)}
              className="order-3 h-11 gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 font-semibold rounded-xl"
            >
              <HelpCircle className="h-4 w-4 text-primary" />
              <span>¿Cómo funciona?</span>
            </Button>

            <Select value={activeRegisterId} onValueChange={setActiveRegisterId}>
              <SelectTrigger aria-label="Seleccionar caja" className="order-1 h-11 w-full min-w-0 rounded-xl font-medium sm:w-48">
                <SelectValue placeholder="Seleccionar caja" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {registers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={handleSync}
              title="Sincronizar datos"
              aria-label="Sincronizar datos"
              disabled={isSyncing}
              className="order-2 size-11 rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>

              <Button asChild variant="outline" size="sm" className="order-4 h-11 rounded-xl font-semibold">
                <Link href={auditPageHref}>
                <FileText className="mr-2 h-4 w-4" />
                Auditoría
                </Link>
              </Button>
          </div>
        </div>
      </div>

      <CashRegisterGuideDialog 
        open={showGuide} 
        onOpenChange={setShowGuide} 
      />
    </>
  )
})

