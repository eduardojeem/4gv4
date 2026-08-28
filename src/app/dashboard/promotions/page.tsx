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
  ExternalLink,
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

/** Encabezado estilizado de cada bloque de la pestaña pública */
function PublicBlockHeading({
  step,
  icon: Icon,
  title,
  description,
  badgeText,
}: {
  step: number
  icon: typeof Eye
  title: string
  description: string
  badgeText?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 sm:p-4 dark:border-slate-800/80 dark:bg-slate-900/40">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 text-xs font-extrabold text-white shadow-xs">
        {step}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            {title}
          </h2>
          {badgeText && (
            <Badge variant="outline" className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 border-cyan-500/30 bg-cyan-50/50 dark:bg-cyan-950/30">
              {badgeText}
            </Badge>
          )}
        </div>
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
  const [publicSectionTab, setPublicSectionTab] = useState<'all' | 'header' | 'carousel' | 'banners'>('all')

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
        {/* Header con estilo moderno y acceso rápido */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-cyan-50/30 p-5 sm:p-6 dark:border-slate-800/80 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-cyan-950/20 shadow-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              <Tag className="h-3.5 w-3.5" />
              Marketing & Ventas
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Promociones y Cupones
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Gestioná descuentos automáticos para POS, cupones de compra en tienda web y campañas de fidelización.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SectionGuideButton guide={PROMOTIONS_GUIDE} />
            {canCreate && (
              <Button
                onClick={handleCreate}
                size="sm"
                className="gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-md shadow-cyan-600/20 px-4 h-9 text-xs active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Nueva promoción
              </Button>
            )}
            {/* Exportar y limpiar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-9 rounded-xl p-0" aria-label="Más acciones">
                  <MoreHorizontal className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg">
                <DropdownMenuLabel className="text-xs">Exportar promociones</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 text-xs cursor-pointer">
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  Descargar CSV (para Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')} className="gap-2 text-xs cursor-pointer">
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  Descargar JSON (respaldo)
                </DropdownMenuItem>
                {expiredActive.length > 0 && canManage && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Mantenimiento</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={handleCleanupExpired}
                      className="gap-2 text-xs text-rose-600 focus:text-rose-600 dark:text-rose-400 cursor-pointer"
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

        {/* Alertas */}
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
          <TabsList className="grid w-full max-w-2xl grid-cols-3 bg-slate-100/90 p-1 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-xl h-11">
            <TabsTrigger value="promociones" className="gap-1.5 text-xs font-semibold sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
              <Percent className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              Promociones
              {stats?.total ? (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-bold">
                  {stats.total}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="publica" className="gap-1.5 text-xs font-semibold sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
              <Store className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Página pública
            </TabsTrigger>
            <TabsTrigger value="puntos" className="gap-1.5 text-xs font-semibold sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
              <Coins className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Puntos y sorteos
            </TabsTrigger>
          </TabsList>

          {/* ── Trabajo diario: los descuentos ─────────────────────────── */}
          <TabsContent value="promociones" className="mt-6 flex flex-col gap-6">
            <PromotionStats
              stats={stats}
              loading={loading}
              onFilterClick={(status) => updateFilters({ status })}
              activeStatus={filters.status}
            />

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
          <TabsContent value="publica" className="mt-6 flex flex-col gap-6">
            {canEdit ? (
              <>
                {/* Banner de acceso rápido e información clara */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-cyan-200/80 bg-gradient-to-r from-cyan-50/70 via-white to-sky-50/40 p-4 sm:p-5 dark:border-cyan-900/40 dark:from-cyan-950/30 dark:via-slate-900/60 dark:to-sky-950/20 shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-cyan-600 text-white text-[10px] font-bold">
                        Página Pública de Ofertas
                      </Badge>
                      <span className="text-xs font-mono text-slate-500">/ofertas</span>
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
                      Diseño y Experiencia de Ofertas en tu Tienda Web
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                      Configura cómo tus clientes ven los banners, carruseles de productos rebajados y textos en la página de ofertas. Los descuentos en sí se administran en la pestaña &quot;Promociones&quot;.
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="gap-2 shrink-0 rounded-xl bg-white dark:bg-slate-900 text-xs font-semibold h-9 shadow-xs hover:border-cyan-500"
                  >
                    <a href="/ofertas" target="_blank" rel="noreferrer">
                      <Store className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                      Ver /ofertas en vivo
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </Button>
                </div>

                {/* Selector rápido de sección para no tener que hacer scroll infinito */}
                <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 px-2 uppercase">Filtrar Vista:</span>
                  <Button
                    size="sm"
                    variant={publicSectionTab === 'all' ? 'default' : 'ghost'}
                    className={`rounded-xl text-xs h-7.5 px-3 font-bold ${
                      publicSectionTab === 'all'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    onClick={() => setPublicSectionTab('all')}
                  >
                    Mostrar Todo (3 Pasos)
                  </Button>
                  <Button
                    size="sm"
                    variant={publicSectionTab === 'header' ? 'default' : 'ghost'}
                    className={`rounded-xl text-xs h-7.5 px-3 font-bold ${
                      publicSectionTab === 'header'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    onClick={() => setPublicSectionTab('header')}
                  >
                    1. Encabezado & Colores
                  </Button>
                  <Button
                    size="sm"
                    variant={publicSectionTab === 'carousel' ? 'default' : 'ghost'}
                    className={`rounded-xl text-xs h-7.5 px-3 font-bold ${
                      publicSectionTab === 'carousel'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    onClick={() => setPublicSectionTab('carousel')}
                  >
                    2. Carrusel de Rebajados
                  </Button>
                  <Button
                    size="sm"
                    variant={publicSectionTab === 'banners' ? 'default' : 'ghost'}
                    className={`rounded-xl text-xs h-7.5 px-3 font-bold ${
                      publicSectionTab === 'banners'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    onClick={() => setPublicSectionTab('banners')}
                  >
                    3. Banners Publicitarios
                  </Button>
                </div>

                {/* Bloque 1: Configuración General */}
                {(publicSectionTab === 'all' || publicSectionTab === 'header') && (
                  <section className="space-y-3">
                    <PublicBlockHeading
                      step={1}
                      icon={Eye}
                      title="Sección y Encabezado de /ofertas"
                      description="Activa o desactiva la página pública entera, y personaliza su título, descripción y color de acento."
                      badgeText="Configuración General"
                    />
                    <OffersSectionEditor className="max-w-none" />
                  </section>
                )}

                {/* Bloque 2: Carrusel Automático de Rebajados */}
                {(publicSectionTab === 'all' || publicSectionTab === 'carousel') && (
                  <section className="space-y-3">
                    <PublicBlockHeading
                      step={2}
                      icon={Sparkles}
                      title="Carrusel Automático de Productos Rebajados"
                      description="Se alimenta solo con tus ofertas automáticas activas, ordenadas de mayor a menor descuento."
                      badgeText="Automático en Vivo"
                    />
                    <OffersCarouselSettingsCard />
                  </section>
                )}

                {/* Bloque 3: Carrusel de Banners de Campañas */}
                {(publicSectionTab === 'all' || publicSectionTab === 'banners') && (
                  <section className="space-y-3">
                    <PublicBlockHeading
                      step={3}
                      icon={GalleryHorizontalEnd}
                      title="Carrusel de Banners y Campañas Gráficas"
                      description="Publica diapositivas publicitarias diseñadas por ti (imagen, texto y botón de compra). Hasta 6 banners."
                      badgeText="Banners Personalizados"
                    />
                    <OffersPromoCarouselEditor
                      settingKey="offers_carousel"
                      title="Banners de la página de ofertas"
                      description="Publica campañas con imágenes llamativas y enlaces directos a categorías en /ofertas"
                    />
                  </section>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
                <Store className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                  No tienes permisos para editar la página pública
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Solicita a un administrador el permiso de edición de promociones y sitio web.
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
