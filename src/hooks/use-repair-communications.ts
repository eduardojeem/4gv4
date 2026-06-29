import { useState, useEffect, useCallback } from 'react'
import { CommunicationMessage, CommunicationChannel } from '@/types/repairs'
import { toast } from 'sonner'
import { formatWhatsAppPhone } from '@/lib/whatsapp'

// ---------------------------------------------------------------------------
// Entrega por apps externas (fallback manual)
// ---------------------------------------------------------------------------

function openExternalApp(
  channel: CommunicationChannel,
  content: string,
  customerPhone?: string,
  customerEmail?: string
): boolean {
  try {
    if (channel === 'whatsapp' && customerPhone) {
      const phone = formatWhatsAppPhone(customerPhone)
      const text = encodeURIComponent(content)
      // En escritorio abrimos WhatsApp Web directo al chat (evita la página
      // intermedia api.whatsapp.com); en móvil usamos wa.me para abrir la app.
      const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      const url = isMobile
        ? `https://wa.me/${phone}?text=${text}`
        : `https://web.whatsapp.com/send?phone=${phone}&text=${text}`
      // Abrimos sin 'noopener' para obtener la referencia (con noopener window.open
      // devuelve null aunque la ventana se abra) y anulamos opener por seguridad.
      // Solo ventana nueva; nunca redirigimos la página actual.
      const win = window.open(url, '_blank')
      if (win) win.opener = null
      return Boolean(win)
    }
    if (channel === 'email' && customerEmail) {
      const subject = encodeURIComponent('Actualizacion de reparacion')
      const body = encodeURIComponent(content)
      window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`
      return true
    }
    if (channel === 'sms' && customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '')
      window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(content)}`
      return true
    }
  } catch (error) {
    console.error('Error opening external app:', error)
  }
  return false
}

// ---------------------------------------------------------------------------
// Validación de canal/contacto
// ---------------------------------------------------------------------------

function validate(
  channel: CommunicationChannel,
  content: string,
  phone?: string,
  email?: string
): string | null {
  if (!content.trim()) return 'El contenido del mensaje esta vacio'
  if (channel === 'whatsapp' || channel === 'sms') {
    if (!phone) return 'El cliente no tiene telefono registrado'
    if (phone.replace(/\D/g, '').length < 6) return 'Numero de telefono invalido'
  }
  if (channel === 'email') {
    if (!email) return 'El cliente no tiene email registrado'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Formato de email invalido'
  }
  return null
}

// ---------------------------------------------------------------------------
// Mapeo de filas del servidor
// ---------------------------------------------------------------------------

type ServerMessage = {
  id: string
  repair_id: string | null
  channel: string | null
  content: string | null
  status: string | null
  sent_at: string | null
  created_at: string | null
}

function mapServerMessage(m: ServerMessage): CommunicationMessage {
  return {
    id: m.id,
    repairId: m.repair_id ?? '',
    channel: (m.channel || 'whatsapp') as CommunicationChannel,
    content: m.content || '',
    sentAt: m.sent_at || m.created_at || new Date().toISOString(),
    status: (m.status || 'sent') as CommunicationMessage['status'],
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRepairCommunications(repairId: string | undefined) {
  const [messages, setMessages] = useState<CommunicationMessage[]>([])
  const [loading, setLoading] = useState(false)

  // Lectura vía API server-side (org-scoped). Evita la dependencia de la RLS
  // evaluada en el cliente y es consistente con el resto de la app.
  const fetchMessages = useCallback(async () => {
    if (!repairId) {
      setMessages([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/repairs/communications?repairId=${encodeURIComponent(repairId)}`,
        { cache: 'no-store' }
      )
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || `http_${res.status}`)
      }
      const rows = (payload.messages ?? []) as ServerMessage[]
      setMessages(rows.map(mapServerMessage))
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast.error('Error al cargar historial de mensajes')
    } finally {
      setLoading(false)
    }
  }, [repairId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const sendMessage = async (
    channel: CommunicationChannel,
    content: string,
    customerPhone?: string,
    customerEmail?: string,
    templateId?: string
  ): Promise<boolean> => {
    if (!repairId) return false

    const trimmedContent = content.trim()
    const validationError = validate(channel, trimmedContent, customerPhone, customerEmail)
    if (validationError) {
      toast.error(validationError)
      return false
    }

    // Mensaje optimista
    const tempId = `temp-${Date.now()}`
    setMessages((prev) => [
      { id: tempId, repairId, channel, content: trimmedContent, sentAt: new Date().toISOString(), status: 'pending' },
      ...prev,
    ])

    // Entrega: todos los canales abren la app/ventana externa correspondiente.
    // WhatsApp abre wa.me en una ventana nueva (no se envía silenciosamente).
    const delivered = openExternalApp(channel, trimmedContent, customerPhone, customerEmail)

    // Los canales son manuales (abren una app externa): el envío real lo hace
    // el usuario. Quedan 'pending' hasta que confirme en el historial.
    const finalStatus: CommunicationMessage['status'] = delivered ? 'pending' : 'failed'

    // Persistencia vía API server-side (setea organization_id desde la reparación).
    try {
      const response = await fetch('/api/repairs/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repairId,
          channel,
          content: trimmedContent,
          templateId,
          status: finalStatus,
          toEmail: customerEmail ?? null,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `http_${response.status}`)
      }

      const insertedId: string | undefined = payload.message?.id
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: insertedId ?? m.id, status: finalStatus } : m))
      )

      if (!delivered) {
        if (channel === 'whatsapp') {
          toast.error('No se pudo abrir WhatsApp. Permite las ventanas emergentes para este sitio.')
        } else {
          toast.error(`No se pudo abrir ${channelLabel(channel)}`)
        }
        return false
      }
      if (channel === 'whatsapp') {
        toast.success('WhatsApp abierto — confirma el envío en el historial')
      } else {
        toast.success(`${channelLabel(channel)} abierto — confirma el envío en el historial`)
      }
      return true
    } catch (error) {
      console.error('Error saving message:', error)
      toast.error('Error al guardar en historial')
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      return false
    }
  }

  // Confirmar/cambiar el estado de un mensaje (enviado / fallido) desde el historial.
  const updateStatus = async (id: string, status: CommunicationMessage['status']): Promise<void> => {
    if (id.startsWith('temp-')) return
    const previous = messages
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)))
    try {
      const res = await fetch('/api/repairs/communications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || `http_${res.status}`)
    } catch (error) {
      console.error('Error updating message status:', error)
      toast.error('No se pudo actualizar el estado')
      setMessages(previous)
    }
  }

  return { messages, loading, sendMessage, updateStatus, refresh: fetchMessages }
}

function channelLabel(channel: CommunicationChannel): string {
  if (channel === 'whatsapp') return 'WhatsApp'
  if (channel === 'email') return 'Email'
  if (channel === 'sms') return 'SMS'
  return channel
}
