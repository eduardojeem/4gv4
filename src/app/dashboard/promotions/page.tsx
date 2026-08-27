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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Download,
  Trash2,
  Sparkles,
  Tag,
  MoreHorizontal,
  Store,
  Eye,
  GalleryHorizontalEnd,
  Percent,
  Coins,
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

const LoyaltyRafflesPanel = dynamic(
  () => import('@/components/dashboard/loyalty').then((m) => ({ default: m.LoyaltyRafflesPanel })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl border bg-muted/30" /> }
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

/** Encabezado de cada bloque de la pestaña pública: qué controla y dónde se ve. */
function PublicBlockHeading({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number
  icon: typeof Eye
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
          <Icon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  )
}

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
  const [tab, setTab] = useState('promociones')

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

  // Las alertas se resuelven editando una promocion, que vive en la primera
  // pestaña: si el usuario esta en la publica, hay que traerlo de vuelta.
  const handleAlertEdit = canEdit
    ? (promotion: Promotion) => {
        setTab('promociones')
        handleEdit(promotion)
      }
    : undefined

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
          <div className="flex flex-wrap items-center gap-2">
            <SectionGuideButton guide={PROMOTIONS_GUIDE} />
            {canCreate && (
              <Button onClick={handleCreate} size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Nueva promoción
              </Button>
            )}
            {/* Exportar y limpiar son acciones ocasionales: no compiten con la
                accion principal, pero siguen a un clic de distancia. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" aria-label="Más acciones">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Exportar promociones</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  Descargar CSV (para Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')} className="gap-2 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  Descargar JSON (respaldo)
                </DropdownMenuItem>
                {expiredActive.length > 0 && canManage && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Mantenimiento</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={handleCleanupExpired}
                      className="gap-2 text-xs text-red-600 focus:text-red-600 dark:text-red-400"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Desactivar {expiredActive.length} promoción{expiredActive.length !== 1 ? 'es' : ''} vencida{expiredActive.length !== 1 ? 's' : ''}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Alertas: quedan fuera de las pestañas porque avisan de algo que hay
            que atender, y se perderian si el usuario esta en la otra pestaña. */}
        <PromotionAlerts
          expiringSoon={expiringSoon}
          unused={unused}
          expiredActive={expiredActive}
          onCleanupExpired={canManage ? handleCleanupExpired : undefined}
          onEdit={handleAlertEdit}
          onViewAll={(alert) => {
            setTab('promociones')
            updateFilters({ alert, status: 'all' })
          }}
        />

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="promociones" className="gap-1.5 text-xs font-semibold sm:text-sm">
              <Percent className="h-3.5 w-3.5" />
              Promociones
              {stats?.total ? (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">
                  {stats.total}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="publica" className="gap-1.5 text-xs font-semibold sm:text-sm">
              <Store className="h-3.5 w-3.5" />
              Página pública
            </TabsTrigger>
            <TabsTrigger value="puntos" className="gap-1.5 text-xs font-semibold sm:text-sm">
              <Coins className="h-3.5 w-3.5" />
              Puntos y sorteos
            </TabsTrigger>
          </TabsList>

          {/* ── Trabajo diario: los descuentos ─────────────────────────── */}
          <TabsContent value="promociones" className="mt-6 flex flex-col gap-6">
            <PromotionStats stats={stats} loading={loading} />

            <PromotionFilters
              filters={filters}
              onUpdateFilters={updateFilters}
              onClearFilters={clearFilters}
            />

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

            {/* El rendimiento se lee despues de la lista: primero se opera,
                despues se analiza. */}
            <PromotionAnalytics
              topPerformers={getTopPerformingPromotions()}
              unused={unused}
              getUsagePerDay={getUsagePerDay}
              getQuotaPercent={getQuotaPercent}
            />
          </TabsContent>

          {/* ── Como se ve /ofertas ────────────────────────────────────── */}
          <TabsContent value="publica" className="mt-6 flex flex-col gap-8">
            {canEdit ? (
              <>
                <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                  Acá se configura <span className="font-semibold text-slate-700 dark:text-slate-200">cómo se ve</span> la
                  página <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">/ofertas</code> de
                  tu tienda. Los descuentos en sí se cargan en la pestaña anterior.
                </p>

                <section className="space-y-3">
                  <PublicBlockHeading
                    step={1}
                    icon={Eye}
                    title="Sección de ofertas"
                    description="Prendé o apagá la página entera, y editá su título, bajada y color de acento."
                  />
                  <OffersSectionEditor className="max-w-none" />
                </section>

                <section className="space-y-3">
                  <PublicBlockHeading
                    step={2}
                    icon={Sparkles}
                    title="Carrusel automático de productos rebajados"
                    description="Se arma solo con tus ofertas automáticas, ordenadas por mayor descuento. No se carga a mano."
                  />
                  <OffersCarouselSettingsCard />
                </section>

                <section className="space-y-3">
                  <PublicBlockHeading
                    step={3}
                    icon={GalleryHorizontalEnd}
                    title="Carrusel de campañas"
                    description="Diapositivas que armás vos: imagen, texto y botón. Hasta 6. Es distinto del carrusel del inicio y no comparte contenido."
                  />
                  <OffersPromoCarouselEditor
                    settingKey="offers_carousel"
                    title="Carrusel de la página de ofertas"
                    description="Publicá campañas con imágenes y mensajes propios arriba de /ofertas"
                  />
                </section>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <Store className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No tenés permiso para editar la página pública
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Pedile a un administrador el permiso de edición de promociones.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── Puntos y sorteos ───────────────────────────────────────── */}
          <TabsContent value="puntos" className="mt-6">
            <LoyaltyRafflesPanel canManage={canManage} />
          </TabsContent>
        </Tabs>

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
