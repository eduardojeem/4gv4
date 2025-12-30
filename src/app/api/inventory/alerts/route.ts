import { NextRequest } from 'next/server'
import { generateReorderAlerts, ProductStock } from '@/services/inventory-repair-sync'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.PRIORITIZATION_API_KEY
    const headerKey = req.headers.get('x-api-key')
    if (apiKey && headerKey !== apiKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const body = await req.json()
    const { products, threshold } = body as { products: ProductStock[]; threshold?: number }
    if (!products || !Array.isArray(products)) {
      return new Response(JSON.stringify({ error: 'Missing products array' }), { status: 400 })
    }
    const alerts = generateReorderAlerts(products, threshold ?? 3)
    return new Response(JSON.stringify({ alerts }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), { status: 500 })
  }
}