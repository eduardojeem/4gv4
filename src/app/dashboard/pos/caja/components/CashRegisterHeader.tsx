'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { ArrowLeft, FileText, RefreshCw, Store, Wifi, WifiOff } from 'lucide-react'
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'
import { toast } from 'sonner'

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

  const registerName = useMemo(
    () => registers.find(r => r.id === activeRegisterId)?.name || 'Caja principal',
    [registers, activeRegisterId]
  )

  const isRegisterOpen = getCurrentRegister.isOpen

  const handleSync = async () => {
    setIsSyncing(true)
    const success = await syncWithServer()
    setIsSyncing(false)

    if (success) {
      toast.success('Datos sincronizados')
    } else {
      toast.error('Error al sincronizar')
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/pos">
            <Button variant="outline" size="icon" aria-label="Volver a POS">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Caja: {registerName}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={isRegisterOpen ? 'default' : 'secondary'}>
                {isRegisterOpen ? 'Turno abierto' : 'Turno cerrado'}
              </Badge>

              <Badge variant="outline" className="gap-1">
                {isOnline ? <Wifi className="h-3 w-3 text-emerald-600" /> : <WifiOff className="h-3 w-3 text-rose-600" />}
                {isOnline ? 'En linea' : 'Sin conexion'}
              </Badge>

              <span className="hidden md:inline">•</span>
              <span>{new Date().toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>

            <p className="text-xs text-muted-foreground">
              {isRegisterOpen
                ? 'Operativa activa: registre entradas/salidas y realice arqueos periodicos.'
                : 'Operativa pausada: abra la caja para iniciar el turno.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={activeRegisterId} onValueChange={setActiveRegisterId}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Seleccionar caja" />
            </SelectTrigger>
            <SelectContent>
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
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>

          <Link href={auditPageHref}>
            <Button variant="default" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              Auditoria
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
})

