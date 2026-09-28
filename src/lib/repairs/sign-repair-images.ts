import type { SupabaseClient } from '@supabase/supabase-js'

import { repairImagePath, signRepairImagePath } from './repair-image-storage'

type RepairImageRow = {
  image_url: string | null
}

export async function signRepairImages<T extends RepairImageRow>(
  admin: SupabaseClient,
  rows: T[],
): Promise<Array<Omit<T, 'image_url'> & { image_url: string | null }>> {
  return Promise.all(rows.map(async (row) => {
    const path = typeof row.image_url === 'string' ? repairImagePath(row.image_url) : null
    const signedUrl = path ? await signRepairImagePath(admin, path) : null

    return {
      ...row,
      image_url: signedUrl,
    }
  }))
}

export async function signRepairRecordImages<T>(admin: SupabaseClient, repair: T): Promise<T> {
  if (!repair || typeof repair !== 'object') return repair
  const record = repair as T & { images?: RepairImageRow[] | null }
  if (!Array.isArray(record.images)) return repair

  return {
    ...record,
    images: await signRepairImages(admin, record.images),
  } as T
}
