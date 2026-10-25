import { getPrivateCacheContext, isPrivateCacheContextCurrent, subscribePrivateCacheContext, type PrivateCacheContext } from './private-cache-context';
import type { Product } from './products';
import { secureStorage } from './secure-storage';

/**
 * Productos que más se venden desde este teléfono, para mostrarlos primero en
 * el POS: en el mostrador casi siempre se cobra lo mismo, y buscarlo cada vez
 * era más lento que tocarlo.
 *
 * Se guarda una copia mínima de cada producto (nombre, precios, foto) para que
 * aparezca al instante; el stock real se actualiza con el listado del servidor.
 */

const LEGACY_KEY = 'mt_pos_frequent';
const keyPart = (value: string) => Array.from(value).map(char => char.codePointAt(0)!.toString(16).padStart(6, '0')).join('');
const storageKey = (scope: PrivateCacheContext) => scope.userId && scope.organizationId && scope.branchId ? `mt_pos_frequent.${[scope.userId, scope.organizationId, scope.branchId ?? 'server-default'].map(keyPart).join('.')}` : null;
let storageQueue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(work, work);
  storageQueue = result.catch(() => undefined);
  return result;
}
subscribePrivateCacheContext((_next, previous) => {
  const key = storageKey(previous);
  void serial(async () => {
    await secureStorage.removeItem(LEGACY_KEY).catch(() => undefined);
    if (key) await secureStorage.removeItem(key).catch(() => undefined);
  });
});
const MAX = 24;

type Entry = { count: number; last: number; product: Product };

async function read(scope: PrivateCacheContext): Promise<Record<string, Entry>> {
  try {
    await secureStorage.removeItem(LEGACY_KEY);
    const key = storageKey(scope);
    if (!key || !isPrivateCacheContextCurrent(scope)) return {};
    const raw = await secureStorage.getItem(key);
    if (!isPrivateCacheContextCurrent(scope)) return {};
    return raw ? (JSON.parse(raw) as Record<string, Entry>) : {};
  } catch {
    return {};
  }
}

const slim = (product: Product): Product => ({
  id: product.id,
  name: product.name,
  sku: product.sku,
  barcode: product.barcode ?? null,
  sale_price: product.sale_price,
  wholesale_price: product.wholesale_price ?? null,
  stock_quantity: product.stock_quantity,
  min_stock: product.min_stock ?? 0,
  images: (product.images ?? []).slice(0, 1),
  image_url: product.image_url ?? null,
  is_active: product.is_active,
  unit_measure: product.unit_measure ?? 'unidad',
});

/** Ordenados por veces vendidos (y los más recientes primero ante empate). */
export async function frequentProducts(scope = getPrivateCacheContext()) {
  return serial(async () => {
    const entries = Object.values(await read(scope));
    return isPrivateCacheContextCurrent(scope) ? entries.sort((a, b) => b.count - a.count || b.last - a.last).map((entry) => entry.product) : [];
  });
}

export async function recordSold(products: { product: Product; quantity: number }[], scope = getPrivateCacheContext()) {
  return serial(async () => {
  const data = await read(scope);
  const key = storageKey(scope);
  if (!key || !isPrivateCacheContextCurrent(scope)) return;
  const now = Date.now();
  for (const { product, quantity } of products) {
    const current = data[product.id];
    data[product.id] = { count: (current?.count ?? 0) + quantity, last: now, product: slim(product) };
  }
  const kept = Object.entries(data)
    .sort(([, a], [, b]) => b.count - a.count || b.last - a.last)
    .slice(0, MAX);
  try {
    await secureStorage.setItem(key, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Sin espacio o sin llavero: el POS funciona igual, solo no recuerda.
  }
  });
}
