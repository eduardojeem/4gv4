'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  EyeOff,
  HelpCircle,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { type CategoryAnalysisResult } from '@/lib/categories/category-sync-assistant'
import { cn } from '@/lib/utils'

const DISMISSED_STORAGE_KEY = 'superadmin_category_assistant_dismissed'

function getDismissedFromSession(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(DISMISSED_STORAGE_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveDismissedToSession(names: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...names]))
  } catch {
    // ignorar fallo de almacenamiento
  }
}

export function CategorySyncAssistantPanel({
  targets,
  onLinked,
  onCreated,
  sourceVersion,
}: {
  targets: Array<{ id: string; label: string }>
  onLinked: () => void
  onCreated: () => void
  sourceVersion: number
}) {
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState<CategoryAnalysisResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'alta' | 'review' | 'sin coincidencia'>('all')
  const [search, setSearch] = useState('')
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissedFromSession)
  const [saveAlias, setSaveAlias] = useState(true)
  const [actingName, setActingName] = useState<string | null>(null)

  // Diálogo para elegir otra categoría
  const [pickingAlternativeFor, setPickingAlternativeFor] = useState<CategoryAnalysisResult | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')

  // Diálogo de confirmación masiva de alta confianza
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkLinking, setBulkLinking] = useState(false)
  const latestSourceVersion = useRef(sourceVersion)
  const analysisRequestId = useRef(0)

  // Cualquier recarga del catálogo invalida el análisis anterior. Las
  // sugerencias nunca sobreviven a cambios de nombres, padres o vínculos.
  useEffect(() => {
    latestSourceVersion.current = sourceVersion
    analysisRequestId.current += 1
    setAnalyzing(false)
    setResults(null)
    setError(null)
    setPickingAlternativeFor(null)
    setShowBulkConfirm(false)
  }, [sourceVersion])

  // Ejecución manual del análisis bajo demanda (no se ejecuta al montar)
  const handleAnalyze = useCallback(async () => {
    const analyzedSourceVersion = latestSourceVersion.current
    const requestId = ++analysisRequestId.current
    setAnalyzing(true)
    setError(null)
    try {
      const response = await fetch('/api/superadmin/global-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze-unlinked', limit: 150 }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo completar el análisis de categorías.')
      }
      if (latestSourceVersion.current !== analyzedSourceVersion || analysisRequestId.current !== requestId) return
      setResults(payload.data ?? [])
      toast.success('Análisis completado', {
        description: `Se evaluaron ${payload.groupsAnalyzed ?? 0} grupos de categorías con el motor de reglas.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al analizar categorías'
      setError(msg)
      toast.error(msg)
    } finally {
      if (analysisRequestId.current === requestId) setAnalyzing(false)
    }
  }, [])

  const handleDismiss = (name: string) => {
    const next = new Set(dismissed)
    next.add(name)
    setDismissed(next)
    saveDismissedToSession(next)
    toast.info(`«${name}» omitido para esta sesión`, {
      description: 'Podés restablecer los elementos descartados en cualquier momento.',
    })
  }

  const handleResetDismissed = () => {
    const empty = new Set<string>()
    setDismissed(empty)
    saveDismissedToSession(empty)
    toast.success('Se restablecieron las categorías descartadas.')
  }

  const handleLinkSingle = async (item: CategoryAnalysisResult, targetId: string) => {
    setActingName(item.unlinkedName)
    try {
      const response = await fetch('/api/superadmin/global-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link-to',
          targetId,
          ids: item.ids,
          alias: saveAlias ? item.unlinkedName : null,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo vincular.')

      const targetLabel = targets.find((t) => t.id === targetId)?.label ?? 'la categoría'
      toast.success(`«${item.unlinkedName}» vinculada a ${targetLabel}`)

      // Quitar de la vista actual
      setResults((prev) => (prev ? prev.filter((r) => r.unlinkedName !== item.unlinkedName) : null))
      onLinked()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo vincular la categoría.')
    } finally {
      setActingName(null)
      setPickingAlternativeFor(null)
    }
  }

  const handleCreateInCatalog = async (item: CategoryAnalysisResult) => {
    setActingName(item.unlinkedName)
    try {
      const response = await fetch('/api/superadmin/global-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-from-tenant',
          entries: [{ name: item.unlinkedName, ids: item.ids }],
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo crear en el catálogo.')

      toast.success(`«${item.unlinkedName}» creada en la taxonomía global y vinculada`)
      setResults((prev) => (prev ? prev.filter((r) => r.unlinkedName !== item.unlinkedName) : null))
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la categoría.')
    } finally {
      setActingName(null)
    }
  }

  const handleBulkLinkHighConfidence = async () => {
    if (!results) return
    const highConfidenceItems = results.filter(
      (r) => !dismissed.has(r.unlinkedName) && r.confidence === 'alta' && r.bestMatch,
    )
    if (highConfidenceItems.length === 0) return

    setBulkLinking(true)
    try {
      const response = await fetch('/api/superadmin/global-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link-analyzed-batch',
          entries: highConfidenceItems.map((item) => ({
            targetId: item.bestMatch!.targetId,
            name: item.unlinkedName,
            ids: item.ids,
            alias: saveAlias ? item.unlinkedName : null,
          })),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'El lote cambió desde el análisis y no se vinculó nada.')
      }

      toast.success(`Vinculación masiva completada: ${payload.linked ?? 0} fichas vinculadas`)

      setShowBulkConfirm(false)
      setResults(null)
      onLinked()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo completar la vinculación masiva.')
    } finally {
      setBulkLinking(false)
    }
  }

  // Filtrado y búsqueda
  const visibleResults = useMemo(() => {
    if (!results) return []
    const needle = search.trim().toLowerCase()

    return results.filter((item) => {
      if (dismissed.has(item.unlinkedName)) return false

      if (filterConfidence === 'alta' && item.confidence !== 'alta') return false
      if (filterConfidence === 'review' && item.confidence !== 'media' && item.confidence !== 'baja') return false
      if (filterConfidence === 'sin coincidencia' && item.confidence !== 'sin coincidencia') return false

      if (!needle) return true
      return (
        item.unlinkedName.toLowerCase().includes(needle) ||
        item.bestMatch?.targetName.toLowerCase().includes(needle) ||
        item.organizations.some((org) => org.toLowerCase().includes(needle))
      )
    })
  }, [results, dismissed, filterConfidence, search])

  const highConfidenceCount = useMemo(() => {
    if (!results) return 0
    return results.filter((r) => !dismissed.has(r.unlinkedName) && r.confidence === 'alta' && r.bestMatch).length
  }, [results, dismissed])

  const reviewCount = useMemo(() => {
    if (!results) return 0
    return results.filter(
      (r) => !dismissed.has(r.unlinkedName) && (r.confidence === 'media' || r.confidence === 'baja'),
    ).length
  }, [results, dismissed])

  const noMatchCount = useMemo(() => {
    if (!results) return 0
    return results.filter((r) => !dismissed.has(r.unlinkedName) && r.confidence === 'sin coincidencia').length
  }, [results, dismissed])

  return (
    <section
      aria-label="Asistente de sincronización de categorías"
      className="rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-background to-card p-4 sm:p-5 shadow-sm"
    >
      {/* Cabecera del Asistente */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-500/20 p-2.5 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-base">Asistente Local de Categorías</h3>
              <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                100% Determinista · Sin costo
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Analiza las categorías no vinculadas de las tiendas, detecta variantes ortográficas y sugiere vínculos con explicación clara.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dismissed.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDismissed}
              className="text-xs text-muted-foreground h-9 gap-1"
            >
              <EyeOff className="h-3.5 w-3.5" />
              Restablecer {dismissed.size} descartados
            </Button>
          )}

          <Button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9 px-4 font-medium"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {results ? 'Volver a analizar' : 'Analizar categorías'}
          </Button>
        </div>
      </div>

      {error && !analyzing && (
        <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Estado previo al análisis */}
      {!results && !analyzing && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          <p>Presioná <strong>«Analizar categorías»</strong> para comparar los nombres de las tiendas con la taxonomía global activa.</p>
        </div>
      )}

      {/* Cargando */}
      {analyzing && (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm font-medium text-foreground">Analizando similitud de nombres, alias y rubros...</p>
          <p className="text-xs text-muted-foreground">Procesamiento seguro en servidor sin servicios externos.</p>
        </div>
      )}

      {/* Resultados del análisis */}
      {results && !analyzing && (
        <div className="mt-4 space-y-4">
          {/* Barra de herramientas, filtros y vinculación masiva */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Button
                size="sm"
                variant={filterConfidence === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterConfidence('all')}
                className="h-7 px-2.5 text-xs"
              >
                Todas ({results.length - dismissed.size})
              </Button>
              <Button
                size="sm"
                variant={filterConfidence === 'alta' ? 'default' : 'outline'}
                onClick={() => setFilterConfidence('alta')}
                className="h-7 px-2.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              >
                Alta confianza ({highConfidenceCount})
              </Button>
              <Button
                size="sm"
                variant={filterConfidence === 'review' ? 'default' : 'outline'}
                onClick={() => setFilterConfidence('review')}
                className="h-7 px-2.5 text-xs text-amber-700 dark:text-amber-400 border-amber-500/30"
              >
                Revisar ({reviewCount})
              </Button>
              <Button
                size="sm"
                variant={filterConfidence === 'sin coincidencia' ? 'default' : 'outline'}
                onClick={() => setFilterConfidence('sin coincidencia')}
                className="h-7 px-2.5 text-xs text-muted-foreground"
              >
                Sin coincidencia ({noMatchCount})
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar en resultados..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {highConfidenceCount > 0 && (
                <Button
                  size="sm"
                  onClick={() => setShowBulkConfirm(true)}
                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Vincular {highConfidenceCount} seguras
                </Button>
              )}
            </div>
          </div>

          {/* Opciones globales */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-y border-border/40 py-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveAlias}
                onChange={(e) => setSaveAlias(e.target.checked)}
                className="rounded border-border text-indigo-600 focus:ring-indigo-500"
              />
              <span>Guardar nombre de la tienda como alias para auto-vincular en el futuro</span>
            </label>
            <span>Mostrando {visibleResults.length} sugerencias</span>
          </div>

          {/* Lista de sugerencias */}
          {visibleResults.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay categorías que coincidan con el filtro actual.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {visibleResults.map((item) => {
                const isBusy = actingName === item.unlinkedName
                const conf = item.confidence

                return (
                  <div
                    key={item.unlinkedName}
                    className={cn(
                      'rounded-xl border p-3 transition-colors text-sm',
                      conf === 'alta' && 'border-emerald-500/30 bg-emerald-500/5',
                      conf === 'media' && 'border-amber-500/30 bg-amber-500/5',
                      conf === 'baja' && 'border-orange-500/30 bg-orange-500/5',
                      conf === 'sin coincidencia' && 'border-border/60 bg-muted/20',
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Lado izquierdo: origen -> destino sugerido */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground text-base">{item.unlinkedName}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {item.count} {item.count === 1 ? 'ficha' : 'fichas'} · {item.organizations.join(', ') || 'Tienda'}
                          </span>

                          {/* Badge de confianza */}
                          {conf === 'alta' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Confianza alta ({item.bestMatch?.score}%)
                            </span>
                          )}
                          {conf === 'media' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" /> Revisar ({item.bestMatch?.score}%)
                            </span>
                          )}
                          {conf === 'baja' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
                              <HelpCircle className="h-3 w-3" /> Coincidencia baja ({item.bestMatch?.score}%)
                            </span>
                          )}
                          {conf === 'sin coincidencia' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                              <XCircle className="h-3 w-3" /> Sin coincidencia en catálogo
                            </span>
                          )}
                        </div>

                        {/* Detalle de recomendación */}
                        {item.bestMatch ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Sugerida:</span>
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              {item.bestMatch.targetParentName && (
                                <span className="text-muted-foreground font-normal">{item.bestMatch.targetParentName} ›</span>
                              )}
                              {item.bestMatch.targetName}
                            </span>

                            {/* Razones legibles */}
                            <div className="flex flex-wrap gap-1 items-center">
                              {item.reasons.map((r, idx) => (
                                <span key={idx} className="rounded bg-background/80 border border-border/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No existe una categoría semejante activa. Se sugiere crearla como categoría global o elegir una alternativa.
                          </p>
                        )}

                        {/* Alternativas adicionales (hasta 2) */}
                        {item.alternatives.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
                            <span className="text-muted-foreground text-[11px]">Alternativas:</span>
                            {item.alternatives.map((alt) => (
                              <button
                                key={alt.targetId}
                                type="button"
                                onClick={() => handleLinkSingle(item, alt.targetId)}
                                disabled={isBusy}
                                className="rounded border border-border bg-background hover:bg-muted/80 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors"
                              >
                                {alt.targetParentName ? `${alt.targetParentName} › ` : ''}{alt.targetName} ({alt.score}%)
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Lado derecho: Botones de Acción */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:self-center shrink-0">
                        {item.bestMatch && (
                          <Button
                            size="sm"
                            onClick={() => handleLinkSingle(item, item.bestMatch!.targetId)}
                            disabled={isBusy}
                            className="h-8 gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                            Vincular
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPickingAlternativeFor(item)
                            setSelectedTargetId(item.bestMatch?.targetId ?? targets[0]?.id ?? '')
                          }}
                          disabled={isBusy}
                          className="h-8 text-xs"
                        >
                          Elegir otra
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateInCatalog(item)}
                          disabled={isBusy}
                          className="h-8 gap-1 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Crear nueva
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismiss(item.unlinkedName)}
                          disabled={isBusy}
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          title="Ocultar para esta sesión"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Diálogo para Elegir Otra Categoría */}
      <Dialog open={Boolean(pickingAlternativeFor)} onOpenChange={(open) => !open && setPickingAlternativeFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Elegir categoría global para vincular</DialogTitle>
            <DialogDescription>
              Seleccioná a qué categoría de la taxonomía asociar las fichas de «{pickingAlternativeFor?.unlinkedName}».
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <label className="text-xs font-semibold text-foreground">Categoría de destino:</label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickingAlternativeFor(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pickingAlternativeFor && selectedTargetId) {
                  void handleLinkSingle(pickingAlternativeFor, selectedTargetId)
                }
              }}
              disabled={!selectedTargetId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Confirmar vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación Masiva */}
      <Dialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar vinculación masiva segura</DialogTitle>
            <DialogDescription>
              Se vincularán automáticamente las <strong>{highConfidenceCount}</strong> categorías con nivel de <strong>confianza alta</strong> (coincidencia inequívoca de nombre, sinónimos oficiales o alias).
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
            <p>✓ Ninguna categoría dudosa o ambigua será alterada.</p>
            <p>✓ Cada acción queda registrada en la auditoría del SuperAdmin.</p>
            {saveAlias && <p>✓ Los nombres se guardarán como alias para auto-vincular automáticamente en futuras importaciones.</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkConfirm(false)} disabled={bulkLinking}>
              Cancelar
            </Button>
            <Button
              onClick={handleBulkLinkHighConfidence}
              disabled={bulkLinking}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {bulkLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Vincular {highConfidenceCount} categorías ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
