import type { AppointmentStatus } from '@/lib/agenda/agenda-api'
import type { AgendaProfessional, AgendaProfessionalRate, AgendaService, AgendaSettings } from '@/lib/agenda/agenda-server'

export type Appointment = {
  buffer_minutes?: number
  occupied_until?: string
  id: string
  number: number
  professional_id: string | null
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  service_product_id: string | null
  service_name: string
  price: number
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  source: 'dashboard' | 'online'
  notes: string | null
  cancel_reason: string | null
  public_token: string
  sale_id: string | null
  confirmed_at: string | null
  reminder_sent_at: string | null
  created_at: string
}

export type AgendaData = {
  capabilities?: {professionalBooking:boolean}
  professionalRates?: AgendaProfessionalRate[]
  available: boolean
  date: string
  days: number
  appointments: Appointment[]
  pendingCount: number
  settings: AgendaSettings
  professionals: AgendaProfessional[]
  services: AgendaService[]
  timeZone: string
  currency: string
  storeName: string
  storeSlug: string
  canConfigure: boolean
}
