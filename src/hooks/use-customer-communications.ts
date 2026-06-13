'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

export interface CommTemplate {
  id: string
  name: string
  subject: string
  content: string
  type: string
  category: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CommCampaign {
  id: string
  name: string
  description: string
  templateId: string
  targetSegment: string
  status: string
  scheduledAt: string | null
  sentAt: string | null
  recipientCount: number
  sentCount: number
  createdAt: string
}

export interface CommMessage {
  id: string
  campaignId: string | null
  customerId: string | null
  customerName: string
  toEmail: string
  subject: string
  type: string
  status: string
  sentAt: string
}

export interface CampaignRecipient {
  id?: string
  name?: string
  email?: string
}

const T = '/api/communications/templates'
const C = '/api/communications/campaigns'
const M = '/api/communications/messages'

export function useCustomerCommunications() {
  const [templates, setTemplates] = useState<CommTemplate[]>([])
  const [campaigns, setCampaigns] = useState<CommCampaign[]>([])
  const [history, setHistory] = useState<CommMessage[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [tr, cr, mr] = await Promise.all([fetch(T), fetch(C), fetch(M)])
      const [tj, cj, mj] = await Promise.all([tr.json(), cr.json(), mr.json()])
      setTemplates(Array.isArray(tj.templates) ? tj.templates : [])
      setCampaigns(Array.isArray(cj.campaigns) ? cj.campaigns : [])
      setHistory(Array.isArray(mj.messages) ? mj.messages : [])
    } catch (err) {
      console.error('Error cargando comunicaciones:', err)
      toast.error('No se pudieron cargar las comunicaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // ---- Plantillas ----
  const createTemplate = useCallback(async (data: Partial<CommTemplate>) => {
    try {
      const res = await fetch(T, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error al crear la plantilla')
      const { template } = await res.json()
      setTemplates(prev => [template, ...prev])
      toast.success('Plantilla creada')
      return template as CommTemplate
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la plantilla')
      return null
    }
  }, [])

  const updateTemplate = useCallback(async (id: string, data: Partial<CommTemplate>) => {
    try {
      const res = await fetch(`${T}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      const { template } = await res.json()
      setTemplates(prev => prev.map(t => (t.id === id ? template : t)))
      toast.success('Plantilla actualizada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar')
    }
  }, [])

  const deleteTemplate = useCallback(async (id: string) => {
    const prev = templates
    setTemplates(p => p.filter(t => t.id !== id))
    try {
      const res = await fetch(`${T}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Plantilla eliminada')
    } catch {
      setTemplates(prev)
      toast.error('No se pudo eliminar la plantilla')
    }
  }, [templates])

  // ---- Campañas ----
  const createCampaign = useCallback(async (data: Partial<CommCampaign>) => {
    try {
      const res = await fetch(C, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error al crear la campaña')
      const { campaign } = await res.json()
      setCampaigns(prev => [campaign, ...prev])
      toast.success('Campaña creada')
      return campaign as CommCampaign
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la campaña')
      return null
    }
  }, [])

  const updateCampaign = useCallback(async (id: string, data: Partial<CommCampaign>) => {
    try {
      const res = await fetch(`${C}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      const { campaign } = await res.json()
      setCampaigns(prev => prev.map(c => (c.id === id ? campaign : c)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar la campaña')
    }
  }, [])

  const deleteCampaign = useCallback(async (id: string) => {
    const prev = campaigns
    setCampaigns(p => p.filter(c => c.id !== id))
    try {
      const res = await fetch(`${C}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Campaña eliminada')
    } catch {
      setCampaigns(prev)
      toast.error('No se pudo eliminar la campaña')
    }
  }, [campaigns])

  // ---- Envío real ----
  const sendCampaign = useCallback(
    async (campaignId: string, recipients: CampaignRecipient[]) => {
      try {
        const res = await fetch(`${C}/${campaignId}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error || 'Error al enviar la campaña')

        toast.success(
          `Campaña enviada: ${json.sent} de ${json.total}` +
            (json.failed > 0 ? ` (${json.failed} fallaron)` : ''),
        )
        await refresh()
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo enviar la campaña')
        return false
      }
    },
    [refresh],
  )

  return {
    templates,
    campaigns,
    history,
    loading,
    refresh,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    sendCampaign,
  }
}
