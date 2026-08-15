import { Repair, RepairPriority, RepairUrgency, RepairDeliveryOutcome, DeviceType, RepairStatus, RepairCloseout } from '@/types/repairs'

interface SupabaseCustomer {
    id?: string
    name?: string
    first_name?: string
    last_name?: string
    phone?: string
    email?: string
    customer_code?: string
}

interface SupabaseTechnician {
    id: string
    full_name?: string
    email: string
}

interface SupabaseRepairImage {
    id?: string
    image_id?: string
    image_url?: string
    url?: string
    description?: string
}

interface SupabaseRepairPart {
    id: string | number
    part_name: string
    unit_cost: number
    unit_price?: number | null
    quantity: number
    supplier?: string
    part_number?: string
    product_id?: string | null
}

interface SupabaseRepairNote {
    id: string | number
    note_text: string
    created_at: string
    author_name: string
    is_internal?: boolean
}

interface SupabaseRepairPayment {
    id: string
    amount: number | string
    payment_method: 'cash' | 'card' | 'transfer' | 'credit' | 'mixed'
    reference?: string | null
    notes?: string | null
    source: 'repairs' | 'delivery' | 'pos' | 'migration'
    created_by?: string | null
    created_at: string
}

interface SupabaseRepairCloseout {
    id: string
    outcome: 'withdrawn' | 'unrepairable'
    charge_mode: RepairCloseout['chargeMode']
    labor_charge: number | string
    consumed_parts_charge: number | string
    final_charge: number | string
    paid_before: number | string
    settlement_kind: RepairCloseout['settlementKind']
    settlement_amount: number | string
    settlement_method?: 'cash' | 'card' | 'transfer' | null
    settlement_reference?: string | null
    reason?: string | null
    note?: string | null
    created_by?: string | null
    created_at: string
    parts_resolution?: Array<{ repairPartId: string; productId?: string | null; name: string; quantity: number; unitPrice: number; disposition: 'consumed' | 'restocked' }>
}

interface SupabaseRepair {
    id: string
    ticket_number?: string
    customer?: SupabaseCustomer | SupabaseCustomer[]
    device_brand: string
    device_model: string
    device_type?: string
    problem_description: string
    diagnosis?: string
    solution?: string
    access_type?: string
    access_password?: string
    status: string
    priority?: string
    urgency?: string
    estimated_cost?: number
    final_cost?: number
    labor_cost?: number
    pricing_mode?: string
    discount_amount?: number
    price_override_reason?: string
    pricing_updated_at?: string
    payment_status?: string
    paid_amount?: number
    technician?: SupabaseTechnician | SupabaseTechnician[]
    location?: string
    warranty?: string
    warranty_months?: number
    warranty_type?: string
    warranty_notes?: string
    warranty_expires_at?: string
    picked_up_at?: string
    delivery_outcome?: string
    created_at: string
    estimated_completion?: string
    completed_at?: string
    updated_at: string
    progress?: number
    customer_rating?: number
    images?: SupabaseRepairImage[]
    repair_images?: SupabaseRepairImage[]
    notify_customer?: boolean
    notify_technician?: boolean
    notify_manager?: boolean
    parts?: SupabaseRepairPart[]
    notes?: SupabaseRepairNote[]
    payments?: SupabaseRepairPayment[]
    closeout?: SupabaseRepairCloseout | SupabaseRepairCloseout[] | null
}

/**
 * Mapea los datos de Supabase al formato del frontend
 * Ya no es necesario convertir estados porque usamos español directamente
 */
export const mapSupabaseRepairToUi = (r: SupabaseRepair): Repair => {
    // Normalize customer: Supabase returns arrays from joins, pick first element
    const cust: SupabaseCustomer | undefined = Array.isArray(r.customer)
        ? (r.customer[0] ?? undefined)
        : r.customer
    // Normalize technician
    const tech: SupabaseTechnician | undefined = Array.isArray(r.technician)
        ? (r.technician[0] ?? undefined)
        : r.technician
    const closeout = Array.isArray(r.closeout) ? (r.closeout[0] ?? null) : (r.closeout ?? null)
    return {
        id: r.id,
        ticketNumber: r.ticket_number,
        customer: {
            id: cust?.id,
            customerCode: cust?.customer_code,
            name: cust?.name || (cust?.first_name ? `${cust?.first_name} ${cust?.last_name || ''}`.trim() : 'Cliente Desconocido'),
            phone: cust?.phone || '',
            email: cust?.email || ''
        },
        device: `${r.device_brand} ${r.device_model}`,
        deviceType: (r.device_type as DeviceType) || 'smartphone',
        brand: r.device_brand,
        model: r.device_model,
        issue: r.problem_description,
        description: r.diagnosis || r.solution || '',
        accessType: (r.access_type?.toLowerCase() as 'none' | 'pin' | 'password' | 'pattern' | 'biometric' | 'other') || 'none',
        accessPassword: r.access_password || undefined,
        status: r.status as RepairStatus, // Ahora usamos el estado directamente de la DB
        priority: (r.priority as RepairPriority) || 'medium',
        urgency: (r.urgency as RepairUrgency) || 'normal',
        estimatedCost: r.estimated_cost || 0,
        finalCost: r.final_cost ?? null,
        laborCost: r.labor_cost || 0,
        pricingMode: (r.pricing_mode as Repair['pricingMode']) || 'automatic',
        discountAmount: Number(r.discount_amount) || 0,
        priceOverrideReason: r.price_override_reason || undefined,
        pricingUpdatedAt: r.pricing_updated_at || null,
        paymentStatus: (r.payment_status as Repair['paymentStatus']) || 'pendiente',
        paidAmount: Number(r.paid_amount) || 0,
        payments: [...(r.payments || [])]
            .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
            .map((payment) => ({
                id: payment.id,
                amount: Number(payment.amount) || 0,
                method: payment.payment_method,
                reference: payment.reference ?? null,
                notes: payment.notes ?? null,
                source: payment.source,
                createdAt: payment.created_at,
                createdBy: payment.created_by ?? null,
            })),
        closeout: closeout ? {
            id: closeout.id,
            outcome: closeout.outcome,
            chargeMode: closeout.charge_mode,
            laborCharge: Number(closeout.labor_charge) || 0,
            consumedPartsCharge: Number(closeout.consumed_parts_charge) || 0,
            finalCharge: Number(closeout.final_charge) || 0,
            paidBefore: Number(closeout.paid_before) || 0,
            settlementKind: closeout.settlement_kind,
            settlementAmount: Number(closeout.settlement_amount) || 0,
            settlementMethod: closeout.settlement_method ?? null,
            settlementReference: closeout.settlement_reference ?? null,
            reason: closeout.reason ?? null,
            note: closeout.note ?? null,
            createdBy: closeout.created_by ?? null,
            createdAt: closeout.created_at,
            parts: (closeout.parts_resolution ?? []).map((part) => ({
                ...part,
                quantity: Number(part.quantity) || 0,
                unitPrice: Number(part.unitPrice) || 0,
            })),
        } : null,
        technician: tech ? {
            name: tech.full_name || tech.email,
            id: tech.id
        } : null,
        location: r.location || 'Taller Principal',
        warranty: r.warranty_months ? `${r.warranty_months} meses` : null,
        warrantyMonths: r.warranty_months || 0,
        warrantyType: (r.warranty_type as 'labor' | 'parts' | 'full') || 'full',
        warrantyNotes: r.warranty_notes || undefined,
        warrantyExpiresAt: r.warranty_expires_at || null,
        pickedUpAt: r.picked_up_at || null,
        deliveryOutcome: (r.delivery_outcome as RepairDeliveryOutcome) || null,
        createdAt: r.created_at,
        estimatedCompletion: r.estimated_completion ?? null,
        completedAt: r.completed_at ?? null,
        lastUpdate: r.updated_at,
        progress: r.progress || 0,
        customerRating: r.customer_rating ?? null,
        notes: (r.notes || []).map((n: SupabaseRepairNote) => ({
            id: Number(n.id) || 0, // Fallback if UUID
            text: n.note_text,
            timestamp: n.created_at,
            author: n.author_name,
            isInternal: Boolean(n.is_internal)
        })),
        parts: (r.parts || []).map((p: SupabaseRepairPart) => ({
            id: Number(p.id) || 0,
            databaseId: String(p.id),
            name: p.part_name,
            cost: p.unit_price ?? p.unit_cost,
            internalCost: p.unit_cost,
            quantity: p.quantity,
            supplier: p.supplier || '',
            partNumber: p.part_number || '',
            productId: p.product_id ?? null
        })),
        images: Array.isArray(r.images)
            ? r.images.map((img: SupabaseRepairImage) => ({
                id: String(img.id ?? img.image_id ?? img.image_url),
                url: String(img.url ?? img.image_url),
                description: img.description
            }))
            : Array.isArray(r.repair_images)
            ? r.repair_images.map((img: SupabaseRepairImage) => ({
                id: String(img.id ?? img.image_id ?? img.image_url),
                url: String(img.url ?? img.image_url),
                description: img.description
            }))
            : [],
        notifications: {
            customer: r.notify_customer || false,
            technician: r.notify_technician || false,
            manager: r.notify_manager || false
        }
    }
}
