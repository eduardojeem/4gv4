export type PublicSocialPlatform = 'twitter' | 'linkedin' | 'github' | 'instagram' | 'website'

export type PublicProfileData = {
  profile: {
    username: string
    display_name: string
    title?: string | null
    bio?: string | null
    location?: string | null
    avatar_url?: string | null
    updated_at: string
    verified: boolean
  }
  socialLinks: Array<{
    id: string
    platform: PublicSocialPlatform
    url: string
    username?: string | null
    is_verified: boolean
  }>
  stats: {
    followers_count: number
    following_count: number
    posts_count: number
    projects_count: number
    profile_views?: number
    total_likes?: number
  }
  content: Array<{
    id: string
    title: string
    description?: string | null
    image_url?: string | null
    category?: string | null
    type: 'post' | 'project'
    date: string
    views?: number | null
    likes?: number | null
    comments?: number | null
    link?: string | null
    tags?: string[] | null
  }>
}

const socialBases: Record<Exclude<PublicSocialPlatform, 'website'>, string> = {
  twitter: 'https://x.com/',
  linkedin: 'https://linkedin.com/in/',
  github: 'https://github.com/',
  instagram: 'https://instagram.com/',
}

const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value.trim() : fallback
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function normalizeSocialUrl(platform: Exclude<PublicSocialPlatform, 'website'>, value: unknown): { url: string; username?: string } | null {
  const raw = asString(value)
  if (!raw) return null
  const direct = safeHttpUrl(raw)
  if (direct) return { url: direct }
  const username = raw.replace(/^@/, '')
  if (!/^[a-z0-9._-]+$/i.test(username)) return null
  return { url: `${socialBases[platform]}${username}`, username }
}

export function toPublicProfile(row: Record<string, unknown>): PublicProfileData {
  const id = asString(row.id, 'profile')
  const social = asRecord(row.social_links)
  const socialLinks: PublicProfileData['socialLinks'] = []

  for (const platform of ['twitter', 'linkedin', 'github', 'instagram'] as const) {
    const normalized = normalizeSocialUrl(platform, social[platform])
    if (normalized) socialLinks.push({
      id: `${id}:${platform}`,
      platform,
      url: normalized.url,
      username: normalized.username,
      is_verified: false,
    })
  }

  const website = safeHttpUrl(asString(row.website))
  if (website) socialLinks.push({
    id: `${id}:website`,
    platform: 'website',
    url: website,
    is_verified: false,
  })

  return {
    profile: {
      username: asString(row.username),
      display_name: asString(row.full_name, asString(row.username, 'Perfil')),
      title: asString(row.job_title) || null,
      bio: asString(row.bio) || null,
      location: asString(row.location) || null,
      avatar_url: safeHttpUrl(asString(row.avatar_url)),
      updated_at: asString(row.updated_at, new Date(0).toISOString()),
      verified: false,
    },
    socialLinks,
    stats: { followers_count: 0, following_count: 0, posts_count: 0, projects_count: 0 },
    content: [],
  }
}
