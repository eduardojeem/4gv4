"use client"

/**
 * ImprovedActionButtons
 * 
 * Botones de acción mejorados con:
 * - Botón "Nuevo Cliente" más prominente
 * - Iconos más descriptivos
 * - Tooltips informativos
 * - Estados disabled claros
 * - Agrupación lógica de acciones
 * - Animaciones suaves
 */

import React from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  UserPlus,
  Download,
  Upload,
  RefreshCw,
  MoreVertical,
  FileText,
  Mail,
  Settings,
  Grid,
  List,
  Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ImprovedActionButtonsProps {
  onAddCustomer?: () => void
  onExport?: () => void
  onImport?: () => void
  onRefresh?: () => void
  onSendMessage?: () => void
  onGenerateReport?: () => void
  viewMode?: "table" | "grid" | "timeline"
  onViewModeChange?: (mode: "table" | "grid" | "timeline") => void
  isRefreshing?: boolean
  disabled?: boolean
  compact?: boolean
}

export function ImprovedActionButtons({
  onAddCustomer,
  onExport,
  onImport,
  onRefresh,
  onSendMessage,
  onGenerateReport,
  viewMode = "table",
  onViewModeChange,
  isRefreshing = false,
  disabled = false,
  compact = false
}: ImprovedActionButtonsProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Primary Action: Add Customer */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={onAddCustomer}
                disabled={disabled}
                size={compact ? "default" : "lg"}
                className={cn(
                  "gap-2 font-semibold shadow-lg transition-all duration-200",
                  "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
                  "hover:shadow-xl hover:shadow-blue-500/30",
                  compact ? "text-sm px-4" : "text-base px-6"
                )}
              >
                <UserPlus className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
                <span className="hidden sm:inline">Nuevo Cliente</span>
                <span className="sm:hidden">Nuevo</span>
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Agregar un nuevo cliente</p>
            <p className="text-xs text-gray-400 mt-1">Atajo: Ctrl+N</p>
          </TooltipContent>
        </Tooltip>

        {/* View Mode Selector */}
        {onViewModeChange && (
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeChange("table")}
                  className={cn(
                    "gap-1",
                    viewMode === "table" && "shadow-sm"
                  )}
                >
                  <List className="h-4 w-4" />
                  {!compact && <span className="hidden md:inline text-xs">Tabla</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vista de tabla</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeChange("grid")}
                  className={cn(
                    "gap-1",
                    viewMode === "grid" && "shadow-sm"
                  )}
                >
                  <Grid className="h-4 w-4" />
                  {!compact && <span className="hidden md:inline text-xs">Grid</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vista de cuadrícula</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === "timeline" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeChange("timeline")}
                  className={cn(
                    "gap-1",
                    viewMode === "timeline" && "shadow-sm"
                  )}
                >
                  <Calendar className="h-4 w-4" />
                  {!compact && <span className="hidden md:inline text-xs">Timeline</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vista de línea de tiempo</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={compact ? "default" : "lg"}
                onClick={onRefresh}
                disabled={disabled || isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={cn(
                  compact ? "h-4 w-4" : "h-5 w-5",
                  isRefreshing && "animate-spin"
                )} />
                <span className="hidden lg:inline">Actualizar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Actualizar lista de clientes</p>
              <p className="text-xs text-gray-400 mt-1">Atajo: F5</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size={compact ? "default" : "lg"}
                  disabled={disabled}
                  className="gap-2"
                >
                  <MoreVertical className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
                  <span className="hidden xl:inline">Más acciones</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Más opciones</TooltipContent>
          </Tooltip>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {onExport && (
              <DropdownMenuItem onClick={onExport} className="gap-2">
                <Download className="h-4 w-4" />
                <span>Exportar clientes</span>
                <span className="ml-auto text-xs text-gray-400">CSV, Excel</span>
              </DropdownMenuItem>
            )}

            {onImport && (
              <DropdownMenuItem onClick={onImport} className="gap-2">
                <Upload className="h-4 w-4" />
                <span>Importar clientes</span>
                <span className="ml-auto text-xs text-gray-400">CSV, Excel</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {onSendMessage && (
              <DropdownMenuItem onClick={onSendMessage} className="gap-2">
                <Mail className="h-4 w-4" />
                <span>Enviar mensaje masivo</span>
              </DropdownMenuItem>
            )}

            {onGenerateReport && (
              <DropdownMenuItem onClick={onGenerateReport} className="gap-2">
                <FileText className="h-4 w-4" />
                <span>Generar reporte</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" />
              <span>Configuración</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  )
}
