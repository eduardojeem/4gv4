'use client'

import { usePromotions } from '@/hooks/use-promotions'

export function PromotionsTest() {
  const { promotions, loading } = usePromotions()

  if (loading) {
    return <div>Loading promotions...</div>
  }

  return (
    <div className="p-4 border rounded">
      <h3 className="font-semibold mb-2">Promotions Test</h3>
      <p>Found {promotions.length} promotions</p>
      {promotions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {promotions.map((promo) => (
            <li key={promo.id} className="text-sm">
              {promo.name} - {promo.type} ({promo.value})
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}