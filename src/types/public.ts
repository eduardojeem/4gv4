/**
 * Public Portal Types
 * Types for publicly accessible data (products, repairs)
 */

import { RepairStatus, RepairPriority } from './repairs'

/**
 * Public Product - Safe for public viewing
 * Excludes sensitive data like purchase prices, supplier details, etc.
 */
export interface PublicProduct {
  id: string
  name: string
  sku: string
  description: string | null
  brand: string | null
  category?: {
    id: string
    name: string
  }
  sale_price: number
  wholesale_price: number | null
  stock_quantity: number
  is_active: boolean
  featured: boolean
  image: string | null
  images: string[] | null
  unit_measure: string
  barcode: string | null
}

/**
 * Public Repair - Simplified view for customers
 * Shows only essential information without internal notes
 */
export interface PublicRepair {
  ticketNumber: string
  device: string
  brand: string
  model: string
  deviceType: string
  issue: string
  status: RepairStatus
  priority: RepairPriority
  createdAt: string
  estimatedCompletion?: string | null
  completedAt?: string | null
  estimatedCost: number
  finalCost: number | null
  warrantyMonths: number | null
  warrantyType: 'labor' | 'parts' | 'full' | null
  statusHistory?: Array<{
    status: string
    note?: string
    created_at: string
  }>
  technician: {
    name: string
  } | null
  customer: {
    name: string
    phone: string
  }
}

/**
 * Repair Authentication Request
 */
export interface RepairAuthRequest {
  contact: string  // email or phone
  ticketNumber: string
}

/**
 * Repair Authentication Response
 */
export interface RepairAuthResponse {
  token: string
  repair: PublicRepair
  expiresIn: number  // seconds
}
