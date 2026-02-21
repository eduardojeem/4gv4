'use client'

import { useCallback } from 'react'
import { openWhatsApp, WhatsAppTemplates, getBusinessWhatsApp, type WhatsAppMessageOptions } from '@/lib/whatsapp'
import { toast } from 'sonner'

export function useWhatsApp() {
  const sendMessage = useCallback((options: WhatsAppMessageOptions) => {
    try {
      openWhatsApp(options)
    } catch (error) {
      console.error('Error opening WhatsApp:', error)
      toast.error('No se pudo abrir WhatsApp')
    }
  }, [])

  const contactBusiness = useCallback((message?: string) => {
    sendMessage({
      phone: getBusinessWhatsApp(),
      message: message || WhatsAppTemplates.generalInquiry()
    })
  }, [sendMessage])

  const notifyRepairStatus = useCallback((
    customerPhone: string,
    repairId: string,
    customerName: string,
    status: string
  ) => {
    sendMessage({
      phone: customerPhone,
      message: WhatsAppTemplates.repairStatus(repairId, customerName, status)
    })
  }, [sendMessage])

  const notifyRepairReady = useCallback((
    customerPhone: string,
    repairId: string,
    customerName: string,
    device: string
  ) => {
    sendMessage({
      phone: customerPhone,
      message: WhatsAppTemplates.repairReady(repairId, customerName, device)
    })
  }, [sendMessage])

  const sendPaymentReminder = useCallback((
    customerPhone: string,
    customerName: string,
    amount: number,
    repairId: string
  ) => {
    sendMessage({
      phone: customerPhone,
      message: WhatsAppTemplates.paymentReminder(customerName, amount, repairId)
    })
  }, [sendMessage])

  const trackRepair = useCallback((repairId: string) => {
    contactBusiness(WhatsAppTemplates.trackRepair(repairId))
  }, [contactBusiness])

  const inquirePrice = useCallback((productOrService: string) => {
    contactBusiness(WhatsAppTemplates.priceInquiry(productOrService))
  }, [contactBusiness])

  return {
    sendMessage,
    contactBusiness,
    notifyRepairStatus,
    notifyRepairReady,
    sendPaymentReminder,
    trackRepair,
    inquirePrice,
    templates: WhatsAppTemplates,
  }
}
