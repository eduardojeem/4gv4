'use client'

import { useState, useEffect } from 'react'
import {
  Loader2,
  Coins,
  Zap,
  Trophy,
  Ticket,
  ClipboardList,
  ArrowRight,
  Sparkles,
  ShoppingBag,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { LOYALTY_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { useLoyalty } from '@/hooks/use-loyalty'
import { LoyaltySettingsCard } from './LoyaltySettingsCard'
import { PointRulesCard } from './PointRulesCard'
import { RafflesManager } from './RafflesManager'
import { LoyaltyModuleNotice } from './LoyaltyModuleNotice'
import { getRaffleOperationalSummary } from './loyalty-summary'
import { cn } from '@/lib/utils'

export function LoyaltyRafflesPanel({ canManage }: { canManage: boolean }) {
  const {
    settings,
    rules,
    raffles,
    loading,
    moduleInstalled,
    moduleMessage,
    saveSettings,
    createRule,
    toggleRule,
    deleteRule,
    createRaffle,
    updateRaffleStatus,
    drawRaffle,
    refresh,
  } = useLoyalty()

  const [subTab, setSubTab] = useState<'puntos' | 'sorteos' | 'resumen'>('puntos')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const section = params.get('section')
    if (section === 'puntos' || section === 'sorteos' || section === 'resumen') {
      setSubTab(section)
    }
  }, [])

  const handleSelectSubTab = (tabValue: 'puntos' | 'sorteos' | 'resumen') => {
    setSubTab(tabValue)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', 'puntos')
      url.searchParams.set('section', tabValue)
      window.history.replaceState({}, '', url.toString())
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
        Cargando puntos y sorteos...
      </div>
    )
  }

  if (!moduleInstalled) {
    return <LoyaltyModuleNotice message={moduleMessage} />
  }

  const activeRulesCount = rules.filter((r) => r.is_active).length
  const activeRafflesCount = raffles.filter((r) => r.status === 'published').length
  const operational = getRaffleOperationalSummary(raffles)

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Header con Estado en Vivo y Ciclo de Fidelización */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 p-4.5 sm:p-5 dark:border-amber-900/40 dark:from-amber-950/40 dark:via-slate-900/70 dark:to-orange-950/20 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white shadow-sm ring-4 ring-amber-500/10">
              <Coins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Programa de Puntos & Sorteos
                </h2>
                {settings?.enabled ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Puntos Habilitados en Caja
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Puntos Pausados
                  </span>
                )}
                {settings?.enabled && (
                  <Badge variant="outline" className="font-mono text-xs border-amber-500/30 bg-amber-100/50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300">
                    Gs. {Number(settings.currency_per_point).toLocaleString('es-PY')} = {settings.points_per_unit || 1} pt
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Fideliza a tus clientes premiando cada compra con puntos automáticos que luego pueden canjear por tickets para participar en sorteos certificados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SectionGuideButton guide={LOYALTY_GUIDE} buttonLabel="¿Cómo funciona el flujo?" />
          </div>
        </div>

        {/* Guía visual interactiva del ciclo de fidelidad en 3 pasos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-amber-200/50 dark:border-amber-900/30">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/90 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/60 shadow-2xs">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold">
              1
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">1. Venta & Acumulación</p>
              <p className="text-[11px] text-muted-foreground truncate">El cliente compra y suma puntos en caja</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/90 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/60 shadow-2xs">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 text-xs font-bold">
              2
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">2. Campañas Multiplicadoras</p>
              <p className="text-[11px] text-muted-foreground truncate">Puntos dobles (x2) y bonus especiales</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/90 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/60 shadow-2xs">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 text-xs font-bold">
              3
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">3. Sorteos & Premios</p>
              <p className="text-[11px] text-muted-foreground truncate">Canje por tickets numerados y sorteo en vivo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de subsecciones limpio y moderno */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-1.5 bg-slate-100/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 w-full">
          <Button
            size="sm"
            variant={subTab === 'puntos' ? 'default' : 'ghost'}
            className={cn(
              'justify-start sm:justify-center rounded-xl text-xs h-9 px-3.5 gap-2 font-medium transition-all',
              subTab === 'puntos'
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            )}
            onClick={() => handleSelectSubTab('puntos')}
          >
            <Coins className="h-4 w-4 shrink-0 text-amber-300" />
            <span className="truncate">1. Puntos por Compra</span>
            <Badge
              variant="outline"
              className={cn(
                'ml-auto sm:ml-1 text-[10px] py-0 px-1.5 font-normal',
                subTab === 'puntos'
                  ? 'border-white/30 text-white bg-white/10'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500'
              )}
            >
              {settings?.enabled ? 'Activo' : 'Pausado'}
            </Badge>
          </Button>

          <Button
            size="sm"
            variant={subTab === 'sorteos' ? 'default' : 'ghost'}
            className={cn(
              'justify-start sm:justify-center rounded-xl text-xs h-9 px-3.5 gap-2 font-medium transition-all',
              subTab === 'sorteos'
                ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            )}
            onClick={() => handleSelectSubTab('sorteos')}
          >
            <Trophy className="h-4 w-4 shrink-0 text-cyan-300" />
            <span className="truncate">2. Sorteos & Premios</span>
            <Badge
              variant="outline"
              className={cn(
                'ml-auto sm:ml-1 text-[10px] py-0 px-1.5 font-normal',
                subTab === 'sorteos'
                  ? 'border-white/30 text-white bg-white/10'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500'
              )}
            >
              {operational.open} en juego
            </Badge>
          </Button>

          <Button
            size="sm"
            variant={subTab === 'resumen' ? 'default' : 'ghost'}
            className={cn(
              'justify-start sm:justify-center rounded-xl text-xs h-9 px-3.5 gap-2 font-medium transition-all',
              subTab === 'resumen'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            )}
            onClick={() => handleSelectSubTab('resumen')}
          >
            <ClipboardList className="h-4 w-4 shrink-0 text-indigo-400" />
            <span className="truncate">3. Métricas & Diagnóstico</span>
          </Button>
        </div>
      </div>

      {/* Pestaña 1: Puntos por Compra */}
      {subTab === 'puntos' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 sm:px-4 sm:py-3 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-600 to-amber-500 text-xs font-bold text-white shadow-2xs">
                1
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Reglas de Puntos por Compra y Multiplicadores</span>
                  </h3>
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-800 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-950/50 font-medium">
                    Acreditación Automática
                  </Badge>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                  Tus clientes reciben puntos cada vez que compran en caja o en la tienda. Configura la tasa base y crea campañas promocionales con puntos dobles.
                </p>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <LoyaltySettingsCard settings={settings} onSave={saveSettings} canManage={canManage} />
          </section>

          <section className="space-y-3">
            <PointRulesCard rules={rules} onCreate={createRule} onToggle={toggleRule} onDelete={deleteRule} canManage={canManage} />
          </section>
        </div>
      )}

      {/* Pestaña 2: Sorteos y Premios */}
      {subTab === 'sorteos' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl border border-cyan-200/80 bg-cyan-50/50 p-3 sm:px-4 sm:py-3 dark:border-cyan-900/40 dark:bg-cyan-950/20 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 text-xs font-bold text-white shadow-2xs">
                2
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>Sorteos Certificados y Canje de Tickets</span>
                  </h3>
                  <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-800 dark:text-cyan-300 bg-cyan-100/50 dark:bg-cyan-950/50 font-medium">
                    Fidelización & Premios
                  </Badge>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                  Tus clientes canjean sus puntos por tickets para participar en sorteos transparentes y certificados por el sistema.
                </p>
              </div>
            </div>
          </div>

          {/* Métricas de Sorteos en Tiempo Real */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sorteos Abiertos</p>
              <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{operational.open}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Recibiendo canjes</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cierran en 7 Días</p>
              <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{operational.closingSoon}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Próximos a finalizar</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tickets Emitidos</p>
              <p className="mt-1 text-2xl font-black text-cyan-600 dark:text-cyan-400">{operational.tickets.toLocaleString('es-PY')}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Canjeados por clientes</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pendientes de Sortear</p>
              <p className="mt-1 text-2xl font-black text-indigo-600 dark:text-indigo-400">{operational.pendingDraw}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Listos para el bolillero</p>
            </div>
          </div>

          <RafflesManager
            raffles={raffles}
            onCreate={createRaffle}
            onUpdateStatus={updateRaffleStatus}
            onDraw={drawRaffle}
            onRefresh={refresh}
            canManage={canManage}
          />
        </div>
      )}

      {/* Pestaña 3: Resumen y Métricas */}
      {subTab === 'resumen' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Tarjetas de Acceso y Estado de los 3 Pilares */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-amber-200/80 bg-white p-4.5 dark:border-amber-900/30 dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tasa de Puntos</span>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {settings?.enabled
                      ? `Gs. ${Number(settings.currency_per_point).toLocaleString('es-PY')} = 1 pt`
                      : 'Desactivado'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {settings?.enabled
                  ? 'Los clientes reciben puntos automáticamente al identificarse en caja.'
                  : 'Activa la tasa para que tus ventas comiencen a acumular puntos.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold rounded-xl"
                onClick={() => handleSelectSubTab('puntos')}
              >
                <span>Configurar Tasa de Puntos</span>
                <ArrowRight className="h-3 w-3 ml-1.5" />
              </Button>
            </div>

            <div className="rounded-2xl border border-indigo-200/80 bg-white p-4.5 dark:border-indigo-900/30 dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Campañas Especiales</span>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {activeRulesCount} {activeRulesCount === 1 ? 'campaña activa' : 'campañas activas'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Multiplicadores (x2, x3) o puntos extra por compras mayores para acelerar ventas.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold rounded-xl"
                onClick={() => handleSelectSubTab('puntos')}
              >
                <span>Ver Campañas y Reglas</span>
                <ArrowRight className="h-3 w-3 ml-1.5" />
              </Button>
            </div>

            <div className="rounded-2xl border border-cyan-200/80 bg-white p-4.5 dark:border-cyan-900/30 dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sorteos & Tickets</span>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {activeRafflesCount} activos · {operational.tickets} tickets
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Sorteos con bolillero digital transparente y entrega certificada de premios.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold rounded-xl"
                onClick={() => handleSelectSubTab('sorteos')}
              >
                <span>Administrar Sorteos</span>
                <ArrowRight className="h-3 w-3 ml-1.5" />
              </Button>
            </div>
          </div>

          {/* Banner Dinámico de Diagnóstico y Siguiente Acción Recomendada */}
          <div className="rounded-2xl border border-cyan-200/80 bg-gradient-to-r from-cyan-50/70 via-white to-sky-50/40 p-4.5 sm:p-5 dark:border-cyan-900/40 dark:from-cyan-950/30 dark:via-slate-900/60 dark:to-sky-950/20 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-xs">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Siguiente paso recomendado para tu negocio
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed max-w-2xl">
                    {!settings?.enabled
                      ? 'Tu programa de puntos está desactivado. Activa la tasa base por compra en la pestaña "Puntos por Compra" para que tus clientes comiencen a acumular saldo con cada venta.'
                      : operational.pendingDraw > 0
                        ? `Tienes ${operational.pendingDraw} sorteo(s) cerrado(s) con fecha cumplida listos para realizar el sorteo transparente de ganadores en vivo.`
                        : operational.open === 0
                          ? 'No tienes ningún sorteo abierto actualmente. Crea un sorteo con premios atractivos para incentivar a tus clientes a canjear sus puntos y visitar tu negocio.'
                          : `¡Excelente! Tienes ${operational.open} sorteo(s) activo(s) y tus clientes han emitido ${operational.tickets} tickets. Recuerda promocionarlo en tus redes y en el local.`}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                className="gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold h-9 shrink-0 self-start sm:self-auto shadow-xs"
                onClick={() => {
                  if (!settings?.enabled) {
                    handleSelectSubTab('puntos')
                  } else {
                    handleSelectSubTab('sorteos')
                  }
                }}
              >
                <span>
                  {!settings?.enabled
                    ? 'Activar Puntos'
                    : operational.pendingDraw > 0
                      ? 'Realizar Sorteo'
                      : operational.open === 0
                        ? 'Crear Sorteo'
                        : 'Ver Sorteos Activos'}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Guía Práctica de Buenas Prácticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <ShoppingBag className="h-4 w-4 text-amber-600" />
                <span>¿Cómo fidelizar en el Punto de Venta (Caja / POS)?</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Al momento de cobrar, solicita el número de cédula, RUC o teléfono del cliente. El sistema asociará la venta y sumará los puntos automáticamente sin pasos extra.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Trophy className="h-4 w-4 text-cyan-600" />
                <span>Transparencia y Certificación</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cada ticket emitido tiene un número único e inalterable. Al momento de sortear, el bolillero digital utiliza criptografía demostrable y genera un certificado con hora y fecha.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
