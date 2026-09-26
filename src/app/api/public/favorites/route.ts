import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { favoriteListSchema, favoriteSchema } from '@/lib/public/favorites-schema'

export async function GET() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Iniciá sesión.' }, { status: 401 })
  const { data, error } = await db.from('public_product_favorites').select('product_id, store_slug, product_name, store_name').eq('user_id', user.id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'No se pudieron cargar los favoritos de tu cuenta.' }, { status: 503 })
  return NextResponse.json({ items: (data ?? []).map(row => ({ productId: row.product_id, slug: row.store_slug, name: row.product_name, store: row.store_name })) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

async function mutate(request: NextRequest, remove: boolean) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 })
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Iniciá sesión.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (request.headers.get('x-favorites-user') !== user.id) return NextResponse.json({ error: 'La sesión cambió. Recargá tus favoritos.' }, { status: 409 })
  const parsed = favoriteListSchema.safeParse(remove ? [body] : body)
  if (!parsed.success) return NextResponse.json({ error: 'Favoritos inválidos (máximo 30 por envío).' }, { status: 400 })
  if (remove) {
    const item = favoriteSchema.parse(parsed.data[0])
    const { error } = await db.from('public_product_favorites').delete().eq('user_id', user.id).eq('product_id', item.productId).eq('store_slug', item.slug)
    if (error) return NextResponse.json({ error: 'No se pudo quitar el favorito.' }, { status: 503 })
  } else if (parsed.data.length) {
    const { error } = await db.from('public_product_favorites').upsert(parsed.data.map(item => ({ user_id: user.id, product_id: item.productId, store_slug: item.slug, product_name: item.name, store_name: item.store })), { onConflict: 'user_id,store_slug,product_id' })
    if (error) return NextResponse.json({ error: 'No se pudieron sincronizar los favoritos.' }, { status: 503 })
  }
  return NextResponse.json({ success: true })
}
export const POST = (request: NextRequest) => mutate(request, false)
export const DELETE = (request: NextRequest) => mutate(request, true)
