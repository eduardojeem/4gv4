import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-auth'

// Tipos MIME permitidos para subida
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]

// Tamano maximo: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024

export async function POST(request: Request) {
  try {
    // Verificar que el usuario esta autenticado
    const auth = await requireAuth()
    if (!auth.authenticated) return auth.response

    const formData = await request.formData()
    const file = formData.get('file') as File
    const bucket = formData.get('bucket') as string
    const path = formData.get('path') as string

    if (!file || !bucket || !path) {
      return NextResponse.json(
        { error: 'Missing file, bucket or path' },
        { status: 400 }
      )
    }

    // Validar bucket permitido
    const ALLOWED_BUCKETS = ['repair-images', 'product-images', 'avatars']
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
    }

    // Validar tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            'Tipo de archivo no permitido. Solo se permiten imagenes (JPEG, PNG, WebP, GIF, AVIF).',
        },
        { status: 400 }
      )
    }

    // Validar tamano
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo excede el tamano maximo de 5MB.' },
        { status: 400 }
      )
    }

    // Sanitizar el path para prevenir path traversal
    const sanitizedPath = path.replace(/\.\./g, '').replace(/\/\//g, '/')

    const supabase = createAdminSupabase()

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(sanitizedPath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(sanitizedPath)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: data.path,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
