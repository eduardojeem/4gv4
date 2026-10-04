import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { loadEstimatedBatches } from '@/lib/inventory/batches-server'
import { needsAttention } from '@/lib/inventory/batches'

export const dynamic = 'force-dynamic'

/**
 * Lotes vencidos o por vencer que se estima que siguen en el estante. Por
 * defecto, los próximos 60 días.
 */
export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (request, { organization }) => {
  const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 60))
  const supabase = (await createClient()) as unknown as SupabaseClient
  try {
    const result = await loadEstimatedBatches(supabase, organization.id)
    if ('missing' in result) return NextResponse.json({ available: false, batches: [] })
    return NextResponse.json({
      available: true,
      today: result.today,
      days,
      batches: result.batches.filter((batch) => needsAttention(batch, days)),
      tracked: result.batches.length,
    })
  } catch (error) {
    logger.error('No se pudieron leer los vencimientos', { error })
    return NextResponse.json({ error: 'No se pudieron leer los vencimientos' }, { status: 500 })
  }
})
