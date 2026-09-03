import { z } from 'zod'

export const favoriteSchema = z.object({
  productId: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/),
  name: z.string().trim().min(1).max(250),
  store: z.string().trim().min(1).max(200),
})
export type Favorite = z.infer<typeof favoriteSchema>
export const favoriteListSchema = z.array(favoriteSchema).max(200)
export const favoriteKey = (item: Pick<Favorite, 'productId' | 'slug'>) => `${item.slug}:${item.productId}`
export function mergeFavorites(...lists: Favorite[][]): Favorite[] {
  return [...new Map(lists.flat().map(item => [favoriteKey(item), item])).values()]
}
