export type DashboardWhatsAppSource = 'manual' | 'bulk' | 'auto'
export type DashboardWhatsAppStatus = 'pending' | 'sent' | 'failed'

const WHATSAPP_UPDATED_EVENT = 'dashboard:whatsapp-updated'
const WHATSAPP_STORAGE_EVENT_KEY = 'dashboard:whatsapp-updated-at'

export interface DashboardWhatsAppMessage {
  id: string
  phone: string
  recipient_name: string | null
  message: string
  source: DashboardWhatsAppSource
  status: DashboardWhatsAppStatus
  provider: string | null
  provider_reason: string | null
  provider_message_id: string | null
  sent_at: string
  created_at: string
}

export interface DashboardWhatsAppStats {
  total: number
  today: number
  thisWeek: number
  thisMonth: number
  uniqueContacts: number
  avgPerDay: number
}

export interface DashboardWhatsAppChartPoint {
  name: string
  mensajes: number
}

export interface DashboardWhatsAppSettings {
  businessPhone: string
  autoNotifyRepairReady: boolean
  autoNotifyStatusChange: boolean
  autoPaymentReminders: boolean
  reminderDays: number
  businessHoursStart: string
  businessHoursEnd: string
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function toErrorMessage(payload: any, fallback: string): string {
  if (payload && typeof payload === 'object') {
    if (typeof payload.error === 'string') return payload.error
    if (typeof payload.reason === 'string') return payload.reason
  }
  return fallback
}

export async function fetchDashboardWhatsAppMessages(params?: {
  search?: string
  source?: DashboardWhatsAppSource | 'all'
  status?: DashboardWhatsAppStatus | 'all'
  limit?: number
}): Promise<DashboardWhatsAppMessage[]> {
  const query = new URLSearchParams()

  if (params?.search) query.set('search', params.search)
  if (params?.source && params.source !== 'all') query.set('source', params.source)
  if (params?.status && params.status !== 'all') query.set('status', params.status)
  if (params?.limit) query.set('limit', String(params.limit))

  const response = await fetch(`/api/dashboard/whatsapp/messages${query.toString() ? `?${query}` : ''}`, {
    cache: 'no-store',
  })
  const payload = await safeJson(response)

  if (!response.ok || payload?.ok === false) {
    throw new Error(toErrorMessage(payload, 'No se pudo cargar el historial'))
  }

  return Array.isArray(payload?.messages) ? payload.messages : []
}

export async function sendDashboardWhatsAppMessage(input: {
  phone: string
  message: string
  source?: DashboardWhatsAppSource
  transport?: 'cloud' | 'manual'
  customerId?: string | null
  recipientName?: string | null
  metadata?: Record<string, unknown>
}): Promise<{ sent: boolean; reason: string | null; message: DashboardWhatsAppMessage | null }> {
  const response = await fetch('/api/dashboard/whatsapp/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const payload = await safeJson(response)

  if (!response.ok || payload?.ok === false) {
    throw new Error(toErrorMessage(payload, 'No se pudo enviar el mensaje'))
  }

  return {
    sent: payload?.sent === true,
    reason: typeof payload?.reason === 'string' ? payload.reason : null,
    message: payload?.message ?? null,
  }
}

export async function updateDashboardWhatsAppMessage(input: {
  id: string
  status?: DashboardWhatsAppStatus
  provider?: string | null
  providerReason?: string | null
  metadata?: Record<string, unknown>
}): Promise<DashboardWhatsAppMessage> {
  const response = await fetch('/api/dashboard/whatsapp/messages', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const payload = await safeJson(response)

  if (!response.ok || payload?.ok === false || !payload?.message) {
    throw new Error(toErrorMessage(payload, 'No se pudo actualizar el mensaje'))
  }

  return payload.message as DashboardWhatsAppMessage
}

export async function deleteDashboardWhatsAppMessage(id: string): Promise<void> {
  const response = await fetch(`/api/dashboard/whatsapp/messages?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  const payload = await safeJson(response)

  if (!response.ok || payload?.ok === false) {
    throw new Error(toErrorMessage(payload, 'No se pudo eliminar el mensaje'))
  }
}

export async function clearDashboardWhatsAppHistory(): Promise<void> {
  const response = await fetch('/api/dashboard/whatsapp/messages?all=true', {
    method: 'DELETE',
  })

  const payload = await safeJson(response)

  if (!response.ok || payload?.ok === false) {
    throw new Error(toErrorMessage(payload, 'No se pudo limpiar el historial'))
  }
}

export async function fetchDashboardWhatsAppStats(): Promise<{
  stats: DashboardWhatsAppStats
  chartData: DashboardWhatsAppChartPoint[]
  breakdown: {
    byStatus: Record<string, number>
    bySource: Record<string, number>
  }
}> {
  const response = await fetch('/api/dashboard/whatsapp/stats', {
    cache: 'no-store',
  })

  const payload = await safeJson(response)

  if (!response.ok || payload?.ok === false) {
    throw new Error(toErrorMessage(payload, 'No se pudieron cargar las métricas'))
  }

  return {
    stats: payload?.stats,
    chartData: Array.isArray(payload?.chartData) ? payload.chartData : [],
    breakdown: payload?.breakdown || { byStatus: {}, bySource: {} },
  }
}

export async function fetchDashboardWhatsAppSettings(): Promise<DashboardWhatsAppSettings> {
  const response = await fetch('/api/dashboard/whatsapp/settings', {
    cache: 'no-store',
  })

  const payload = await safeJson(response)

  if (!response.ok || payload?.ok === false || !payload?.settings) {
    throw new Error(toErrorMessage(payload, 'No se pudo cargar la configuración'))
  }

  return payload.settings as DashboardWhatsAppSettings
}

export async function saveDashboardWhatsAppSettings(
  settings: DashboardWhatsAppSettings
): Promise<DashboardWhatsAppSettings> {
  const response = await fetch('/api/dashboard/whatsapp/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })

  const payload = await safeJson(response)

  if (!response.ok || payload?.ok === false || !payload?.settings) {
    throw new Error(toErrorMessage(payload, 'No se pudo guardar la configuración'))
  }

  return payload.settings as DashboardWhatsAppSettings
}

export function notifyDashboardWhatsAppUpdated(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WHATSAPP_UPDATED_EVENT))
  try {
    localStorage.setItem(WHATSAPP_STORAGE_EVENT_KEY, String(Date.now()))
  } catch {}
}

export function subscribeDashboardWhatsAppUpdates(onUpdate: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const onWindowEvent = () => onUpdate()
  const onStorageEvent = (event: StorageEvent) => {
    if (event.key === WHATSAPP_STORAGE_EVENT_KEY) {
      onUpdate()
    }
  }
  const onVisibilityChange = () => {
    if (!document.hidden) {
      onUpdate()
    }
  }

  window.addEventListener(WHATSAPP_UPDATED_EVENT, onWindowEvent)
  window.addEventListener('storage', onStorageEvent)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    window.removeEventListener(WHATSAPP_UPDATED_EVENT, onWindowEvent)
    window.removeEventListener('storage', onStorageEvent)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

