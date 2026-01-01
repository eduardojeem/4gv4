import { LucideIcon } from 'lucide-react'

/**
 * Estado de la reparación (alineado con la base de datos)
 * - recibido: Reparación recibida
 * - diagnostico: En diagnóstico
 * - reparacion: En reparación
 * - pausado: En pausa / esperando piezas
 * - listo: Listo para entrega
 * - entregado: Entregado al cliente
 * - cancelado: Cancelado
 */
export type RepairStatus =
  | 'recibido'
  | 'diagnostico'
  | 'reparacion'
  | 'pausado'
  | 'listo'
  | 'entregado'
  | 'cancelado'

// Alias para compatibilidad con dashboard técnico
export type DbRepairStatus = RepairStatus

export type RepairPriority = 'low' | 'medium' | 'high'
export type RepairUrgency = 'normal' | 'urgent'
export type DeviceType = 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'accessory' | 'other'

export interface Customer {
  name: string
  phone: string
  email: string
}

export interface Technician {
  name: string
  id: string
}

export interface RepairNote {
  id: number
  text: string
  timestamp: string
  author: string
}

export interface RepairPart {
  id: number
  name: string
  cost: number
  quantity: number
  supplier: string
  partNumber: string
}

export interface RepairImage {
  id: string
  url: string
  description?: string
}

export interface RepairNotifications {
  customer: boolean
  technician: boolean
  manager: boolean
}

export interface Repair {
  id: string
  customer: Customer
  device: string
  deviceType: DeviceType
  brand: string
  model: string
  issue: string
  description: string
  accessType?: 'none' | 'pin' | 'password' | 'pattern' | 'biometric' | 'other'
  accessPassword?: string
  status: RepairStatus
  dbStatus?: DbRepairStatus  // Para compatibilidad con dashboard técnico
  priority: RepairPriority
  urgency: RepairUrgency
  estimatedCost: number
  finalCost: number | null
  laborCost: number
  estimatedDuration?: number  // Duración estimada en minutos
  technician: Technician | null
  location: string
  warranty: string | null
  createdAt: string
  estimatedCompletion: string | null
  completedAt: string | null
  lastUpdate: string
  progress: number
  customerRating: number | null
  notes: RepairNote[]
  parts: RepairPart[]
  images: RepairImage[]
  notifications: RepairNotifications
}

export interface StatusConfigItem {
  label: string
  color: string
  icon: LucideIcon
  bgColor: string
  lightBg: string
  columnBg?: string
}

export interface PriorityConfigItem {
  label: string
  color: string
  bgColor: string
  icon: string
}

export interface UrgencyConfigItem {
  label: string
  color: string
  icon: LucideIcon
}

export interface DeviceTypeConfigItem {
  label: string
  icon: LucideIcon
}

export interface RepairOrder {
  id: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  deviceModel?: string
  deviceType?: string
  issueDescription?: string
  urgency?: number
  historicalValue?: number
  technicalComplexity?: number
  createdAt: string
  updatedAt?: string
  stage?: string
  estimatedDurationHours?: number
  technician?: {
    id: string
    name: string
  }
}

export interface PriorityRuleCondition {
  stage?: string
  deviceModelIncludes?: string
  issueIncludes?: string
  minUrgency?: number
}

export interface PriorityRuleEffect {
  priorityBonus?: number
  priorityMultiplier?: number
}

export interface PriorityRule {
  id: string
  name: string
  condition: PriorityRuleCondition
  effect: PriorityRuleEffect
}

export interface PriorityConfig {
  weights: {
    urgencyWeight: number
    waitTimeWeight: number
    historicalValueWeight: number
    technicalComplexityWeight: number
  }
  rules: PriorityRule[]
}

export interface PriorityLogEntry {
  repairId: string
  at: string
  score?: number
  note?: string
}

export type CommunicationChannel = 'email' | 'sms' | 'whatsapp' | 'in_app'

export interface CommunicationMessage {
  id: string
  repairId: string
  channel: CommunicationChannel
  content: string
  sentAt: string
  status: 'sent' | 'failed'
}

export interface CommunicationTemplate {
  id: string
  name?: string
  channel: CommunicationChannel
  content: string
}

export interface ReminderTrigger {
  stage: string
  inactivityHours: number
}

export interface ReminderRule {
  id: string
  templateId: string
  trigger: ReminderTrigger
}

// Tipos faltantes para inventory-repair-sync
export interface InventoryAlert {
  id: string
  productId: string
  level: 'warning' | 'error' | 'info'
  message: string
  repairId?: string
  createdAt?: string
}

export interface InventoryReservation {
  id: string
  productId: string
  quantity: number
  repairId: string
  reservedAt: string
  expiresAt?: string
  status: 'active' | 'expired' | 'consumed'
}
