
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, User, Smartphone, Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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

  const selectedRepair = React.useMemo(
    () => repairs.find((r) => r.id === selectedRepairId),
    [repairs, selectedRepairId]
  )

  // Filter repairs client-side based on search query
  const filteredRepairs = React.useMemo(() => {
    if (!searchQuery) return repairs.slice(0, 50)
    const queryParts = normalize(searchQuery).split(/\s+/).filter(Boolean)
    if (queryParts.length === 0) return repairs.slice(0, 50)

    return repairs
      .filter((r) => {
        const searchableText = normalize(
          [
            r.customer?.name || "",
            r.device || "",
            r.brand || "",
            r.model || "",
            r.issue || "",
            r.status || "",
            r.ticketNumber || "",
            r.id || "",
          ].join(" ")
        )

        return queryParts.every((part) => searchableText.includes(part))
      })
      .slice(0, 50)
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
              {isLoading ? "Cargando reparaciones..." : "Seleccionar reparación..."}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar por cliente, equipo, ticket..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No se encontraron reparaciones.</CommandEmpty>
            <CommandGroup>
              {filteredRepairs.map((repair) => (
                <CommandItem
                  key={repair.id}
                  value={repair.id}
                  onSelect={() => {
                    handleSelect(repair.id)
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(repair.id)
                  }}
                  className="flex flex-col items-start gap-1 py-3 px-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full pointer-events-none">
                    <div className="flex items-center gap-2 font-medium">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {repair.customer?.name || "Cliente sin nombre"}
                    </div>
                    {selectedRepairId === repair.id && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground w-full pl-5.5 pointer-events-none">
                    <div className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      <span className="truncate max-w-[120px]">{repair.device}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      <span>{repair.ticketNumber || repair.id.slice(0, 8)}</span>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px] h-4">
                      {repair.status}
                    </Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
