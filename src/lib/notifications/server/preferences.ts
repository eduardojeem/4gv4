import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORY_LABELS,
  getNotificationMetadata,
  type NotificationType,
} from '../types'
import { resolveNotificationDefaultPreference } from '../defaults'

export interface EffectivePreference {
  notificationType: NotificationType
  pushEnabled: boolean
  inAppEnabled: boolean
  source: 'explicit' | 'default'
}

export interface UserPreferenceView extends EffectivePreference {
  category: string
  title: string
  description: string
  hasExplicitSetting: boolean
}

interface PreferenceRow {
  notification_type: string
  push_enabled: boolean
  in_app_enabled: boolean
}

/**
 * Resuelve la preferencia efectiva de un usuario específico para un tipo de evento.
 * Orden de precedencia:
 * 1. Preferencia explícita configurada en la tabla `notification_preferences`.
 * 2. Catálogo central de defaults según el rol y criticidad del evento.
 */
export async function getEffectiveNotificationPreference(params: {
  organizationId: string
  userId: string
  notificationType: NotificationType
  role?: string
}): Promise<EffectivePreference> {
  const { organizationId, userId, notificationType, role } = params
  const supabase = createAdminSupabase()

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('notification_type, push_enabled, in_app_enabled')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('notification_type', notificationType)
    .maybeSingle()

  if (!error && data) {
    const row = data as PreferenceRow
    return {
      notificationType,
      pushEnabled: Boolean(row.push_enabled),
      inAppEnabled: Boolean(row.in_app_enabled),
      source: 'explicit',
    }
  }

  const catalogDefault = resolveNotificationDefaultPreference(notificationType, role)
  return {
    notificationType,
    pushEnabled: catalogDefault.pushEnabled,
    inAppEnabled: catalogDefault.inAppEnabled,
    source: 'default',
  }
}

/**
 * Resuelve en lote las preferencias efectivas para un grupo de destinatarios
 * para un único tipo de notificación.
 */
export async function getBatchEffectiveNotificationPreferences(params: {
  organizationId: string
  userIds: string[]
  notificationType: NotificationType
  roleByUserId?: Map<string, string>
}): Promise<Map<string, EffectivePreference>> {
  const { organizationId, userIds, notificationType, roleByUserId } = params
  const results = new Map<string, EffectivePreference>()

  if (userIds.length === 0) return results

  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('user_id, notification_type, push_enabled, in_app_enabled')
    .eq('organization_id', organizationId)
    .eq('notification_type', notificationType)
    .in('user_id', userIds)

  const explicitMap = new Map<string, PreferenceRow>()
  if (!error && data) {
    for (const item of data as Array<PreferenceRow & { user_id: string }>) {
      explicitMap.set(item.user_id, item)
    }
  }

  for (const userId of userIds) {
    const explicit = explicitMap.get(userId)
    if (explicit) {
      results.set(userId, {
        notificationType,
        pushEnabled: Boolean(explicit.push_enabled),
        inAppEnabled: Boolean(explicit.in_app_enabled),
        source: 'explicit',
      })
    } else {
      const userRole = roleByUserId?.get(userId)
      const catalogDefault = resolveNotificationDefaultPreference(notificationType, userRole)
      results.set(userId, {
        notificationType,
        pushEnabled: catalogDefault.pushEnabled,
        inAppEnabled: catalogDefault.inAppEnabled,
        source: 'default',
      })
    }
  }

  return results
}

/**
 * Obtiene la lista completa de preferencias (efectivas y explícitas) de un usuario
 * en una organización para todos los tipos de notificación del catálogo.
 */
export async function getAllEffectiveNotificationPreferencesForUser(
  organizationId: string,
  userId: string,
  role?: string
): Promise<UserPreferenceView[]> {
  const supabase = createAdminSupabase()

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('notification_type, push_enabled, in_app_enabled')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)

  const explicitMap = new Map<string, PreferenceRow>()
  if (!error && data) {
    for (const row of data as PreferenceRow[]) {
      explicitMap.set(row.notification_type, row)
    }
  }

  const views: UserPreferenceView[] = NOTIFICATION_TYPES.map((type) => {
    const metadata = getNotificationMetadata(type)
    const categoryInfo = NOTIFICATION_CATEGORY_LABELS[metadata.category]
    const explicit = explicitMap.get(type)

    if (explicit) {
      return {
        notificationType: type,
        category: metadata.category,
        title: metadata.title,
        description: categoryInfo?.description ?? metadata.title,
        pushEnabled: Boolean(explicit.push_enabled),
        inAppEnabled: Boolean(explicit.in_app_enabled),
        source: 'explicit',
        hasExplicitSetting: true,
      }
    }

    const catalogDefault = resolveNotificationDefaultPreference(type, role)
    return {
      notificationType: type,
      category: metadata.category,
      title: metadata.title,
      description: categoryInfo?.description ?? metadata.title,
      pushEnabled: catalogDefault.pushEnabled,
      inAppEnabled: catalogDefault.inAppEnabled,
      source: 'default',
      hasExplicitSetting: false,
    }
  })

  return views
}

/**
 * Guarda o actualiza una preferencia de notificación específica para un usuario y organización.
 */
export async function upsertNotificationPreference(params: {
  organizationId: string
  userId: string
  notificationType: NotificationType
  pushEnabled: boolean
  inAppEnabled: boolean
}): Promise<EffectivePreference> {
  const { organizationId, userId, notificationType, pushEnabled, inAppEnabled } = params
  const supabase = createAdminSupabase()

  const { error } = await supabase.from('notification_preferences').upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      notification_type: notificationType,
      push_enabled: pushEnabled,
      in_app_enabled: inAppEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,user_id,notification_type' }
  )

  if (error) {
    throw new Error(`Failed to update notification preference: ${error.message}`)
  }

  return {
    notificationType,
    pushEnabled,
    inAppEnabled,
    source: 'explicit',
  }
}
