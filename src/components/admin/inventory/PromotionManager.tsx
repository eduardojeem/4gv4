'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowUpRight, Percent, Plus, Store, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PromotionFilters, PromotionList, PromotionStats } from '@/components/dashboard/promotions'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'
import { usePromotions } from '@/hooks/use-promotions'
import { usePermissions } from '@/hooks/use-permissions'
import type { Promotion } from '@/types/promotion'

// El mismo modal que /dashboard/promotions: con alcance por producto o
// categoría, límites de uso e imágenes. Se carga al abrirlo.
const PromotionDialog = dynamic(
  () => import('@/components/dashboard/promotions/PromotionDialog').then((mod) => ({ default: mod.PromotionDialog })),
  { ssr: false },
)

/**
 * Promociones dentro de Inventario. Antes tenía su propio formulario reducido:
 * guardaba solo código, tipo, valor y fechas, y una promoción creada acá no
 * podía tener alcance por producto ni límite de usos. Ahora usa la misma lista,
 * filtros y modal que la sección de Promociones: lo que se hace en un lado se ve
 * igual en el otro.
 */
export function PromotionManager() {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('promotions.manage')
  const canCreate = canManage || hasPermission('promotions.create')
  const canEdit = canManage || hasPermission('promotions.update')
  const canDelete = canManage || hasPermission('promotions.delete')

  const {
    promotions,
    loading,
    stats,
    filters,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotionStatus,
    bulkUpdateStatus,
    bulkDeletePromotions,
    updateFilters,
    clearFilters,
    getPromotionStatus,
    isPromotionExpiringSoon,
    validatePromotionCode,
  } = usePromotions()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [duplicatingPromotion, setDuplicatingPromotion] = useState<Promotion | null>(null)
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null)

  const openDialog = (edit: Promotion | null, duplicate: Promotion | null = null) => {
    setEditingPromotion(edit)
    setDuplicatingPromotion(duplicate)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingPromotion) return
    if (await deletePromotion(deletingPromotion.id)) setDeletingPromotion(null)
  }

  return (
    <OrganizationModuleGate
      module="promotions"
      title="Promociones no incluidas"
      description="Descuentos, campañas y códigos promocionales para tus clientes."
    >
      <div className="space-y-5">
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Percent className="h-4 w-4 text-primary" /> Promociones
            </h3>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
              Descuentos por código o automáticos, por producto o categoría. Son las mismas que en la sección Promociones y
              se aplican en el punto de venta y en tu tienda online.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/dashboard/promotions?tab=publica"><Store className="h-3.5 w-3.5" /> Ofertas en la tienda</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/dashboard/promotions">Sección completa <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </Button>
            {canCreate && (
              <Button size="sm" className="gap-1.5" onClick={() => openDialog(null)}>
                <Plus className="h-3.5 w-3.5" /> Nueva promoción
              </Button>
            )}
          </div>
        </section>

        <PromotionStats
          stats={stats}
          loading={loading}
          onFilterClick={(status) => updateFilters({ status })}
          activeStatus={filters.status}
        />

        <PromotionFilters filters={filters} onUpdateFilters={updateFilters} onClearFilters={clearFilters} />

        <PromotionList
          promotions={promotions}
          loading={loading}
          getPromotionStatus={getPromotionStatus}
          isPromotionExpiringSoon={isPromotionExpiringSoon}
          onEdit={canEdit ? (promotion) => openDialog(promotion) : undefined}
          onDelete={canDelete ? (promotion) => setDeletingPromotion(promotion) : undefined}
          onDuplicate={canCreate ? (promotion) => openDialog(null, promotion) : undefined}
          onToggleStatus={canEdit ? (promotion) => void togglePromotionStatus(promotion.id, promotion.is_active) : undefined}
          onBulkActivate={canEdit ? (ids) => bulkUpdateStatus(ids, true) : undefined}
          onBulkDeactivate={canEdit ? (ids) => bulkUpdateStatus(ids, false) : undefined}
          onBulkDelete={canDelete ? (ids) => bulkDeletePromotions(ids) : undefined}
        />

        {dialogOpen && (
          <PromotionDialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                setEditingPromotion(null)
                setDuplicatingPromotion(null)
              }
            }}
            promotion={editingPromotion}
            duplicateFrom={duplicatingPromotion}
            onSave={createPromotion}
            onUpdate={updatePromotion}
            validateCode={validatePromotionCode}
          />
        )}

        <AlertDialog open={!!deletingPromotion} onOpenChange={(open) => !open && setDeletingPromotion(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar promoción?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La promoción «{deletingPromotion?.name}» deja de aplicarse en el punto de venta y en la tienda.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </OrganizationModuleGate>
  )
}

export default PromotionManager
