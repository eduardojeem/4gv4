'use client'

import React from 'react'
import Link from 'next/link'
import { 
  Settings, 
  Maximize, 
  Minimize, 
  BarChart3,
  CreditCard,
  FileText,
  ShoppingCart
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
  onOpenRegister?: () => void
  isRegisterOpen?: boolean
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  children?: React.ReactNode;
  className?: string;
  onOpenCart?: () => void;
  cartItemCount?: number;
}

export const POSHeader: React.FC<POSHeaderProps> = React.memo(({ 
  registers,
  activeRegisterId,
  onRegisterChange,
  onOpenRegisterManager,
  onOpenMovements,
  onOpenRegister,
  isRegisterOpen,
  isFullscreen,
  onToggleFullscreen,
  children,
  className,
  onOpenCart,
  cartItemCount
}) => {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  return (
    <div className={cn("flex items-center justify-between gap-4 p-2", className)}>
      {/* Left Side: Branding & Register Selection */}
      <div className="flex items-center gap-6">
        {children}
        
        {children && <div className="h-8 w-px bg-border/60" />}

        <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-muted/40 px-2 py-1 md:px-3 md:py-1.5 rounded-md border border-border/40">
            <span className="hidden md:inline text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Caja Activa</span>
            <div className="hidden md:block h-2 w-px bg-border/50" />
            
            <div className="flex items-center gap-2">
              {!mounted ? (
                <div className="w-32 h-7 text-[11px] bg-background border border-border/50 shadow-sm rounded-md px-2.5 py-0.5 flex items-center gap-1.5">
                  <CreditCard className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="truncate">
                    {registers.find(r => r.id === activeRegisterId)?.name || 'Caja Principal'}
                  </span>
                </div>
              ) : (
                <Select 
                  value={registers.find(r => r.id === activeRegisterId) ? activeRegisterId : registers[0]?.id || ''} 
                  onValueChange={onRegisterChange}
                >
                  <SelectTrigger size="sm" className="w-32 h-7 text-[11px] bg-background border-border/50 shadow-sm">
                    <div className="flex items-center gap-1.5 truncate">
                      <CreditCard className="h-2.5 w-2.5 text-muted-foreground" />
                      <SelectValue placeholder="Caja" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {registers && registers.length > 0 ? registers.map(reg => (
                      <SelectItem key={reg.id} value={reg.id} className="text-[11px]">
                        {reg.name || `Caja ${reg.id}`}
                      </SelectItem>
                    )) : (
                      <SelectItem value="principal" className="text-[11px]">
                        Caja Principal
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={onOpenRegisterManager}
                title="Gestionar cajas"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Actions */}
      <div className="flex items-center gap-2">
        {onOpenCart && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-3 text-xs font-medium hover:bg-background shadow-none"
            onClick={onOpenCart}
            title="Ver productos agregados"
          >
            <ShoppingCart className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            Carrito {typeof cartItemCount === 'number' ? `(${cartItemCount})` : ''}
          </Button>
        )}
        <div className="flex items-center bg-muted/30 rounded-lg p-1 border border-border/40 mr-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-3 text-xs font-medium hover:bg-background shadow-none"
            onClick={isRegisterOpen ? onOpenMovements : onOpenRegister}
            title={isRegisterOpen ? "Ver movimientos" : "Abrir caja"}
          >
            <GSIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            {isRegisterOpen ? 'Movimientos' : 'Abrir caja'}
          </Button>
          {isRegisterOpen && (
            <>
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
            </>
          )}
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
})
