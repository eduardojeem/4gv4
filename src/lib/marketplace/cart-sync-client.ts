import type { PublicCartItem } from '@/lib/public-cart'
import { mergeCartItems, type CartSyncItem } from './cart-sync'

export type PendingCartOperation = {
  organizationSlug: string
  item: CartSyncItem
}

export function toSyncItems(items: PublicCartItem[]): CartSyncItem[] {
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
  }))
}

export function mergeForMigration(local: PublicCartItem[], remote: CartSyncItem[]) {
  return mergeCartItems(toSyncItems(local), remote)
}

export function compactPendingOperations(operations: PendingCartOperation[]) {
  const latest = new Map<string, PendingCartOperation>()
  for (const operation of operations) {
    latest.set(`${operation.organizationSlug}:${operation.item.productId}:${operation.item.variantId ?? 'base'}`, operation)
  }
  return [...latest.values()]
}
