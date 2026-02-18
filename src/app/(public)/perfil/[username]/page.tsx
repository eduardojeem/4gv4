import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PublicProfileClient, ProfileError, type PublicProfileData as PublicData } from '@/components/public/PublicProfileClient'

export const revalidate = 60

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()

  const { data: sessionData } = await supabase.auth.getSession()
  const sessionUserId = sessionData?.session?.user?.id

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      `username, display_name, title, bio, location, avatar_url, updated_at, user_id,
       social_links(id, user_id, platform, url, is_verified, username),
       user_stats(id, user_id, followers_count, following_count, posts_count, projects_count)`
    )
    .eq('username', username)
    .eq('is_public', true)
    .maybeSingle()

  if (profileError) {
    return <ProfileError message="No se pudo cargar el perfil." />
  }

  if (!profile) {
    notFound()
  }

  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('id, user_id, title, description, image_url, category, type, date, views, likes, comments, link, tags')
    .eq('user_id', (profile as any).user_id)
    .eq('is_public', true)
    .order('date', { ascending: false })
    .limit(20)

  if (contentError) {
    // No bloqueamos la página por error de contenido; mostramos sin contenido
  }

  const data: PublicData = {
    profile: {
      username: (profile as any).username,
      display_name: (profile as any).display_name,
      title: (profile as any).title,
      bio: (profile as any).bio,
      location: (profile as any).location,
      avatar_url: (profile as any).avatar_url,
      updated_at: (profile as any).updated_at,
    },
    socialLinks: ((profile as any).social_links ?? []) as any,
    stats: ((profile as any).user_stats ?? {
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
      projects_count: 0,
    }) as any,
    content: (content as any) ?? [],
  }

  const isOwnProfile = sessionUserId && sessionUserId === (profile as any).user_id

  return <PublicProfileClient data={data} isOwnProfile={!!isOwnProfile} />
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  try {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, title, bio')
      .eq('username', username)
      .eq('is_public', true)
      .maybeSingle()

    if (!profile) return { title: 'Perfil público', description: 'Perfil no encontrado' }
    const name = (profile as any).display_name || username
    const title = (profile as any).title ? `${(profile as any).title} • ${name}` : `${name} • Perfil`
    const desc = (profile as any).bio || `Explora el perfil de ${name}`
    return { title, description: desc }
  } catch {
    return { title: 'Perfil público' }
  }
}
