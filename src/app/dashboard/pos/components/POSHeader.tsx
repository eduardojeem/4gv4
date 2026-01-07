'use client'

import React from 'react'
import Link from 'next/link'
import { 
  Settings, 
  Maximize, 
  Minimize, 
  BarChart3,
  CreditCard,
  FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GSIcon } from '@/components/ui/standardized-components'
import { cn } from '@/lib/utils'

interface Register {
  id: string
  name: string
}

interface POSHeaderProps {
  registers: Register[]
  activeRegisterId: string
  onRegisterChange: (id: string) => void
  onOpenRegisterManager: () => void
  onOpenMovements: () => void
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const POSHeader: React.FC<POSHeaderProps> = ({
  registers,
  activeRegisterId,
  onRegisterChange,
  onOpenRegisterManager,
  onOpenMovements,
  isFullscreen,
  onToggleFullscreen,
  children,
  className
}) => {
  return (
    <div className={cn("flex items-center justify-between gap-4 p-2", className)}>
      {/* Left Side: Branding & Register Selection */}
      <div className="flex items-center gap-6">
        {children}
        
        {children && <div className="h-8 w-px bg-border/60" />}

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-md border border-border/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Caja Activa</span>
            <div className="h-3 w-px bg-border/50" />
            
            <div className="flex items-center gap-2">
              <Select value={activeRegisterId} onValueChange={onRegisterChange}>
                <SelectTrigger className="w-40 h-8 text-xs bg-background border-border/50 shadow-sm">
                  <div className="flex items-center gap-2 truncate">
                    <CreditCard className="h-3 w-3 text-muted-foreground" />
                    <SelectValue placeholder="Caja" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {registers.map(reg => (
                    <SelectItem key={reg.id} value={reg.id} className="text-xs">
                      {reg.name || `Caja ${reg.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={onOpenRegisterManager}
                title="Gestionar cajas"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-muted/30 rounded-lg p-1 border border-border/40 mr-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-3 text-xs font-medium hover:bg-background shadow-none"
            onClick={onOpenMovements}
          >
            <GSIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            Movimientos
          </Button>
          <div className="w-px h-4 bg-border/40 mx-1" />
          <Link href="/dashboard/pos/caja">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs font-medium hover:bg-background shadow-none"
            >
              <FileText className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              Detalles de Caja
            </Button>
          </Link>
          <div className="w-px h-4 bg-border/40 mx-1" />
          <Link href="/dashboard/pos/dashboard">
            <Button variant="ghost" size="sm" className="h-7 px-3 text-xs font-medium hover:bg-background shadow-none">
              <BarChart3 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              Reportes
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
