import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip')

    const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/'

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      return NextResponse.json({ country: null, city: null })
    }

    const data = await response.json() as { country_name?: string; city?: string }
    return NextResponse.json({
      country: data.country_name ?? null,
      city: data.city ?? null,
    })
  } catch {
    return NextResponse.json({ country: null, city: null })
  }
}
