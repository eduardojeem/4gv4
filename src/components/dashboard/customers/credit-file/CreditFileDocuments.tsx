import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { CreditDocumentType, CreditFileDocument } from '@/lib/credits/credit-file-contract'
import { CreditField, CreditSection, selectClass } from './fields'
type Action = (suffix: string, method: string, body: unknown) => Promise<{ cleanupPending?: boolean } | null>
export function CreditFileDocuments({ customerId, documents, version, disabled, action, draftComments, onCommentChange }: { customerId: string; documents: CreditFileDocument[]; version: number; disabled: boolean; action: Action; draftComments?: Record<string, string>; onCommentChange?: (id: string, comment: string) => void }) {
  const [type, setType] = useState<CreditDocumentType>('identity')
  const [file, setFile] = useState<File | null>(null)
  const [selectedDelete, setSelectedDelete] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const upload = async () => {
    if (!file) return
    if (!file.size || file.size > 4194304) { setMessage('Seleccioná una imagen no vacía de hasta 4 MB.'); return }
    const body = new FormData(); body.set('file', file); body.set('type', type); body.set('version', String(version))
    if (await action('/documents', 'POST', body)) { setFile(null); setMessage('Imagen cargada. Todavía requiere revisión manual.') }
  }
  return <CreditSection title="Documentos privados">
    <p className="text-sm text-muted-foreground">JPEG, PNG o WebP · hasta 4 MB · máximo 10 imágenes. PDF no está habilitado. Subir un archivo no lo verifica; no se certifica que esté libre de malware.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm">Tipo de documento<select className={selectClass} value={type} onChange={event => setType(event.target.value as CreditDocumentType)}><option value="identity">Identificación</option><option value="address">Domicilio</option><option value="income">Ingresos</option><option value="other">Otro</option></select></label>
      <CreditField label="Archivo o foto" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} />
    </div>
    <Button type="button" disabled={disabled || !file || documents.length >= 10} onClick={() => void upload()}>Subir documento ({documents.length}/10)</Button>
    <Button type="button" variant="outline" disabled={disabled} onClick={async () => { const result = await action('/documents/cleanup', 'POST', {}); if (result) setMessage(result.cleanupPending ? 'Aún hay limpieza pendiente. Reintentá más tarde.' : 'Limpieza completada.') }}>Reintentar limpieza pendiente</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
    {!documents.length && <p className="text-sm text-muted-foreground">No hay documentos cargados. Guardá la ficha antes de subir una imagen.</p>}
    {documents.map(document => <DocumentRow key={`${document.id}:${version}`} document={document} customerId={customerId} disabled={disabled} version={version} action={action} onDelete={() => setSelectedDelete(document.id)} draftComment={draftComments?.[document.id]} onCommentChange={onCommentChange} />)}
    <AlertDialog open={selectedDelete !== null} onOpenChange={open => { if (!open) setSelectedDelete(null) }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Retirar este documento?</AlertDialogTitle><AlertDialogDescription>Se retirará el acceso y dejará de contar para los requisitos. Si la ficha estaba aprobada, volverá a revisión pendiente. La deuda no cambia.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={async () => { if (!selectedDelete) return; const result = await action(`/documents/${selectedDelete}`, 'DELETE', { version }); if (result?.cleanupPending) setMessage('Documento retirado. La limpieza física requiere reintento.') }}>Retirar documento</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </CreditSection>
}
function DocumentRow({ document, customerId, disabled, version, action, onDelete, draftComment, onCommentChange }: { document: CreditFileDocument; customerId: string; disabled: boolean; version: number; action: Action; onDelete: () => void; draftComment?: string; onCommentChange?: (id: string, comment: string) => void }) {
  const [localComment, setLocalComment] = useState(document.comment)
  const comment = onCommentChange ? draftComment ?? document.comment : localComment
  return <div className="space-y-3 rounded-md border p-3">
    <p className="break-words font-medium">{document.filename}</p>
    <p className="text-sm">{document.lifecycle === 'pending' ? 'Carga incompleta: retirala y volvé a subirla.' : document.reviewStatus === 'verified' ? 'Verificado manualmente' : document.reviewStatus === 'rejected' ? 'Rechazado' : 'Pendiente de revisión'}</p>
    {document.reviewedAt && <p className="text-xs text-muted-foreground">Revisado: {new Date(document.reviewedAt).toLocaleString('es-PY')}</p>}
    <CreditField label={`Comentario para ${document.filename}`} value={comment} maxLength={1000} onChange={event => { setLocalComment(event.target.value); onCommentChange?.(document.id, event.target.value) }} />
    <div className="flex flex-wrap gap-2">
      {document.lifecycle === 'ready' && <Button asChild variant="outline"><a href={`/api/customers/${encodeURIComponent(customerId)}/credit-file/documents/${document.id}`} download>Descargar</a></Button>}
      <Button type="button" variant="outline" disabled={disabled || document.lifecycle !== 'ready'} onClick={() => void action(`/documents/${document.id}`, 'PATCH', { version, reviewStatus: 'verified', comment })}>Verificar documento</Button>
      <Button type="button" variant="outline" disabled={disabled || document.lifecycle !== 'ready'} onClick={() => void action(`/documents/${document.id}`, 'PATCH', { version, reviewStatus: 'rejected', comment })}>Rechazar documento</Button>
      <Button type="button" variant="outline" disabled={disabled} onClick={onDelete}>Retirar</Button>
    </div>
  </div>
}
