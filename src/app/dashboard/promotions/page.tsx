'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
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
  Settings,
} from 'lucide-react'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { PROMOTIONS_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { usePromotions } from '@/hooks/use-promotions'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { cn } from '@/lib/utils'
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

/** Encabezado estilizado y compacto de cada bloque de la pestaña pública */
function PublicBlockHeading({
  step,
  icon: Icon,
  title,
  description,
  badgeText,
  statusBadge,
}: {
  step: number
  icon: React.ElementType
  title: string
  description: string
  badgeText?: string
  statusBadge?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 sm:px-4 sm:py-3 dark:border-slate-800/80 dark:bg-slate-900/60 shadow-2xs">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 text-xs font-bold text-white shadow-2xs">
          {step}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>{title}</span>
            </h3>
            {badgeText && (
              <Badge variant="outline" className="text-[10px] py-0 px-2 font-medium text-cyan-700 dark:text-cyan-300 border-cyan-500/30 bg-cyan-50/50 dark:bg-cyan-950/30">
                {badgeText}
              </Badge>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {statusBadge && (
        <div className="shrink-0 self-start sm:self-auto">
          {statusBadge}
        </div>
      )}
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

  const { settings: websiteSettings } = useAdminWebsiteSettings()
  const [orgSlug, setOrgSlug] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [duplicatingPromotion, setDuplicatingPromotion] = useState<Promotion | null>(null)
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null)
  const [tab, setTab] = useState('promociones')
  const [publicSectionTab, setPublicSectionTab] = useState<'all' | 'header' | 'carousel' | 'banners'>('all')

  useEffect(() => {
    fetch('/api/onboarding/status')
      .then(r => r.json())
      .catch(() => null)
      .then((d: { organization?: { slug?: string } } | null) => {
        setOrgSlug(d?.organization?.slug || '')
      })

    const handleSlugUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail) setOrgSlug(customEvent.detail)
    }
    window.addEventListener('website-slug-updated', handleSlugUpdate)
    return () => window.removeEventListener('website-slug-updated', handleSlugUpdate)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const queryTab = params.get('tab')
    if (queryTab === 'publica' || queryTab === 'puntos' || queryTab === 'promociones') {
      setTab(queryTab)
    }
    const block = params.get('block')
    if (block === 'banners' || block === 'carousel' || block === 'header' || block === 'all') {
      setPublicSectionTab(block)
    }
  }, [])

  const offersSectionEnabled = websiteSettings?.offers_section?.enabled ?? true
  const carouselEnabled = websiteSettings?.offers_section?.carousel?.enabled ?? true
  const bannerSlidesCount = websiteSettings?.offers_carousel?.slides?.length ?? 0
  const liveOffersUrl = orgSlug ? `/${orgSlug}/ofertas` : '/ofertas'

  const handleSelectPublicTab = (subTab: 'all' | 'banners' | 'header' | 'carousel') => {
    setPublicSectionTab(subTab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', 'publica')
      if (subTab === 'all') {
        url.searchParams.delete('block')
      } else {
        url.searchParams.set('block', subTab)
      }
      window.history.replaceState({}, '', url.toString())
    }
  }

  const handleTabChange = (newTab: string) => {
    setTab(newTab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', newTab)
      if (newTab !== 'publica') {
        url.searchParams.delete('block')
      }
      window.history.replaceState({}, '', url.toString())
    }
  }

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

        <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
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
                {/* Hero / Banner principal con estado en vivo y accesos directos */}
                <div className="relative overflow-hidden rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/80 via-white to-sky-50/50 p-4 sm:p-5 dark:border-cyan-900/40 dark:from-cyan-950/40 dark:via-slate-900/70 dark:to-sky-950/30 shadow-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-white shadow-sm ring-4 ring-cyan-500/10">
                        <Store className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                            Página Pública de Ofertas
                          </h2>
                          <Badge variant="outline" className="font-mono text-xs border-cyan-500/30 bg-cyan-100/50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300">
                            {liveOffersUrl}
                          </Badge>
                          {offersSectionEnabled ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Página Visible
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Página Oculta
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                          Personaliza la experiencia de tus clientes organizando los 3 bloques en el orden real que aparecen en tu tienda web.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold h-9 shadow-2xs hover:border-cyan-500"
                      >
                        <Link href="/admin/website">
                          <Settings className="h-3.5 w-3.5 text-slate-500" />
                          <span>Configurar Sitio Web</span>
                        </Link>
                      </Button>

                      <Button
                        asChild
                        size="sm"
                        className="gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold h-9 shadow-xs"
                      >
                        <a href={liveOffersUrl} target="_blank" rel="noreferrer">
                          <span>Ver /ofertas en vivo</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Selector rápido y ordenado por pasos visuales */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 p-2 bg-slate-100/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 flex-1">
                    <Button
                      size="sm"
                      variant={publicSectionTab === 'banners' ? 'default' : 'ghost'}
                      className={cn(
                        'justify-start sm:justify-center rounded-xl text-xs h-9 px-3 gap-2 font-medium transition-all',
                        publicSectionTab === 'banners'
                          ? 'bg-cyan-600 text-white shadow-xs hover:bg-cyan-700 font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                      )}
                      onClick={() => handleSelectPublicTab('banners')}
                    >
                      <GalleryHorizontalEnd className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">1. Banners de Campaña</span>
                      <Badge variant="outline" className={cn(
                        "ml-auto sm:ml-1 text-[10px] py-0 px-1.5 font-normal",
                        publicSectionTab === 'banners'
                          ? "border-white/30 text-white bg-white/10"
                          : "border-slate-300 dark:border-slate-700 text-slate-500"
                      )}>
                        {bannerSlidesCount}
                      </Badge>
                    </Button>

                    <Button
                      size="sm"
                      variant={publicSectionTab === 'header' ? 'default' : 'ghost'}
                      className={cn(
                        'justify-start sm:justify-center rounded-xl text-xs h-9 px-3 gap-2 font-medium transition-all',
                        publicSectionTab === 'header'
                          ? 'bg-cyan-600 text-white shadow-xs hover:bg-cyan-700 font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                      )}
                      onClick={() => handleSelectPublicTab('header')}
                    >
                      <Eye className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">2. Encabezado & Estilo</span>
                      <Badge variant="outline" className={cn(
                        "ml-auto sm:ml-1 text-[10px] py-0 px-1.5 font-normal",
                        publicSectionTab === 'header'
                          ? "border-white/30 text-white bg-white/10"
                          : "border-slate-300 dark:border-slate-700 text-slate-500"
                      )}>
                        {offersSectionEnabled ? 'Activo' : 'Oculto'}
                      </Badge>
                    </Button>

                    <Button
                      size="sm"
                      variant={publicSectionTab === 'carousel' ? 'default' : 'ghost'}
                      className={cn(
                        'justify-start sm:justify-center rounded-xl text-xs h-9 px-3 gap-2 font-medium transition-all',
                        publicSectionTab === 'carousel'
                          ? 'bg-cyan-600 text-white shadow-xs hover:bg-cyan-700 font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                      )}
                      onClick={() => handleSelectPublicTab('carousel')}
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">3. Carrusel Rebajados</span>
                      <Badge variant="outline" className={cn(
                        "ml-auto sm:ml-1 text-[10px] py-0 px-1.5 font-normal",
                        publicSectionTab === 'carousel'
                          ? "border-white/30 text-white bg-white/10"
                          : "border-slate-300 dark:border-slate-700 text-slate-500"
                      )}>
                        {carouselEnabled ? 'ON' : 'OFF'}
                      </Badge>
                    </Button>
                  </div>

                  <div className="flex items-center justify-end pt-1 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-slate-800">
                    <Button
                      size="sm"
                      variant={publicSectionTab === 'all' ? 'default' : 'ghost'}
                      className={cn(
                        'w-full md:w-auto rounded-xl text-xs h-9 px-3.5 font-semibold transition-all',
                        publicSectionTab === 'all'
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      )}
                      onClick={() => handleSelectPublicTab('all')}
                    >
                      Ver Todo el Flujo
                    </Button>
                  </div>
                </div>

                {/* Paso 1: Carrusel de Banners de Campañas (Arriba de todo en la tienda) */}
                {(publicSectionTab === 'all' || publicSectionTab === 'banners') && (
                  <div className="space-y-3 animate-in fade-in-50 duration-200">
                    <PublicBlockHeading
                      step={1}
                      icon={GalleryHorizontalEnd}
                      title="Banners Publicitarios y Campañas"
                      description="Carrusel superior con diapositivas destacadas, imágenes llamativas y botones directos de compra."
                      badgeText="Banners Gráficos"
                      statusBadge={
                        <Badge variant="outline" className="text-xs font-semibold border-cyan-500/30 text-cyan-700 dark:text-cyan-300">
                          {bannerSlidesCount} / 6 banners configurados
                        </Badge>
                      }
                    />
                    <OffersPromoCarouselEditor
                      settingKey="offers_carousel"
                      title="Banners de la página de ofertas"
                      description="Publica campañas con imágenes llamativas y enlaces directos a colecciones o productos."
                    />
                  </div>
                )}

                {/* Paso 2: Configuración General y Encabezado */}
                {(publicSectionTab === 'all' || publicSectionTab === 'header') && (
                  <div className="space-y-3 animate-in fade-in-50 duration-200">
                    <PublicBlockHeading
                      step={2}
                      icon={Eye}
                      title="Encabezado y Estilo de /ofertas"
                      description="Controla la visibilidad pública de la página, título principal, descripción y paleta de colores de acento."
                      badgeText="Textos y Estilo"
                      statusBadge={
                        <Badge variant="outline" className={cn("text-xs font-semibold", offersSectionEnabled ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "border-amber-500/30 text-amber-700 dark:text-amber-400")}>
                          {offersSectionEnabled ? 'Visible al público' : 'Oculto temporalmente'}
                        </Badge>
                      }
                    />
                    <OffersSectionEditor className="max-w-none" />
                  </div>
                )}

                {/* Paso 3: Carrusel Automático de Rebajados */}
                {(publicSectionTab === 'all' || publicSectionTab === 'carousel') && (
                  <div className="space-y-3 animate-in fade-in-50 duration-200">
                    <PublicBlockHeading
                      step={3}
                      icon={Sparkles}
                      title="Carrusel de Productos Rebajados"
                      description="Vitrina interactiva que muestra automáticamente los productos de tu catálogo con mayor porcentaje de descuento."
                      badgeText="Automático en Vivo"
                      statusBadge={
                        <Badge variant="outline" className={cn("text-xs font-semibold", carouselEnabled ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "border-slate-300 text-slate-500")}>
                          {carouselEnabled ? 'Carrusel Activado' : 'Carrusel Desactivado'}
                        </Badge>
                      }
                    />
                    <OffersCarouselSettingsCard />
                  </div>
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
