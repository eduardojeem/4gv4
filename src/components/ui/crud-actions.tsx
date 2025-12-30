import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { IconWrapper } from "@/components/ui/standardized-components"
import { Plus, Pencil, Trash2, Filter, RefreshCw } from "lucide-react"

interface CrudActionsProps {
  onCreate?: () => void
  onEditSelected?: () => void
  onDeleteSelected?: () => void
  onRefresh?: () => void
  onFilter?: () => void
  disableEdit?: boolean
  disableDelete?: boolean
  className?: string
}

export function CrudActions({
  onCreate,
  onEditSelected,
  onDeleteSelected,
  onRefresh,
  onFilter,
  disableEdit,
  disableDelete,
  className
}: CrudActionsProps) {
  return (
    <div className={cn("flex-controls gap-normal", className)}>
      <div className="flex-normal gap-normal">
        <Button variant="default" size="sm" onClick={onCreate}>
          <IconWrapper variant="primary" size="sm" className="mr-2">
            <Plus className="icon-sm" />
          </IconWrapper>
          Crear
        </Button>
        <Button variant="secondary" size="sm" onClick={onEditSelected} disabled={disableEdit}>
          <IconWrapper size="sm" className="mr-2">
            <Pencil className="icon-sm" />
          </IconWrapper>
          Editar
        </Button>
        <Button variant="destructive" size="sm" onClick={onDeleteSelected} disabled={disableDelete}>
          <IconWrapper variant="danger" size="sm" className="mr-2">
            <Trash2 className="icon-sm" />
          </IconWrapper>
          Eliminar
        </Button>
      </div>
      <div className="flex-normal gap-normal ml-auto">
        <Button variant="ghost" size="sm" onClick={onFilter}>
          <IconWrapper size="sm" className="mr-2">
            <Filter className="icon-sm" />
          </IconWrapper>
          Filtrar
        </Button>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <IconWrapper size="sm" className="mr-2">
            <RefreshCw className="icon-sm" />
          </IconWrapper>
          Refrescar
        </Button>
      </div>
    </div>
  )
}

export default React.memo(CrudActions)