import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

async function handler(request: NextRequest, userId: string) {
  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Datos de formulario inválidos' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Tipo de archivo no permitido. Use JPG, PNG, WebP o SVG.' },
      { status: 400 }
    )
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo excede el límite de 2 MB.' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership?.organization_id) {
    return NextResponse.json({ error: 'No se encontró organización activa' }, { status: 404 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z]/g, '') || 'jpg'
  const storagePath = `logos/${membership.organization_id}/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('product-images')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json(
      { error: `Error al subir imagen: ${uploadError.message}` },
      { status: 500 }
    )
  }

  const { data: { publicUrl } } = admin.storage.from('product-images').getPublicUrl(storagePath)

  return NextResponse.json({ success: true, url: publicUrl })
}

export function POST(request: NextRequest) {
  return withAdminAuth(async (req, ctx) => handler(req, ctx.user.id))(request)
}
