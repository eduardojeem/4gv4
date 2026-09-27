import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PublicProfileClient } from '@/components/public/PublicProfileClient'
import { toPublicProfile } from '@/lib/profile/public-profile'

export const revalidate = 60

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()

  const { data: sessionData } = await supabase.auth.getSession()
  const sessionUserId = sessionData?.session?.user?.id

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'username, full_name, job_title, bio, location, avatar_url, website, social_links, updated_at'
    )
    .eq('username', username)
    .eq('is_public', true)
    .maybeSingle()

  if (profileError) {
    throw new Error(`No se pudo cargar el perfil público: ${profileError.message}`)
  }

  if (!profile) {
    notFound()
  }

  const data = toPublicProfile(profile as Record<string, unknown>)
  let isOwnProfile = false
  if (sessionUserId) {
    const { data: ownProfile } = await supabase.from('profiles').select('username').eq('id', sessionUserId).maybeSingle()
    isOwnProfile = ownProfile?.username === profile.username
  }

  return <PublicProfileClient data={data} isOwnProfile={!!isOwnProfile} />
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  try {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, job_title, bio')
      .eq('username', username)
      .eq('is_public', true)
      .maybeSingle()

    if (!profile) return { title: 'Perfil público', description: 'Perfil no encontrado' }
    const name = profile.full_name || username
    const title = profile.job_title ? `${profile.job_title} • ${name}` : `${name} • Perfil`
    const desc = profile.bio || `Explora el perfil de ${name}`
    return { title, description: desc }
  } catch {
    return { title: 'Perfil público' }
  }
}
