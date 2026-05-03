import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { verifyPublicToken } from '@/lib/public-session'
import { verifyRepairHash } from '@/lib/repair-qr'
import { createClient } from '@/lib/supabase/server'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import type { PublicRepair } from '@/types/public'
import RepairDetailClient from './RepairDetailClient'

async function fetchRepairServerSide(
  ticketId: string,
  verifyHash: string | null
): Promise<PublicRepair | null> {
  try {
    // 1. Check token from cookie
    const cookieStore = await cookies()
    const token = cookieStore.get('repair_token')?.value
    let isTokenAuthorized = false

    if (token) {
      const session = await verifyPublicToken(token)
      if (session && session.ticketNumber === ticketId) {
        isTokenAuthorized = true
      }
    }

    // 2. If no token and no hash, can't authorize
    if (!isTokenAuthorized && !verifyHash) {
      return null
    }

    const supabase = await createClient()

    const { data: repair, error } = await supabase
      .from('repairs')
      .select(`
        id, ticket_number, device_brand, device_model, device_type,
        problem_description, status, priority, created_at,
        estimated_cost, final_cost, warranty_months, warranty_type,
        estimated_completion, completed_at, technician_id, customer_id
      `)
      .eq('ticket_number', ticketId)
      .single()

    if (error || !repair) return null

    // 3. If using hash, verify it
    if (!isTokenAuthorized && verifyHash) {
      const [customerResult] = await Promise.all([
        supabase.from('customers').select('name').eq('id', repair.customer_id).single(),
      ])
      const customerName = customerResult.data?.name || ''
      const repairDate = new Date(repair.created_at)

      const isValid =
        (repair.customer_id ? verifyRepairHash(ticketId, repair.customer_id, repairDate, verifyHash) : false) ||
        (customerName ? verifyRepairHash(ticketId, customerName, repairDate, verifyHash) : false)

      if (!isValid) return null
    }

    // 4. Fetch related data
    const [technicianResult, customerResult, statusHistoryResult] = await Promise.all([
      repair.technician_id
        ? supabase.from('profiles').select('full_name').eq('id', repair.technician_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('customers').select('name, phone').eq('id', repair.customer_id).single(),
      supabase
        .from('repair_status_history')
        .select('status, note, created_at')
        .eq('repair_id', repair.id)
        .order('created_at', { ascending: true }),
    ])

    return {
      ticketNumber: repair.ticket_number,
      device: `${repair.device_brand} ${repair.device_model}`,
      brand: repair.device_brand,
      model: repair.device_model,
      deviceType: repair.device_type,
      issue: repair.problem_description,
      status: repair.status,
      priority: repair.priority,
      createdAt: repair.created_at,
      estimatedCompletion: repair.estimated_completion || null,
      completedAt: repair.completed_at || null,
      estimatedCost: repair.estimated_cost || 0,
      finalCost: repair.final_cost,
      warrantyMonths: repair.warranty_months,
      warrantyType: repair.warranty_type,
      statusHistory: statusHistoryResult.data || [],
      technician: technicianResult.data?.full_name ? { name: technicianResult.data.full_name } : null,
      customer: {
        name: customerResult.data?.name || 'Cliente',
        phone: customerResult.data?.phone || '',
      },
    }
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ ticketId: string }> }
): Promise<Metadata> {
  const { ticketId } = await params
  const settings = await fetchWebsiteSettings()
  const companyName = settings?.company_info?.name || '4G Celulares'

  return {
    title: `Reparación ${ticketId} | ${companyName}`,
    description: `Estado de la reparación ${ticketId}`,
    robots: { index: false, follow: false },
  }
}

export default async function RepairDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>
  searchParams: Promise<{ verify?: string }>
}) {
  const { ticketId } = await params
  const { verify: verifyHash } = await searchParams

  const initialRepair = await fetchRepairServerSide(ticketId, verifyHash ?? null)

  return (
    <RepairDetailClient
      ticketId={ticketId}
      initialRepair={initialRepair}
      verifyHash={verifyHash ?? null}
    />
  )
}
