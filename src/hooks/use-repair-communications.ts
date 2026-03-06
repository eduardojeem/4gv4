import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CommunicationMessage, CommunicationChannel } from '@/types/repairs'
import { toast } from 'sonner'
import { getWhatsAppLink, formatWhatsAppPhone } from '@/lib/whatsapp'

function getChannelLabel(channel: CommunicationChannel): string {
  if (channel === 'whatsapp') return 'WhatsApp'
  if (channel === 'email') return 'Email'
  if (channel === 'sms') return 'SMS'
  return channel
}

function openExternalApp(
  channel: CommunicationChannel,
  content: string,
  customerPhone?: string,
  customerEmail?: string
): boolean {
  try {
    if (channel === 'whatsapp' && customerPhone) {
      const url = getWhatsAppLink({ phone: formatWhatsAppPhone(customerPhone), message: content })
      const win = window.open(url, '_blank', 'noopener,noreferrer')
      if (!win) {
        window.location.href = url
      }
      return true
    }

    if (channel === 'email' && customerEmail) {
      const subject = encodeURIComponent('Actualizacion de reparacion')
      const body = encodeURIComponent(content)
      window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`
      return true
    }

    if (channel === 'sms' && customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '')
      const body = encodeURIComponent(content)
      window.location.href = `sms:${cleanPhone}?body=${body}`
      return true
    }
  } catch (error) {
    console.error('Error opening external app:', error)
  }

  return false
}

interface WhatsAppSendResult {
  sent: boolean
  reason?: string
}

async function sendWhatsAppViaCloud(
  repairId: string,
  content: string,
  customerPhone?: string
): Promise<WhatsAppSendResult> {
  if (!customerPhone) {
    return { sent: false, reason: 'missing_phone' }
  }

  try {
    const response = await fetch('/api/repairs/communications/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repairId,
        phone: customerPhone,
        content,
      }),
    })

    if (!response.ok) {
      return { sent: false, reason: `http_${response.status}` }
    }

    const data = await response.json()
    return {
      sent: data?.sent === true,
      reason: typeof data?.reason === 'string' ? data.reason : undefined,
    }
  } catch (error) {
    console.error('Error sending WhatsApp via Cloud API:', error)
    return { sent: false, reason: 'network_error' }
  }
}

export function useRepairCommunications(repairId: string | undefined) {
  const [messages, setMessages] = useState<CommunicationMessage[]>([])
  const [loading, setLoading] = useState(false)

  const fetchMessages = useCallback(async () => {
    if (!repairId) {
      setMessages([])
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('communication_messages')
      .select('*')
      .eq('repair_id', repairId)
      .order('sent_at', { ascending: false })

    if (error) {
      console.error('Error fetching messages:', error)
      toast.error('Error al cargar historial de mensajes')
      setLoading(false)
      return
    }

    const mapped: CommunicationMessage[] = (data || []).map((m: any) => ({
      id: m.id,
      repairId: m.repair_id,
      channel: (m.channel || 'whatsapp') as CommunicationChannel,
      content: m.content || '',
      sentAt: m.sent_at || m.created_at || new Date().toISOString(),
      status: (m.status || 'sent') as 'pending' | 'sent' | 'failed',
    }))

    setMessages(mapped)
    setLoading(false)
  }, [repairId])

  useEffect(() => {
    fetchMessages()

    if (!repairId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`comms-${repairId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communication_messages',
          filter: `repair_id=eq.${repairId}`,
        },
        () => {
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMessages, repairId])

  const sendMessage = async (
    channel: CommunicationChannel,
    content: string,
    customerPhone?: string,
    customerEmail?: string,
    templateId?: string
  ) => {
    if (!repairId) return false

    const trimmedContent = content.trim()
    if (!trimmedContent) {
      toast.error('El contenido del mensaje esta vacio')
      return false
    }

    if (channel === 'whatsapp' || channel === 'sms') {
      if (!customerPhone) {
        toast.error('El cliente no tiene telefono registrado')
        return false
      }
      const cleanPhone = customerPhone.replace(/\D/g, '')
      if (cleanPhone.length < 6) {
        toast.error('Numero de telefono invalido')
        return false
      }
    }

    if (channel === 'email') {
      if (!customerEmail) {
        toast.error('El cliente no tiene email registrado')
        return false
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(customerEmail)) {
        toast.error('Formato de email invalido')
        return false
      }
    }

    const supabase = createClient()

    const tempId = `temp-${Date.now()}`
    const newMessage: CommunicationMessage = {
      id: tempId,
      repairId,
      channel,
      content: trimmedContent,
      sentAt: new Date().toISOString(),
      status: 'pending',
    }
    setMessages((prev) => [newMessage, ...prev])

    let delivered = false
    let usedCloudApi = false
    let usedManualFallback = false
    let failureReason: string | undefined

    if (channel === 'whatsapp') {
      const cloudResult = await sendWhatsAppViaCloud(repairId, trimmedContent, customerPhone)
      if (cloudResult.sent) {
        delivered = true
        usedCloudApi = true
      } else {
        failureReason = cloudResult.reason
        delivered = openExternalApp(channel, trimmedContent, customerPhone, customerEmail)
        usedManualFallback = delivered
      }
    } else {
      delivered = openExternalApp(channel, trimmedContent, customerPhone, customerEmail)
    }

    const finalStatus: 'sent' | 'failed' = delivered ? 'sent' : 'failed'

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('communication_messages')
        .insert({
          repair_id: repairId,
          channel,
          content: trimmedContent,
          template_id: templateId,
          status: finalStatus,
          direction: 'outbound',
          sent_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: inserted.id, status: finalStatus } : m))
      )

      if (delivered) {
        if (channel === 'whatsapp' && usedCloudApi) {
          toast.success('Mensaje enviado por WhatsApp Cloud')
        } else if (channel === 'whatsapp' && usedManualFallback && failureReason === 'provider_error') {
          toast.success('Cloud API fallo, se abrio WhatsApp manualmente')
        } else if (channel === 'whatsapp' && usedManualFallback && failureReason === 'network_error') {
          toast.success('Sin conexion a Cloud API, se abrio WhatsApp manualmente')
        } else if (channel === 'whatsapp' && usedManualFallback && failureReason === 'not_configured') {
          toast.success('WhatsApp Cloud no configurado, se abrio WhatsApp manualmente')
        } else if (channel === 'whatsapp') {
          toast.success('WhatsApp abierto y mensaje registrado')
        } else {
          toast.success(`${getChannelLabel(channel)} sincronizado y abierto`)
        }
        return true
      }

      if (channel === 'whatsapp' && failureReason === 'not_configured') {
        toast.error('WhatsApp Cloud no esta configurado y no se pudo abrir WhatsApp')
      } else if (channel === 'whatsapp' && failureReason === 'provider_error') {
        toast.error('WhatsApp Cloud rechazo el envio y no se pudo abrir WhatsApp')
      } else if (channel === 'whatsapp' && failureReason === 'network_error') {
        toast.error('Sin conexion con WhatsApp Cloud y no se pudo abrir WhatsApp')
      } else {
        toast.error(`No se pudo abrir ${getChannelLabel(channel)}`)
      }
      return false
    } catch (error) {
      console.error('Error saving message:', error)
      toast.error('Error al guardar en historial')
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      return false
    }
  }

  return { messages, loading, sendMessage, refresh: fetchMessages }
}
