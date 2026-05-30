/**
 * GET /api/categories/suggest?name=almecenamit
 *
 * Devuelve sugerencias de categorías globales basadas en similitud
 * de texto (pg_trgm). Usado por el modal de creación de categoría
 * para ayudar a los tenants a mapear sus categorías a la taxonomía global.
 */
import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export const GET = withTenantAuth(
  { permission: 'inventory.products.read', module: 'inventory' },
  async (request) => {
    try {
      const { searchParams } = new URL(request.url)
      const name = searchParams.get('name')?.trim()

      if (!name || name.length < 2) {
        return NextResponse.json({ success: true, data: [] })
      }

      const supabase = await createClient()

      // Usa la función SQL suggest_global_category con pg_trgm
      const { data, error } = await supabase.rpc('suggest_global_category', {
        p_name: name,
        p_limit: 5,
        p_threshold: 0.2,
      })

      if (error) {
        // Si la función no existe aún (antes de migrar), devuelve vacío
        logger.warn('suggest_global_category function not available', { error })
        return NextResponse.json({ success: true, data: [] })
      }

      return NextResponse.json({ success: true, data: data ?? [] })
    } catch (error) {
      logger.error('Categories suggest API error', { error })
      return NextResponse.json({ success: true, data: [] }) // fail silently
    }
  }
)
