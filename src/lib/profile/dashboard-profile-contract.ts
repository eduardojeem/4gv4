import { z } from 'zod'

export const DEFAULT_DASHBOARD_PREFERENCES = {
  notifications: true,
  compactMode: false,
  language: 'es',
  emailNotifications: true,
  pushNotifications: false,
  marketingEmails: false,
  autoSave: false,
  darkModeSchedule: false,
} as const

export type DashboardPreferences = {
  notifications: boolean
  compactMode: boolean
  language: 'es' | 'en' | 'pt'
  emailNotifications: boolean
  pushNotifications: boolean
  marketingEmails: boolean
  autoSave: boolean
  darkModeSchedule: boolean
}

export type DashboardSocialLinks = {
  linkedin: string
  twitter: string
  github: string
  instagram: string
}

export type DashboardProfile = {
  id: string
  fullName: string
  email: string
  emailVerified: boolean
  avatarUrl: string
  phone: string
  department: string
  jobTitle: string
  location: string
  bio: string
  website: string
  timezone: string
  role: string | null
  socialLinks: DashboardSocialLinks
  preferences: DashboardPreferences
}

const trimmed = (max: number) => z.string().trim().max(max)
const optionalText = (max: number) => trimmed(max).optional()
const httpUrl = z.string().trim().max(2048).refine((value) => {
  if (value === '') return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}, 'URL inválida')

const socialValue = z.string().trim().max(2048).refine((value) => {
  if (value === '' || /^@?[a-z0-9._-]+$/i.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}, 'Enlace social inválido')

const timezoneSchema = z.string().trim().max(64).refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}, 'Zona horaria inválida')

export const dashboardPreferencesPatchSchema = z.object({
  notifications: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  language: z.enum(['es', 'en', 'pt']).optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  autoSave: z.boolean().optional(),
  darkModeSchedule: z.boolean().optional(),
}).strict()

export const dashboardProfilePatchSchema = z.object({
  fullName: trimmed(120).min(2).optional(),
  avatarUrl: httpUrl.optional(),
  phone: optionalText(40),
  department: optionalText(100),
  jobTitle: optionalText(100),
  location: optionalText(160),
  bio: optionalText(500),
  website: httpUrl.optional(),
  timezone: timezoneSchema.optional(),
  socialLinks: z.object({
    linkedin: socialValue.optional(),
    twitter: socialValue.optional(),
    github: socialValue.optional(),
    instagram: socialValue.optional(),
  }).strict().optional(),
  preferences: dashboardPreferencesPatchSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Se requiere al menos un cambio')

export type DashboardProfilePatch = z.infer<typeof dashboardProfilePatchSchema>

type AuthIdentity = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const asBoolean = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback

export function toDashboardProfile(row: Record<string, unknown>, user: AuthIdentity): DashboardProfile {
  const rawPreferences = asRecord(row.preferences)
  const rawSocialLinks = asRecord(row.social_links)
  return {
    id: user.id,
    fullName: asString(row.full_name),
    email: user.email ?? '',
    emailVerified: Boolean(user.email_confirmed_at),
    avatarUrl: asString(row.avatar_url),
    phone: asString(row.phone),
    department: asString(row.department),
    jobTitle: asString(row.job_title),
    location: asString(row.location),
    bio: asString(row.bio),
    website: asString(row.website),
    timezone: asString(row.timezone, 'America/Asuncion'),
    role: typeof row.role === 'string' ? row.role : null,
    socialLinks: {
      linkedin: asString(rawSocialLinks.linkedin),
      twitter: asString(rawSocialLinks.twitter),
      github: asString(rawSocialLinks.github),
      instagram: asString(rawSocialLinks.instagram),
    },
    preferences: {
      notifications: asBoolean(rawPreferences.notifications, DEFAULT_DASHBOARD_PREFERENCES.notifications),
      compactMode: asBoolean(rawPreferences.compactMode, DEFAULT_DASHBOARD_PREFERENCES.compactMode),
      language: ['es', 'en', 'pt'].includes(asString(rawPreferences.language))
        ? asString(rawPreferences.language) as DashboardPreferences['language']
        : DEFAULT_DASHBOARD_PREFERENCES.language,
      emailNotifications: asBoolean(rawPreferences.emailNotifications, DEFAULT_DASHBOARD_PREFERENCES.emailNotifications),
      pushNotifications: asBoolean(rawPreferences.pushNotifications, DEFAULT_DASHBOARD_PREFERENCES.pushNotifications),
      marketingEmails: asBoolean(rawPreferences.marketingEmails, DEFAULT_DASHBOARD_PREFERENCES.marketingEmails),
      autoSave: asBoolean(rawPreferences.autoSave, DEFAULT_DASHBOARD_PREFERENCES.autoSave),
      darkModeSchedule: asBoolean(rawPreferences.darkModeSchedule, DEFAULT_DASHBOARD_PREFERENCES.darkModeSchedule),
    },
  }
}

export function toProfileUpdate(patch: DashboardProfilePatch): Record<string, unknown> {
  return {
    ...(patch.fullName === undefined ? {} : { full_name: patch.fullName }),
    ...(patch.avatarUrl === undefined ? {} : { avatar_url: patch.avatarUrl }),
    ...(patch.phone === undefined ? {} : { phone: patch.phone }),
    ...(patch.department === undefined ? {} : { department: patch.department }),
    ...(patch.jobTitle === undefined ? {} : { job_title: patch.jobTitle }),
    ...(patch.location === undefined ? {} : { location: patch.location }),
    ...(patch.bio === undefined ? {} : { bio: patch.bio }),
    ...(patch.website === undefined ? {} : { website: patch.website }),
    ...(patch.timezone === undefined ? {} : { timezone: patch.timezone }),
    ...(patch.socialLinks === undefined ? {} : { social_links: patch.socialLinks }),
    ...(patch.preferences === undefined ? {} : { preferences: patch.preferences }),
  }
}
