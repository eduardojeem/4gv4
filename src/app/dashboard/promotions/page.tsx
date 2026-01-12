'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
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
import {
  Plus,
  Download,
  Trash2,
  Sparkles
} from 'lucide-react'
import { usePromotions } from '@/hooks/use-promotions'
import type { Promotion } from '@/types/promotion'
import {
  PromotionStats,
  PromotionFilters,
  PromotionList,
  PromotionAlerts,
  PromotionAnalytics
} from '@/components/dashboard/promotions'
import { toast } from 'sonner'
import { RouteGuard } from '@/components/auth/permission-guard'
import { usePermissions } from '@/hooks/use-permissions'

// Dynamic import to avoid SSR issues with Calendar component
const PromotionDialog = dynamic(
  () => import('@/components/dashboard/promotions/PromotionDialog').then(mod => ({ default: mod.PromotionDialog })),
  { ssr: false }
)

export default function PromotionsPage() {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('promotions.manage') || hasPermission('products.manage')
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
    duplicatePromotion,
    togglePromotionStatus,
    updateFilters,
    clearFilters,
    getPromotionStatus,
    isPromotionExpiringSoon,
    getTopPerformingPromotions,
    getUnusedPromotions,
    exportPromotions,
    cleanupExpiredPromotions,
    validatePromotionCode,
    calculateEffectiveness
  } = usePromotions()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null)

  // Get alerts data
  const expiringSoon = promotions.filter(p => isPromotionExpiringSoon(p))
  const unused = getUnusedPromotions()
  const expiredActive = promotions.filter(p => {
    const status = getPromotionStatus(p)
    return status === 'expired' && p.is_active
  })

  const handleCreate = () => {
    setEditingPromotion(null)
    setDialogOpen(true)
  }

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingPromotion) return
    const success = await deletePromotion(deletingPromotion.id)
    if (success) {
      setDeletingPromotion(null)
    }
  }

  const handleDuplicate = async (promotion: Promotion) => {
    await duplicatePromotion(promotion)
  }

  const handleToggleStatus = async (promotion: Promotion) => {
    await togglePromotionStatus(promotion.id, promotion.is_active)
  }

  const handleExport = (format: 'json' | 'csv') => {
    exportPromotions(format)
  }

  const handleCleanupExpired = async () => {
    await cleanupExpiredPromotions()
  }

  return (
    <RouteGuard route="/dashboard/promotions">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Promociones</h1>
            <p className="text-muted-foreground">
              Gestiona descuentos, cupones y ofertas especiales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            {expiredActive.length > 0 && canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanupExpired}
                className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
              >
                <Sparkles className="h-4 w-4" />
                Limpiar Expiradas
              </Button>
            )}
            {canCreate && (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Promoción
            </Button>
            )}
          </div>
        </div>

        {/* Alerts */}
        <PromotionAlerts
          promotions={promotions}
          expiringSoon={expiringSoon}
          unused={unused}
          expiredActive={expiredActive}
          onCleanupExpired={canManage ? handleCleanupExpired : undefined}
          onEdit={canEdit ? handleEdit : undefined}
        />

        {/* Stats */}
        <PromotionStats stats={stats} loading={loading} />

        {/* Filters */}
        <PromotionFilters
          filters={filters}
          onUpdateFilters={updateFilters}
          onClearFilters={clearFilters}
        />

        {/* Analytics */}
        <PromotionAnalytics
          topPerformers={getTopPerformingPromotions()}
          unused={unused}
          calculateEffectiveness={calculateEffectiveness}
        />

        {/* Promotions List */}
        <PromotionList
          promotions={promotions}
          loading={loading}
          getPromotionStatus={getPromotionStatus}
          isPromotionExpiringSoon={isPromotionExpiringSoon}
          onEdit={canEdit ? handleEdit : undefined}
          onDelete={canDelete ? (promo) => setDeletingPromotion(promo) : undefined}
          onDuplicate={canCreate ? handleDuplicate : undefined}
          onToggleStatus={canEdit ? handleToggleStatus : undefined}
        />

        {/* Create/Edit Dialog */}
        <PromotionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          promotion={editingPromotion}
          onSave={createPromotion}
          onUpdate={updatePromotion}
          validateCode={validatePromotionCode}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={!!deletingPromotion}
          onOpenChange={(open) => !open && setDeletingPromotion(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar promoción?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La promoción &quot;{deletingPromotion?.name}&quot; será
                eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RouteGuard>
  )
}

// Force client-side rendering to avoid SSR/SSG issues with Calendar component
// export const dynamic = 'force-dynamic'