import { randomUUID } from 'node:crypto'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import {
  NOTIFICATION_TYPES,
  getNotificationMetadata,
  type NotificationType,
} from '../types'
import { buildNotificationIdempotencyKey } from '../idempotency'
import { formatNotificationContent } from './content'
import { resolveRecipients } from './recipients'
import { getBatchEffectiveNotificationPreferences } from './preferences'
import { sendExpoPushNotifications, type ExpoPushMessage } from './expo-push'

export interface DispatchNotificationEventParams {
  organizationId: string
  branchId?: string | null
  type: NotificationType
  resourceType?: string | null
  resourceId?: string | null
  data?: Record<string, unknown>
  targetUserIds?: string[]
  /** Quien hizo la acción no necesita que le avisen (el cajero que cobró, quien cargó la reparación). */
  excludeUserIds?: string[]
  idempotencyKey?: string | null
}

export interface DispatchNotificationResult {
  eventType: NotificationType
  organizationId: string
  candidateRecipients: number
  eligibleRecipients: number
  createdNotifications: number
  skippedByPreference: number
  skippedByPermission: number
  skippedByBranch: number
  skippedByModule?: boolean
  duplicates: number
  notificationIds: string[]
  pushAttempted?: number
  pushDelivered?: number
  pushFailed?: number
}

/**
 * Motor central de despacho de notificaciones operativas en el backend de MiTiendaPy.
 * Ejecuta validación de evento, verificación de plan/módulos, resolución de destinatarios,
 * evaluación de preferencias de entrega, presentación lock-screen y persistencia idempotente.
 */
export async function dispatchNotificationEvent(
  params: DispatchNotificationEventParams
): Promise<DispatchNotificationResult> {
  const {
    organizationId,
    branchId,
    type,
    resourceType,
    resourceId,
    data,
    targetUserIds,
    excludeUserIds,
    idempotencyKey,
  } = params

  // 1. Validar NotificationType
  if (!type || !NOTIFICATION_TYPES.includes(type)) {
    throw new Error(`Invalid or unregistered notification type: ${String(type)}`)
  }

  const metadata = getNotificationMetadata(type)

  // 2. Control de Acceso por Módulos (Module Gating)
  // No enviar notificaciones de módulos que no están habilitados en el plan de la organización.
  // El módulo 'security' es transversal y no requiere verificación de plan comercial.
  if (metadata.requiredModule && metadata.requiredModule !== 'security') {
    try {
      const planInfo = await getOrganizationPlanInfo(organizationId)
      const isModuleEnabled = planInfo.modules.includes(metadata.requiredModule)

      if (!isModuleEnabled) {
        return {
          eventType: type,
          organizationId,
          candidateRecipients: 0,
          eligibleRecipients: 0,
          createdNotifications: 0,
          skippedByPreference: 0,
          skippedByPermission: 0,
          skippedByBranch: 0,
          skippedByModule: true,
          duplicates: 0,
          notificationIds: [],
        }
      }
    } catch (err) {
      console.warn(`[notifications] Failed to resolve plan modules for organization ${organizationId}:`, err)
    }
  }

  // 3. Resolución de Destinatarios Elegibles
  const resolved = await resolveRecipients({
    organizationId,
    branchId,
    type,
    targetUserIds,
  })
  const { candidates, skippedByBranch, skippedByPermission } = resolved
  const excluded = new Set(excludeUserIds ?? [])
  const eligible = resolved.eligible.filter((member) => !excluded.has(member.userId))

  if (eligible.length === 0) {
    return {
      eventType: type,
      organizationId,
      candidateRecipients: candidates.length,
      eligibleRecipients: 0,
      createdNotifications: 0,
      skippedByPreference: 0,
      skippedByPermission,
      skippedByBranch,
      duplicates: 0,
      notificationIds: [],
    }
  }

  // 4. Resolución de Preferencias de Notificación
  const roleByUserId = new Map(eligible.map((m) => [m.userId, m.role]))
  const preferencesMap = await getBatchEffectiveNotificationPreferences({
    organizationId,
    userIds: eligible.map((m) => m.userId),
    notificationType: type,
    roleByUserId,
  })

  let skippedByPreference = 0
  const recipientsToDeliver: typeof eligible = []

  for (const member of eligible) {
    const pref = preferencesMap.get(member.userId)
    if (pref && pref.inAppEnabled === false) {
      skippedByPreference++
    } else {
      recipientsToDeliver.push(member)
    }
  }

  if (recipientsToDeliver.length === 0) {
    return {
      eventType: type,
      organizationId,
      candidateRecipients: candidates.length,
      eligibleRecipients: eligible.length,
      createdNotifications: 0,
      skippedByPreference,
      skippedByPermission,
      skippedByBranch,
      duplicates: 0,
      notificationIds: [],
    }
  }

  // 5. Presentación y Formato del Contenido
  const formatted = formatNotificationContent(type, data)
  const finalResourceType = resourceType ?? formatted.defaultResourceType ?? null
  const finalData = data ?? {}

  // 6. Persistencia In-App con Protección de Idempotencia
  const supabase = createAdminSupabase()
  let createdNotifications = 0
  let duplicates = 0
  const notificationIds: string[] = []
  // Un reintento del mismo evento (clave de idempotencia repetida) no vuelve a sonar en el celular.
  const duplicateUserIds = new Set<string>()

  for (const recipient of recipientsToDeliver) {
    // Generar clave de idempotencia única y determinista para este destinatario
    let recipientIdempotencyKey: string | null = null
    if (idempotencyKey) {
      recipientIdempotencyKey = `${idempotencyKey}:${recipient.userId}`
    } else {
      recipientIdempotencyKey = buildNotificationIdempotencyKey({
        type,
        resourceId: resourceId ?? undefined,
        targetUserId: recipient.userId,
      })
    }

    const notifId = randomUUID()
    const { data: inserted, error: insertError } = await supabase
      .from('notifications')
      .insert({
        id: notifId,
        organization_id: organizationId,
        branch_id: branchId ?? null,
        user_id: recipient.userId,
        type,
        title: formatted.title,
        body: formatted.body,
        data: finalData,
        resource_type: finalResourceType,
        resource_id: resourceId ?? null,
        idempotency_key: recipientIdempotencyKey,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      // Código de PostgreSQL 23505: Unique violation (idempotency_key duplicada)
      if (insertError.code === '23505' || insertError.message?.includes('duplicate key') || insertError.message?.includes('unique constraint')) {
        duplicates++
        duplicateUserIds.add(recipient.userId)
      } else {
        console.error(`[notifications] Error inserting notification for user ${recipient.userId}:`, insertError)
      }
    } else if (inserted) {
      createdNotifications++
      notificationIds.push(inserted.id)
    }
  }

  // 7. Entrega de Notificaciones Push Móviles (Expo Push)
  // Se evalúa para los destinatarios elegibles con pushEnabled, salvo los que ya tenían este evento (reintento).
  // La persistencia in-app ya concluyó exitosamente y cualquier contingencia push es no fatal.
  let pushAttempted = 0
  let pushDelivered = 0
  let pushFailed = 0

  const pushEligibleUserIds = eligible
    .filter((m) => !duplicateUserIds.has(m.userId))
    .filter((m) => {
      const pref = preferencesMap.get(m.userId)
      return pref ? pref.pushEnabled === true : true
    })
    .map((m) => m.userId)

  if (pushEligibleUserIds.length > 0) {
    try {
      const { data: devices, error: devError } = await supabase
        .from('push_devices')
        .select('user_id, push_token')
        .eq('organization_id', organizationId)
        .in('user_id', pushEligibleUserIds)
        .eq('enabled', true)

      if (!devError && devices && devices.length > 0) {
        const pushMessages: ExpoPushMessage[] = devices.map((dev) => ({
          to: dev.push_token,
          title: formatted.title,
          body: formatted.body,
          data: {
            type,
            resourceType: finalResourceType,
            resourceId: resourceId ?? null,
          },
          sound: 'default',
          priority: 'high',
        }))

        const pushResult = await sendExpoPushNotifications(pushMessages)
        pushAttempted = pushResult.attempted
        pushDelivered = pushResult.delivered
        pushFailed = pushResult.failed
      }
    } catch (pushErr) {
      console.warn('[notifications] Error no fatal despachando push notifications:', pushErr)
    }
  }

  return {
    eventType: type,
    organizationId,
    candidateRecipients: candidates.length,
    eligibleRecipients: eligible.length,
    createdNotifications,
    skippedByPreference,
    skippedByPermission,
    skippedByBranch,
    duplicates,
    notificationIds,
    pushAttempted,
    pushDelivered,
    pushFailed,
  }
}
