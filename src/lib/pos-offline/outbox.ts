/**
 * Ventas del POS hechas sin conexión.
 *
 * Cuando se corta internet, la venta se guarda en este equipo (IndexedDB:
 * sobrevive a cerrar la pestaña o apagar la máquina) con el pedido exacto que
 * iba a ir a /api/pos/process-sale y su clave de idempotencia. Al volver la
 * conexión se manda tal cual: si el primer intento sí había llegado, la misma
 * clave hace que el servidor no la cobre dos veces.
 */

export type OutboxStatus = 'pending' | 'error'

export interface OutboxSale {
  /** La clave de idempotencia de la venta. */
  id: string
  branchId: string | null
  payload: Record<string, unknown>
  createdAt: string
  total: number
  itemCount: number
  summary: string
  status: OutboxStatus
  attempts: number
  lastError?: string
  lastAttemptAt?: string
}

/** Dónde se guarda. En el navegador, IndexedDB; en los tests, memoria. */
export interface OutboxStorage {
  getAll(): Promise<OutboxSale[]>
  put(sale: OutboxSale): Promise<void>
  remove(id: string): Promise<void>
}

const DB_NAME = 'mitiendapy-pos'
const STORE = 'outbox'
export const OUTBOX_EVENT = 'pos-outbox-change'

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1)
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => {
      dbPromise = null
      reject(open.error)
    }
  })
  return dbPromise
}

const indexedDbStorage: OutboxStorage = {
  async getAll() {
    const db = await openDb()
    return request(db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<OutboxSale[]>)
  },
  async put(sale) {
    const db = await openDb()
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).put(sale))
  },
  async remove(id) {
    const db = await openDb()
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
  },
}

/** Respaldo en memoria si el navegador no deja usar IndexedDB (modo privado estricto). */
export function memoryStorage(initial: OutboxSale[] = []): OutboxStorage {
  const rows = new Map(initial.map((sale) => [sale.id, sale]))
  return {
    async getAll() { return [...rows.values()] },
    async put(sale) { rows.set(sale.id, sale) },
    async remove(id) { rows.delete(id) },
  }
}

let storage: OutboxStorage | null = null

export function getOutboxStorage(): OutboxStorage {
  storage ??= typeof indexedDB === 'undefined' ? memoryStorage() : indexedDbStorage
  return storage
}

/** Sólo para los tests. */
export function setOutboxStorage(next: OutboxStorage | null) {
  storage = next
}

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OUTBOX_EVENT))
}

export async function listOutbox(): Promise<OutboxSale[]> {
  const rows = await getOutboxStorage().getAll()
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function addToOutbox(sale: Omit<OutboxSale, 'status' | 'attempts' | 'createdAt'> & { createdAt?: string }) {
  await getOutboxStorage().put({ ...sale, createdAt: sale.createdAt ?? new Date().toISOString(), status: 'pending', attempts: 0 })
  notify()
}

export async function updateOutbox(id: string, patch: Partial<OutboxSale>) {
  const current = (await getOutboxStorage().getAll()).find((sale) => sale.id === id)
  if (!current) return
  await getOutboxStorage().put({ ...current, ...patch, id })
  notify()
}

export async function removeFromOutbox(id: string) {
  await getOutboxStorage().remove(id)
  notify()
}
