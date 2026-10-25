import { createAdminSupabase } from '@/lib/supabase/admin'

type MaterialPart = {
  lineType: 'service' | 'included_material' | 'charged_part'
  unitCost?: number
  sourceProductId?: string | null
}

/**
 * El costo del material incluido sale del servicio de origen, leído en el servidor y
 * acotado al comercio. Quien no puede ver costos no lo recibe en la búsqueda de
 * repuestos y tampoco puede inventarlo al guardar. Devuelve null si algún servicio
 * de origen no es de este comercio.
 */
export async function resolveIncludedMaterialCosts<T extends MaterialPart>(
  parts: T[],
  organizationId: string,
  client?: Pick<ReturnType<typeof createAdminSupabase>, 'from'>,
): Promise<T[] | null> {
  const ids = [...new Set(parts
    .filter((part) => part.lineType === 'included_material' && part.sourceProductId)
    .map((part) => part.sourceProductId as string))]
  if (ids.length === 0) return parts
  // El cliente de servicio se crea solo si hay algo que resolver.
  const { data, error } = await (client ?? createAdminSupabase())
    .from('products')
    .select('id, purchase_price')
    .eq('organization_id', organizationId)
    .in('id', ids)
  if (error) throw error
  const costs = new Map(((data ?? []) as { id: string; purchase_price: number | null }[])
    .filter(row=>row.purchase_price !== null && Number.isFinite(Number(row.purchase_price)) && Number(row.purchase_price)>=0)
    .map((row) => [String(row.id), Number(row.purchase_price)]))
  if (ids.some((id) => !costs.has(id))) return null
  return parts.map((part) => (
    part.lineType === 'included_material' && part.sourceProductId
      ? { ...part, unitCost: costs.get(part.sourceProductId) }
      : part
  ))
}
