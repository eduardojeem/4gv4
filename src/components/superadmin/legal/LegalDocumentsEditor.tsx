'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Eye, FilePen, FileText, History, Loader2, Save, Send, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
import { LegalContent } from '@/components/legal/LegalContent'
import {
  LEGAL_DOCUMENT_META,
  LEGAL_DOCUMENT_TYPES,
  findPlaceholders,
  responsibleDataGaps,
  responsibleSection,
  type LegalDocument,
  type LegalDocumentType,
  type LegalDocumentsState,
} from '@/lib/legal/shared'
import { DEFAULT_LEGAL_DOCUMENTS } from '@/lib/legal/defaults'
import { publishLegalDocumentAction, saveLegalDraftAction } from '@/app/superadmin/web-content/legal/actions'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-PY', { timeZone: 'America/Asuncion', dateStyle: 'medium', timeStyle: 'short' })
}

const STATUS_LABEL: Record<LegalDocument['status'], { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300' },
  published: { label: 'Publicado', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' },
  archived: { label: 'Archivado', className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' },
}

function DocumentPanel({ documentType, versions }: { documentType: LegalDocumentType; versions: LegalDocument[] }) {
  const router = useRouter()
  const published = versions.find((v) => v.status === 'published') ?? null
  const draft = versions.find((v) => v.status === 'draft') ?? null
  // Sin versiones, el primer borrador arranca del texto base en vez de vacío.
  const base = draft ?? published ?? DEFAULT_LEGAL_DOCUMENTS[documentType]

  const [title, setTitle] = useState(base.title)
  const [content, setContent] = useState(base.content)
  const [changeSummary, setChangeSummary] = useState(draft?.changeSummary ?? '')
  const [preview, setPreview] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const placeholders = useMemo(() => findPlaceholders(content), [content])
  const responsibleGaps = useMemo(() => responsibleDataGaps(content), [content])
  const insertResponsible = () => setContent((current) => `${responsibleSection(documentType)}\n\n${current.trimStart()}`)
  const dirty = !draft || title !== draft.title || content !== draft.content || changeSummary !== (draft.changeSummary ?? '')

  const save = () =>
    startTransition(async () => {
      const result = await saveLegalDraftAction({ documentType, id: draft?.id, title, content, changeSummary })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(draft ? 'Borrador guardado' : `Borrador v${(versions[0]?.version ?? 0) + 1} creado`)
      router.refresh()
    })

  const publish = () =>
    startTransition(async () => {
      if (!draft) return
      const result = await publishLegalDocumentAction(draft.id)
      setConfirmOpen(false)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Versión ${draft.version} publicada`)
      router.refresh()
    })

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="rounded-xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <FilePen className="h-4 w-4" aria-hidden />
              {draft ? `Borrador · versión ${draft.version}` : published ? 'Nueva versión (a partir de la publicada)' : 'Primer borrador'}
            </CardTitle>
            <CardDescription>
              {draft
                ? `Última edición: ${formatDate(draft.updatedAt)}. Solo se publica cuando lo confirmás.`
                : 'Al guardar se crea un borrador. La versión publicada no cambia hasta que publiques.'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPreview((v) => !v)}>
            <Eye className="h-4 w-4" /> {preview ? 'Editar' : 'Vista previa'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview ? (
            <div className="rounded-lg border p-5 dark:border-slate-800">
              <h2 className="mb-4 text-2xl font-bold">{title}</h2>
              <LegalContent content={content} title={title} />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`${documentType}-title`}>Título</Label>
                <Input id={`${documentType}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${documentType}-content`}>Contenido</Label>
                <Textarea
                  id={`${documentType}-content`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[420px] font-mono text-[13px] leading-6"
                />
                <p className="text-xs text-slate-500">
                  Formato: <code>## Título</code>, <code>### Subtítulo</code>, líneas con <code>- </code> para listas y <code>**negrita**</code>. Separá párrafos con una línea en blanco.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${documentType}-summary`}>Resumen de cambios (interno)</Label>
                <Input
                  id={`${documentType}-summary`}
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Ej.: se agregó la sección de cookies"
                  maxLength={500}
                />
              </div>
            </>
          )}

          {responsibleGaps.length > 0 && placeholders.length === 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:flex-row sm:items-center dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <UserRound className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden />
              <p className="flex-1">
                El texto no dice quién está detrás de la plataforma: falta {responsibleGaps.join(', ')}. Quien lee no sabe con quién contrata ni a quién pedir sus datos.
              </p>
              <Button type="button" size="sm" variant="outline" className="shrink-0 bg-white/70 dark:bg-transparent" onClick={insertResponsible} disabled={preview}>
                Agregar sección
              </Button>
            </div>
          )}

          {placeholders.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Faltan datos por completar ({placeholders.join(', ')}). No se puede publicar hasta reemplazarlos.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={save} disabled={pending || !dirty}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar borrador
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={pending || !draft || dirty || placeholders.length > 0}>
              <Send className="h-4 w-4" /> Publicar versión {draft?.version ?? ''}
            </Button>
          </div>
          {draft && dirty && <p className="text-right text-xs text-slate-500">Guardá los cambios antes de publicar.</p>}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Publicado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {published ? (
              <>
                <p>Versión <b>{published.version}</b> · desde {formatDate(published.publishedAt)}</p>
                <Link href={LEGAL_DOCUMENT_META[documentType].path} target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">
                  Ver página pública
                </Link>
              </>
            ) : (
              <p className="text-slate-500">
                Sin versión publicada: {LEGAL_DOCUMENT_META[documentType].path} muestra el texto base de la plataforma hasta que publiques la primera.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Versiones</CardTitle>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <p className="text-sm text-slate-500">Todavía no hay versiones.</p>
            ) : (
              <ul className="divide-y text-sm dark:divide-slate-800">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-start justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="font-semibold">v{v.version}</p>
                      <p className="text-xs text-slate-500">{formatDate(v.publishedAt ?? v.updatedAt)}</p>
                      {v.changeSummary && <p className="break-words text-xs text-slate-600 dark:text-slate-300">{v.changeSummary}</p>}
                    </div>
                    <Badge variant="outline" className={`shrink-0 rounded-full ${STATUS_LABEL[v.status].className}`}>{STATUS_LABEL[v.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Publicar la versión {draft?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              Pasa a ser el texto vigente en {LEGAL_DOCUMENT_META[documentType].path}
              {published ? ` y la versión ${published.version} queda archivada` : ''}. Confirmá que fue revisado por quien corresponda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); publish() }} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function LegalDocumentsEditor({ state }: { state: LegalDocumentsState }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Documentos legales</h1>
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Política de privacidad y términos de la plataforma. Cada cambio se guarda como borrador con número de versión; al publicar, la versión anterior queda archivada como registro. El ícono de cada pestaña avisa si el texto publicado todavía no identifica al responsable.
        </p>
      </div>

      {'reason' in state ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {state.reason}
        </p>
      ) : (
        <Tabs defaultValue="privacy" className="space-y-4">
          <TabsList className="h-auto flex-wrap">
            {LEGAL_DOCUMENT_TYPES.map((type) => {
              const versions = state.documents.filter((d) => d.documentType === type)
              const published = versions.find((v) => v.status === 'published')
              const hasDraft = versions.some((v) => v.status === 'draft')
              const needsReview = !published || responsibleDataGaps(published.content).length > 0
              return (
                <TabsTrigger key={type} value={type} className="gap-2">
                  {needsReview
                    ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                    : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />}
                  {LEGAL_DOCUMENT_META[type].label}
                  <span className="text-xs font-normal text-slate-500">
                    {published ? `v${published.version}` : 'sin publicar'}{hasDraft ? ' · borrador' : ''}
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>
          {LEGAL_DOCUMENT_TYPES.map((type) => {
            const versions = state.documents.filter((d) => d.documentType === type)
            const key = versions.map((v) => `${v.id}:${v.updatedAt}`).join('|')
            return (
              <TabsContent key={type} value={type}>
                <DocumentPanel key={key} documentType={type} versions={versions} />
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}
