import { z } from 'zod'

export const MAX_FAVORITES = 30

export const favoriteSchema = z.object({
  productId: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/),
  name: z.string().trim().min(1).max(250),
  store: z.string().trim().min(1).max(200),
  image: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
})
export type Favorite = z.infer<typeof favoriteSchema>
export const favoriteListSchema = z.array(favoriteSchema).max(MAX_FAVORITES)
export const favoriteKey = (item: Pick<Favorite, 'productId' | 'slug'>) => `${item.slug}:${item.productId}`
export function mergeFavorites(...lists: Favorite[][]): Favorite[] {
  return [...new Map(lists.flat().map(item => [favoriteKey(item), item])).values()]
}

