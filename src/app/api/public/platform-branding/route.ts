import { NextResponse } from 'next/server'
import { getPlatformBranding } from '@/lib/platform/branding'
import { buildSupportContact } from '@/lib/platform/support-contact'

export async function GET() {
  try {
    const branding = await getPlatformBranding()
    // `support` ya trae el correo resuelto (marca → SUPPORT_EMAIL → por defecto):
    // las variables de entorno del servidor no llegan al navegador.
    return NextResponse.json({ success: true, branding, support: buildSupportContact(branding) })
  } catch {
    return NextResponse.json({ success: false, error: 'No se pudo cargar la marca publica.' }, { status: 500 })
  }
}
