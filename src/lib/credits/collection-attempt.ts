import { z } from 'zod'
import { collectionResultSchema, type CollectionResult } from './collection-contract'
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const attemptSchema = z.object({
  endpoint: z.string().regex(/^\/api\/(?:credits|customers\/[0-9a-f-]+\/collect-payment)$/i),
  payload: z.record(z.string(), z.unknown()), fingerprint: z.string(),
})
type Attempt = z.infer<typeof attemptSchema>
export class CollectionAttemptError extends Error {
  constructor(message: string, public readonly uncertain: boolean) { super(message); this.name='CollectionAttemptError' }
}
const keyFor = (scope: string) => 'collection-attempt:v1:' + scope
const inFlight = new Map<string, Promise<{ collection: CollectionResult; response: Record<string, unknown> }>>()

export function pendingCollectionAttempt(scope: string, storage: StorageLike = sessionStorage): Attempt | null {
  const raw=storage.getItem(keyFor(scope))
  if (!raw) return null
  let parsed: unknown
  try { parsed=JSON.parse(raw) } catch { throw new CollectionAttemptError('El intento guardado no se puede leer. Revisá el historial de cobros antes de continuar.',true) }
  const result=attemptSchema.safeParse(parsed)
  if (!result.success) throw new CollectionAttemptError('El intento guardado no se puede validar. Revisá el historial de cobros.',true)
  return result.data
}
async function send(scope: string, attempt: Attempt, storage: StorageLike, fetcher: typeof fetch, recovering: boolean) {
  const existing=inFlight.get(scope)
  if (existing) return existing
  const promise=(async()=>{
    let response: Response
    let body: Record<string, unknown>
    try {
      response=await fetcher(attempt.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt.payload)})
      body=await response.json()
    } catch { throw new CollectionAttemptError('No se pudo confirmar la respuesta. Reintentá el mismo cobro para recuperar su comprobante.',true) }
    if (!response.ok || body.success===false) {
      // A recovery rejection cannot prove that the original request did not commit.
      const uncertain=recovering || response.status>=500 || body.code==='COLLECTION_IDEMPOTENCY_CONFLICT'
      if (!uncertain) storage.removeItem(keyFor(scope))
      throw new CollectionAttemptError(typeof body.error==='string'?body.error:'No se pudo confirmar el cobro.',uncertain)
    }
    const data=body.data as {collection?:unknown}|undefined
    const result=collectionResultSchema.safeParse(body.collection??data?.collection)
    if (!result.success) throw new CollectionAttemptError('Respuesta incompleta. Recuperá el comprobante reintentando el mismo cobro.',true)
    storage.removeItem(keyFor(scope))
    return {collection:result.data,response:body}
  })()
  inFlight.set(scope,promise)
  try { return await promise } finally { inFlight.delete(scope) }
}
export async function runCollectionAttempt(scope: string, endpoint: string, payload: Record<string, unknown>,
 storage: StorageLike = sessionStorage, fetcher: typeof fetch = fetch) {
  if (!scope) throw new CollectionAttemptError('Esperá a que se valide tu organización y usuario.',false)
  const {idempotencyKey:_ignored,...content}=payload
  const fingerprint=JSON.stringify({endpoint,payload:content})
  const pending=pendingCollectionAttempt(scope,storage)
  if (pending && pending.fingerprint!==fingerprint) throw new CollectionAttemptError('Hay un cobro pendiente de confirmar. Recuperalo antes de cambiar el monto o iniciar otro.',true)
  const attempt=pending??{endpoint,payload:{...content,idempotencyKey:crypto.randomUUID()},fingerprint}
  if (!attemptSchema.safeParse(attempt).success) throw new CollectionAttemptError('El destino del cobro no es válido.',false)
  try { storage.setItem(keyFor(scope),JSON.stringify(attempt)) }
  catch { throw new CollectionAttemptError('No se puede guardar el intento para reintentarlo con seguridad. Habilitá el almacenamiento de esta pestaña antes de cobrar.',false) }
  return send(scope,attempt,storage,fetcher,Boolean(pending))
}
export async function retryCollectionAttempt(scope: string, storage: StorageLike = sessionStorage, fetcher: typeof fetch = fetch) {
  const pending=pendingCollectionAttempt(scope,storage)
  if (!pending) throw new CollectionAttemptError('No hay un cobro pendiente de recuperar.',false)
  return send(scope,pending,storage,fetcher,true)
}
