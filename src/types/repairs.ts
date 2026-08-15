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
export type RepairDeliveryOutcome = 'repaired' | 'unrepairable' | 'withdrawn'
export type RepairPricingMode = 'automatic' | 'budget' | 'manual'
export type RepairPaymentStatus = 'pendiente' | 'parcial' | 'pagado'
export type DeviceType = 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'accessory' | 'other'

export interface Customer {
  id?: string
  customerCode?: string
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
  isInternal?: boolean
}

export interface RepairPart {
  id: string | number
  name: string
  cost: number
  internalCost?: number
  quantity: number
  stockAvailable?: number | null
  supplier: string
  partNumber: string
  /** Producto de inventario del que salió este repuesto. Sin esto no hay
   *  forma de descontar stock ni de saber qué repuestos vinieron del
   *  inventario vs. de un proveedor externo. */
  productId?: string | null
}

export interface RepairPartResolution {
  repairPartId: string
  productId?: string | null
  name: string
  quantity: number
  unitPrice: number
  disposition: 'consumed' | 'restocked'
}

export interface RepairCloseout {
  id: string
  outcome: 'withdrawn' | 'unrepairable'
  chargeMode: 'none' | 'labor' | 'labor_and_consumed_parts' | 'exceptional'
  laborCharge: number
  consumedPartsCharge: number
  finalCharge: number
  paidBefore: number
  settlementKind: 'none' | 'payment' | 'outstanding' | 'refund' | 'store_credit'
  settlementAmount: number
  settlementMethod?: 'cash' | 'card' | 'transfer' | null
  settlementReference?: string | null
  reason?: string | null
  note?: string | null
  createdBy?: string | null
  createdAt: string
  parts: RepairPartResolution[]
}

export interface RepairImage {
  id: string
  url: string
  description?: string
}

export interface RepairPayment {
  id: string
  amount: number
  method: 'cash' | 'card' | 'transfer' | 'credit' | 'mixed'
  reference?: string | null
  notes?: string | null
  source: 'repairs' | 'delivery' | 'pos' | 'migration'
  createdAt: string
  createdBy?: string | null
}

export interface RepairNotifications {
  customer: boolean
  technician: boolean
  manager: boolean
}

export interface Repair {
  id: string
  ticketNumber?: string
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
  pricingMode?: RepairPricingMode
  discountAmount?: number
  priceOverrideReason?: string
  pricingUpdatedAt?: string | null
  estimatedDuration?: number  // Duración estimada en minutos
  technician: Technician | null
  location: string
  warranty: string | null
  warrantyMonths?: number
  warrantyType?: 'labor' | 'parts' | 'full'
  warrantyNotes?: string
  warrantyExpiresAt?: string | null
  pickedUpAt?: string | null  // Fecha en que el cliente retiró el equipo
  deliveryOutcome?: RepairDeliveryOutcome | null  // Resultado de la entrega
  createdAt: string
  estimatedCompletion: string | null
  completedAt: string | null
  paymentStatus?: RepairPaymentStatus
  paidAmount?: number
  payments?: RepairPayment[]
  closeout?: RepairCloseout | null
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
export type CommunicationStatus = 'pending' | 'sent' | 'failed'

export interface CommunicationMessage {
  id: string
  repairId: string
  channel: CommunicationChannel
  content: string
  sentAt: string
  status: CommunicationStatus
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
