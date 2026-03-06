import { NextRequest } from 'next/server'
import { generateReorderAlerts, ProductStock } from '@/services/inventory-repair-sync'
import { requireStaff, getAuthResponse } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest) {
  try {
    // Allow API key auth for server-to-server calls, otherwise require staff session
    const apiKey = process.env.PRIORITIZATION_API_KEY
    const headerKey = req.headers.get('x-api-key')
    if (apiKey && headerKey === apiKey) {
      // API key is valid, proceed
    } else {
      const auth = await requireStaff()
      { const r = getAuthResponse(auth); if (r) return r }
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

