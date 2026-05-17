// ============================================================================
// CASH ADMIN MONITOR - Types & Interfaces
// ============================================================================

export type SessionStatus = 'open' | 'closed' | 'suspended' | 'blocked'

export type AdminAction =
  | 'remote_close'
  | 'suspend'
  | 'unsuspend'
  | 'block'
  | 'unblock'
  | 'reopen'
  | 'force_count'
  | 'approve_discrepancy'
  | 'reject_discrepancy'
  | 'manual_adjustment'
  | 'override_balance'
  | 'config_change'

export type AlertType =
  | 'long_open'
  | 'large_discrepancy'
  | 'excessive_withdrawals'
  | 'excessive_voids'
  | 'suspicious_movement'
  | 'inactive_register'
  | 'high_balance'
  | 'negative_balance'
  | 'unauthorized_access'

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

// ============================================================================
// Session & Register Types
// ============================================================================

export interface CashSession {
  id: string
  register_id: string
  register_name?: string
  status: SessionStatus
  opened_by: string | null
  opened_by_name?: string
  closed_by: string | null
  closed_by_name?: string
  opening_balance: number
  closing_balance: number | null
  expected_balance: number
  discrepancy: number
  branch_id: string
  created_at: string
  date: string | null // null = open
  last_activity_at: string
  suspended_by: string | null
  suspended_at: string | null
  blocked_by: string | null
  blocked_at: string | null
  // Computed fields
  current_balance?: number
  movements_count?: number
  sales_count?: number
  last_movement?: CashMovementAdmin | null
  duration_hours?: number
}

export interface CashMovementAdmin {
  id: string
  session_id: string
  type: 'opening' | 'sale' | 'cash_in' | 'cash_out' | 'closing'
  amount: number
  reason: string | null
  payment_method: 'cash' | 'card' | 'transfer' | 'mixed' | null
  created_by: string | null
  created_by_name?: string
  created_at: string
}

export interface CashRegisterInfo {
  id: string
  name: string
  is_active: boolean
  current_session?: CashSession | null
}

// ============================================================================
// Admin Audit Types
// ============================================================================

export interface AdminAuditEntry {
  id: string
  session_id: string | null
  register_id: string
  action: AdminAction
  performed_by: string
  performed_by_name?: string
  reason: string | null
  metadata: Record<string, unknown>
  previous_state: Record<string, unknown> | null
  new_state: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ============================================================================
// Alert Types
// ============================================================================

export interface CashAlert {
  id: string
  session_id: string | null
  register_id: string
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  description: string | null
  metadata: Record<string, unknown>
  is_read: boolean
  is_resolved: boolean
  resolved_by: string | null
  resolved_by_name?: string
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
}

// ============================================================================
// Config Types
// ============================================================================

export interface CashRegisterConfig {
  id: string
  register_id: string
  max_open_hours: number
  max_discrepancy_amount: number
  max_withdrawals_per_session: number
  max_voids_per_session: number
  inactivity_threshold_minutes: number
  high_balance_threshold: number
  requires_approval_for_close: boolean
  requires_dual_control: boolean
  auto_suspend_on_discrepancy: boolean
  updated_by: string | null
  updated_at: string
}

// ============================================================================
// Dashboard / Metrics Types
// ============================================================================

export interface CashMonitorMetrics {
  totalRegisters: number
  openSessions: number
  closedToday: number
  suspendedSessions: number
  blockedSessions: number
  totalBalance: number
  totalDiscrepancies: number
  unresolvedAlerts: number
  criticalAlerts: number
}

export interface SessionFilter {
  status?: SessionStatus | 'all'
  registerId?: string
  branch?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

// ============================================================================
// Action Payloads
// ============================================================================

export interface RemoteActionPayload {
  sessionId: string
  registerId: string
  reason: string
}

export interface AdjustmentPayload extends RemoteActionPayload {
  amount: number
  adjustmentType: 'add' | 'subtract'
}
