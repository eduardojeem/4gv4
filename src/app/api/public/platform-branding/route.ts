import { NextResponse } from 'next/server'
import { getPlatformBranding } from '@/lib/platform/branding'

export async function GET() {
  try {
    const branding = await getPlatformBranding()
    return NextResponse.json({ success: true, branding })
  } catch {
    return NextResponse.json({ success: false, error: 'No se pudo cargar la marca publica.' }, { status: 500 })
  }
}
