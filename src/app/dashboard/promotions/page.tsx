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
  Sparkles,
  Tag,
} from 'lucide-react'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { PROMOTIONS_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { usePromotions } from '@/hooks/use-promotions'
import type { Promotion } from '@/types/promotion'
import {
  PromotionStats,
  PromotionFilters,
  PromotionList,
  PromotionAlerts,
  PromotionAnalytics,
  OffersCarouselSettingsCard
} from '@/components/dashboard/promotions'
import { RouteGuard } from '@/components/auth/permission-guard'

// El editor arrastra dialogos y subida de imagenes: se carga solo al abrir la
// pagina de promociones, no en el bundle compartido del dashboard.
// Control de la seccion publica de ofertas (visibilidad, textos y color).
// Es el mismo editor de /admin/website: edita offers_section, la misma clave.
const OffersSectionEditor = dynamic(
  () => import('@/components/admin/website/OffersSectionEditor').then((m) => ({ default: m.OffersSectionEditor })),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-2xl border bg-muted/30" /> }
)

const OffersPromoCarouselEditor = dynamic(
  () => import('@/components/admin/website/PromotionalCarouselEditor').then((m) => ({ default: m.PromotionalCarouselEditor })),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-2xl border bg-muted/30" /> }
)
import { PlanGate } from '@/components/admin/PlanGate'
import { usePermissions } from '@/hooks/use-permissions'

// Dynamic import to avoid SSR issues with Calendar component
// Includes loading state to prevent blank screen while chunk downloads
const PromotionDialog = dynamic(
  () => import('@/components/dashboard/promotions/PromotionDialog').then(mod => ({ default: mod.PromotionDialog })),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="flex items-center gap-3 rounded-2xl border bg-card px-6 py-5 shadow-xl">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-r-transparent" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cargando editor...</p>
            <p className="text-xs text-slate-500">Preparando el formulario</p>
          </div>
        </div>
      </div>
    ),
  }
)

export default function PromotionsPage() {
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
    getTopPerformingPromotions,
    getUnusedPromotions,
    exportPromotions,
    cleanupExpiredPromotions,
    validatePromotionCode,
    getUsagePerDay,
    getQuotaPercent,
    expiringSoonArray,
    expiredActiveArray,
  } = usePromotions()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [duplicatingPromotion, setDuplicatingPromotion] = useState<Promotion | null>(null)
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null)

  // Get alerts data — derivado de allPromotions (no filtradas)
  // para que las alertas no se oculten cuando el user aplica filtros
  const expiringSoon = expiringSoonArray
  const unused = getUnusedPromotions()
  const expiredActive = expiredActiveArray

  const handleCreate = () => {
    setEditingPromotion(null)
    setDuplicatingPromotion(null)
    setDialogOpen(true)
  }

  const handleEdit = (promotion: Promotion) => {
    setDuplicatingPromotion(null)
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

  const handleDuplicate = (promotion: Promotion) => {
    // Abrir el modal precargado con la copia para revisar/ajustar antes de crear.
    setEditingPromotion(null)
    setDuplicatingPromotion(promotion)
    setDialogOpen(true)
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
      <PlanGate
        module="promotions"
        title="Promociones no está incluido en tu plan"
        description="Actualiza tu plan para crear descuentos, campañas y códigos promocionales."
      >
      <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <Tag className="h-3.5 w-3.5" />
              Marketing
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Promociones</h1>
            <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Gestioná descuentos para POS, cupones del carrito y ofertas automáticas de la tienda pública.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
              className="gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              className="gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            {expiredActive.length > 0 && canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanupExpired}
                className="gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Limpiar {expiredActive.length} expirada{expiredActive.length !== 1 ? 's' : ''}
              </Button>
            )}
            <SectionGuideButton guide={PROMOTIONS_GUIDE} />
            {canCreate && (
              <Button onClick={handleCreate} size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Nueva promoción
              </Button>
            )}
          </div>
        </header>

        {/* Control de la seccion publica de ofertas: visibilidad, textos y color */}
        {canEdit && <OffersSectionEditor />}

        {/* Carrusel de la tienda publica - se guarda en website_settings */}
        {canEdit && <OffersCarouselSettingsCard />}

        {/* Carrusel de campañas de la pagina publica de ofertas. Mismo editor y
            mismo componente publico que el banner del inicio, con sus propios
            slides bajo la clave offers_carousel. */}
        {canEdit && (
          <OffersPromoCarouselEditor
            settingKey="offers_carousel"
            title="Carrusel de la página de ofertas"
            description="Publicá campañas con imágenes y mensajes propios arriba de /ofertas"
          />
        )}

        {/* Alerts — derivadas de allPromotions para no ocultarse con filtros */}
        <PromotionAlerts
          expiringSoon={expiringSoon}
          unused={unused}
          expiredActive={expiredActive}
          onCleanupExpired={canManage ? handleCleanupExpired : undefined}
          onEdit={canEdit ? handleEdit : undefined}
          onViewAll={(alert) => updateFilters({ alert, status: 'all' })}
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
          getUsagePerDay={getUsagePerDay}
          getQuotaPercent={getQuotaPercent}
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
          onBulkActivate={canEdit ? (ids) => bulkUpdateStatus(ids, true) : undefined}
          onBulkDeactivate={canEdit ? (ids) => bulkUpdateStatus(ids, false) : undefined}
          onBulkDelete={canDelete ? (ids) => bulkDeletePromotions(ids) : undefined}
        />

        {/* Create / Edit / Duplicate Dialog */}
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
      </PlanGate>
    </RouteGuard>
  )
}

// Force client-side rendering to avoid SSR/SSG issues with Calendar component
// export const dynamic = 'force-dynamic'
