import { NextRequest } from 'next/server'
import { calculatePriorityScoreWithInventory, defaultPriorityConfig } from '@/services/repair-priority'
import { ProductStock } from '@/services/inventory-repair-sync'
import { requireStaff, getAuthResponse } from '@/lib/auth/require-auth'
import { RepairOrder } from '@/types/repairs'

export async function POST(req: NextRequest) {
  try {
    // Allow API key auth for server-to-server, otherwise require staff session
    const apiKey = process.env.PRIORITIZATION_API_KEY
    const headerKey = req.headers.get('x-api-key')
    if (apiKey && headerKey === apiKey) {
      // Valid API key, proceed
    } else {
      const auth = await requireStaff()
      { const r = getAuthResponse(auth); if (r) return r }
    }

    const body = await req.json()
    const { repair, products, config } = body as { repair: Record<string, unknown>; products?: ProductStock[]; config?: Record<string, unknown> }
    if (!repair) {
      return new Response(JSON.stringify({ error: 'Missing repair payload' }), { status: 400 })
    }
    const score = calculatePriorityScoreWithInventory(
      repair as unknown as RepairOrder,
      (config as unknown as typeof defaultPriorityConfig) ?? defaultPriorityConfig,
      products ?? []
    )
    return new Response(JSON.stringify({ score }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}


