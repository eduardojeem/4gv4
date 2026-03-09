"use client"

import * as React from "react"
import { Check, ChevronsUpDown, User, Smartphone, Hash, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Repair } from "@/types/repairs"

interface RepairSelectorProps {
  repairs: Repair[]
  selectedRepairId: string | null
  onSelectRepair: (repairId: string) => void
  isLoading?: boolean
  className?: string
}

export function RepairSelector({
  repairs,
  selectedRepairId,
  onSelectRepair,
  isLoading = false,
  className,
}: RepairSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const isDisabled = isLoading && repairs.length === 0

  const normalize = React.useCallback((value: string) => {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
  }, [])

  const selectedRepair = React.useMemo(() => {
    if (!selectedRepairId) return undefined
    const normalized = selectedRepairId.toLowerCase()
    return repairs.find((repair) => repair.id.toLowerCase() === normalized)
  }, [repairs, selectedRepairId])

  const filteredRepairs = React.useMemo(() => {
    if (!searchQuery) return repairs.slice(0, 80)

    const queryParts = normalize(searchQuery).split(/\s+/).filter(Boolean)
    if (queryParts.length === 0) return repairs.slice(0, 80)

    return repairs
      .filter((repair) => {
        const searchableText = normalize(
          [
            repair.customer?.name || "",
            repair.device || "",
            repair.brand || "",
            repair.model || "",
            repair.issue || "",
            repair.status || "",
            repair.ticketNumber || "",
            repair.id || "",
          ].join(" ")
        )

        return queryParts.every((part) => searchableText.includes(part))
      })
      .slice(0, 80)
  }, [repairs, searchQuery, normalize])

  const handleSelect = React.useCallback((repairId: string) => {
    onSelectRepair(repairId)
    setOpen(false)
    setSearchQuery("")
  }, [onSelectRepair])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto py-3 px-4", className)}
          disabled={isDisabled}
        >
          {selectedRepair ? (
            <div className="flex flex-col items-start gap-1 text-left w-full overflow-hidden">
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium truncate">
                  {selectedRepair.customer?.name || "Cliente sin nombre"}
                </span>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                  {selectedRepair.ticketNumber || selectedRepair.id.slice(0, 8)}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                <Smartphone className="h-3 w-3" />
                {selectedRepair.device}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">
              {isLoading ? "Cargando reparaciones..." : "Seleccionar reparacion..."}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[340px] p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, equipo, ticket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-1">
          {filteredRepairs.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No se encontraron reparaciones.
            </div>
          ) : (
            filteredRepairs.map((repair) => {
              const isSelected = selectedRepairId?.toLowerCase() === repair.id.toLowerCase()

              return (
                <button
                  key={repair.id}
                  type="button"
                  onClick={() => handleSelect(repair.id)}
                  className="w-full text-left rounded-md px-3 py-2.5 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 font-medium truncate pr-3">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{repair.customer?.name || "Cliente sin nombre"}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground pl-5">
                    <div className="flex items-center gap-1 min-w-0">
                      <Smartphone className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[130px]">{repair.device}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Hash className="h-3 w-3" />
                      <span>{repair.ticketNumber || repair.id.slice(0, 8)}</span>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px] h-4 shrink-0">
                      {repair.status}
                    </Badge>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
