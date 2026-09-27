import { z } from 'zod'

export const cartSyncInputSchema = z.object({
  organizationSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable(),
    quantity: z.number().int().min(1).max(999),
  })).max(200),
}).strict()

export type CartSyncItem = z.infer<typeof cartSyncInputSchema>['items'][number]

export function mergeCartItems(local: CartSyncItem[], remote: CartSyncItem[]) {
  const merged = new Map<string, CartSyncItem>()
  for (const item of [...remote, ...local]) {
    const key = `${item.productId}:${item.variantId ?? 'base'}`
    const existing = merged.get(key)
    merged.set(key, existing ? { ...item, quantity: Math.max(existing.quantity, item.quantity) } : item)
  }
  return [...merged.values()]
}
