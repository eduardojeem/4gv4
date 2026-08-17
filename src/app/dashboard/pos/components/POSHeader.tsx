'use client'

import React from 'react'
import Link from 'next/link'
import { 
  Settings, 
  Maximize, 
  Minimize, 
  MoreVertical,
  BarChart3,
  CreditCard,
  FileText,
  ShoppingCart,
  DollarSign
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GSIcon } from '@/components/ui/standardized-components'
import { cn } from '@/lib/utils'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { POS_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { useAuth } from '@/contexts/auth-context'

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
  canManageRegisters?: boolean
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  children?: React.ReactNode;
  className?: string;
  onOpenCart?: () => void;
  cartItemCount?: number;
  mobileCompact?: boolean;
}

export const POSHeader: React.FC<POSHeaderProps> = React.memo(({ 
  registers,
  activeRegisterId,
  onRegisterChange,
  onOpenRegisterManager,
  onOpenMovements,
  onOpenRegister,
  isRegisterOpen,
  canManageRegisters = false,
  isFullscreen,
  onToggleFullscreen,
  children,
  className,
  onOpenCart,
  cartItemCount,
  mobileCompact = false
}) => {
  const { user, isAdmin } = useAuth()
  const canViewExecutiveReports = Boolean(isAdmin || user?.role === 'admin' || user?.role === 'super_admin')
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-1.5", className)}>
      {/* Left Side: Branding & Register Selection */}
      <div className="flex items-center gap-4">
        {children}
        
        {children && <div className="h-8 w-px bg-border/60" />}

        <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-border/40">
            {isRegisterOpen && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            <span className="hidden md:inline text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{isRegisterOpen ? 'Caja Abierta' : 'Caja Cerrada'}</span>
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
              
              {!mobileCompact && canManageRegisters && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={onOpenRegisterManager}
                  title="Gestionar cajas"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Actions */}
      <div className="flex items-center gap-1.5">
        {onOpenCart && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 text-xs font-semibold bg-primary/10 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground gap-1.5 transition-all shadow-xs rounded-lg",
              mobileCompact ? "w-8 px-0" : "px-2.5"
            )}
            onClick={onOpenCart}
            title="Ver productos agregados al carrito"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {!mobileCompact && <span className="hidden sm:inline">Carrito</span>}
            {typeof cartItemCount === 'number' && cartItemCount > 0 && (
              <Badge className="h-4 min-w-[16px] px-1 text-[9px] font-bold rounded-full bg-primary text-primary-foreground">
                {cartItemCount}
              </Badge>
            )}
          </Button>
        )}
        {mobileCompact ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 max-h-[75vh] sm:max-h-[80vh] overflow-y-auto p-1.5">
              <DropdownMenuItem 
                onClick={isRegisterOpen ? onOpenMovements : onOpenRegister}
                className="gap-2.5 py-2 cursor-pointer text-xs"
              >
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <div className="flex flex-col">
                  <span className="font-medium">{isRegisterOpen ? 'Movimientos de Caja' : 'Abrir Turno de Caja'}</span>
                  <span className="text-[10px] text-muted-foreground">{isRegisterOpen ? 'Ingresos y egresos' : 'Iniciar sesión'}</span>
                </div>
              </DropdownMenuItem>

              {isRegisterOpen && (
                <DropdownMenuItem asChild className="gap-2.5 py-2 cursor-pointer text-xs">
                  <Link href="/dashboard/pos/caja">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <div className="flex flex-col">
                      <span className="font-medium">Detalles de Caja</span>
                      <span className="text-[10px] text-muted-foreground">Arqueo y transacciones</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              )}

              {canViewExecutiveReports && (
                <DropdownMenuItem asChild className="gap-2.5 py-2 cursor-pointer text-xs">
                  <Link href="/dashboard/pos/dashboard">
                    <BarChart3 className="h-4 w-4 text-indigo-500" />
                    <div className="flex flex-col">
                      <span className="font-medium">Reportes de POS</span>
                      <span className="text-[10px] text-muted-foreground">Métricas y estadísticas</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              )}

              {canManageRegisters && (
                <DropdownMenuItem 
                  onClick={onOpenRegisterManager}
                  className="gap-2.5 py-2 cursor-pointer text-xs"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Gestionar cajas</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem 
                onClick={onToggleFullscreen}
                className="gap-2.5 py-2 cursor-pointer text-xs"
              >
                {isFullscreen ? <Minimize className="h-4 w-4 text-muted-foreground" /> : <Maximize className="h-4 w-4 text-muted-foreground" />}
                <span>{isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <div className="flex items-center bg-muted/30 rounded-lg p-0.5 border border-border/50">
              {/* Botón Movimientos / Abrir Caja */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium hover:bg-background text-foreground/80 hover:text-foreground gap-1.5 transition-all rounded-md"
                onClick={isRegisterOpen ? onOpenMovements : onOpenRegister}
                title={isRegisterOpen ? "Registrar ingresos o egresos de caja" : "Abrir turno de caja"}
              >
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <span className="hidden sm:inline">{isRegisterOpen ? 'Movimientos' : 'Abrir caja'}</span>
              </Button>

              {isRegisterOpen && (
                <>
                  <div className="hidden sm:block w-px h-3.5 bg-border/50 mx-0.5" />
                  {/* Botón Detalles de Caja Resaltado */}
                  <Link href="/dashboard/pos/caja" className="hidden sm:block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-semibold bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 hover:text-blue-800 dark:hover:text-blue-200 gap-1.5 transition-all rounded-md shadow-2xs"
                      title="Ver resumen, arqueo y transacciones detalladas de caja"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span>Detalles de Caja</span>
                    </Button>
                  </Link>

                  {canViewExecutiveReports && (
                    <>
                      <div className="hidden lg:block w-px h-3.5 bg-border/50 mx-0.5" />
                      {/* Botón Reportes */}
                      <Link href="/dashboard/pos/dashboard" className="hidden lg:block">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2.5 text-xs font-medium hover:bg-background text-foreground/80 hover:text-foreground gap-1.5 transition-all rounded-md"
                          title="Ver métricas y reportes de ventas POS"
                        >
                          <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
                          <span>Reportes</span>
                        </Button>
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <SectionGuideButton guide={POS_GUIDE} />
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
          </>
        )}
      </div>
    </div>
  )
})
