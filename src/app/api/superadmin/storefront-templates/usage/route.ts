import { NextResponse } from 'next/server'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { loadTemplateUsage } from '@/lib/website/template-usage.server'

export async function GET() {
 const user = await getSuperAdminUser()
 if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
 try {
  return NextResponse.json({ usage: await loadTemplateUsage() }, { headers: { 'Cache-Control': 'private, no-store' } })
 } catch (error) {
  console.error('[storefront-template-usage]', error)
  return NextResponse.json({ error: 'No se pudo consultar el uso de plantillas.' }, { status: 500 })
 }
}
