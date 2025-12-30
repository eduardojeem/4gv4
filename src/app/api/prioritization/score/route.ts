import { NextRequest } from 'next/server'
import { calculatePriorityScoreWithInventory, defaultPriorityConfig } from '@/services/repair-priority'
import { ProductStock } from '@/services/inventory-repair-sync'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.PRIORITIZATION_API_KEY
    const headerKey = req.headers.get('x-api-key')
    if (apiKey && headerKey !== apiKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const body = await req.json()
    const { repair, products, config } = body as { repair: any; products?: ProductStock[]; config?: any }
    if (!repair) {
      return new Response(JSON.stringify({ error: 'Missing repair payload' }), { status: 400 })
    }
    const score = calculatePriorityScoreWithInventory(repair, config ?? defaultPriorityConfig, products ?? [])
    return new Response(JSON.stringify({ score }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), { status: 500 })
  }
}