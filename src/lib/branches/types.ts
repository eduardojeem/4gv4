export interface BranchRecord {
  id: string
  organization_id?: string | null
  organization?: {
    id: string
    name: string
    slug?: string | null
  } | null
  code: string
  name: string
  slug?: string | null
  address?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  manager_name?: string | null
  is_active?: boolean | null
  is_default?: boolean | null
  created_at?: string
  updated_at?: string
}

export interface BranchSummary extends BranchRecord {
  users_count?: number
  primary_users_count?: number
  registers_count?: number
  open_registers_count?: number
  sales_count?: number
  repairs_count?: number
  revenue_total?: number
}

export interface BranchScopeResolution {
  branchId: string | null
  branch: BranchRecord | null
  source: 'requested' | 'primary' | 'default' | 'unavailable'
}
