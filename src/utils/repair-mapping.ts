import { Repair, RepairPriority, RepairUrgency, RepairDeliveryOutcome, DeviceType, RepairStatus, RepairCloseout } from '@/types/repairs'

interface SupabaseCustomer {
    id?: string
    name?: string
    first_name?: string
    last_name?: string
    phone?: string
    email?: string
    customer_code?: string
    ruc?: string
    customer_type?: string
    alternate_phone?: string
    alternate_phone_label?: string
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
    discount_amount?: number | string | null
    tax_rate?: number | string | null
    line_type?: 'service' | 'included_material' | 'charged_part' | null
}

interface SupabaseCostRevision {
    id: string
    revision_number: number
    parts_subtotal: number | string
    parts_internal_cost: number | string
    subtotal_before_discount: number | string
    final_total: number | string
    balance_snapshot: number | string
    services_subtotal?: number | string
    charged_parts_subtotal?: number | string
    included_materials_internal_cost?: number | string
    tax_breakdown?: Array<{ rate: number; grossAmount: number; taxableBase: number; taxAmount: number }>
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
    /** Reparacion original cuando esta es un retrabajo por garantia. */
    parent_repair_id?: string | null
    reception_id?: string | null
    customer?: SupabaseCustomer | SupabaseCustomer[]
    device_brand: string
    device_model: string
    serial_number?: string | null
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
    additional_charges?: number | string
    deductions?: number | string
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
    currentCostRevision?: SupabaseCostRevision | SupabaseCostRevision[] | null
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
    const costRevision = Array.isArray(r.currentCostRevision)
        ? (r.currentCostRevision[0] ?? null)
        : (r.currentCostRevision ?? null)
    const hasClassifiedRevisionTotals = Boolean(costRevision && (
        Number(costRevision.services_subtotal) > 0 ||
        Number(costRevision.charged_parts_subtotal) > 0 ||
        Number(costRevision.included_materials_internal_cost) > 0
    ))
    return {
        id: r.id,
        ticketNumber: r.ticket_number,
        parentRepairId: r.parent_repair_id ?? null,
        receptionId: r.reception_id ?? null,
        customer: {
            id: cust?.id,
            customerCode: cust?.customer_code,
            name: cust?.name || (cust?.first_name ? `${cust?.first_name} ${cust?.last_name || ''}`.trim() : 'Cliente Desconocido'),
            phone: cust?.phone || '',
            email: cust?.email || '',
            ruc: cust?.ruc || '',
            alternate_phone: cust?.alternate_phone || null,
            alternate_phone_label: cust?.alternate_phone_label || null,
            customer_type: cust?.customer_type || 'regular',
            is_wholesale: cust?.customer_type === 'wholesale' || cust?.customer_type === 'mayorista',
        },
        device: `${r.device_brand} ${r.device_model}`,
        deviceType: (r.device_type as DeviceType) || 'smartphone',
        brand: r.device_brand,
        model: r.device_model,
        serialNumber: r.serial_number || undefined,
        imei: r.serial_number || undefined,
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
        additionalCharges: Number(r.additional_charges) || 0,
        deductions: Number(r.deductions) || 0,
        costSummary: costRevision ? {
            revisionId: costRevision.id,
            revisionNumber: Number(costRevision.revision_number) || 0,
            laborAmount: Number(r.labor_cost) || 0,
            partsSubtotal: Number(costRevision.parts_subtotal) || 0,
            servicesSubtotal: Number(costRevision.services_subtotal) || 0,
            chargedPartsSubtotal: hasClassifiedRevisionTotals
                ? Number(costRevision.charged_parts_subtotal) || 0
                : Number(costRevision.parts_subtotal) || 0,
            includedMaterialsInternalCost: Number(costRevision.included_materials_internal_cost) || 0,
            partsInternalCost: Number(costRevision.parts_internal_cost) || 0,
            additionalCharges: Number(r.additional_charges) || 0,
            deductions: Number(r.deductions) || 0,
            discountAmount: Number(r.discount_amount) || 0,
            subtotalBeforeDiscount: Number(costRevision.subtotal_before_discount) || 0,
            finalTotal: Number(costRevision.final_total) || 0,
            paidAmount: Number(r.paid_amount) || 0,
            balance: Number(costRevision.balance_snapshot) || 0,
            taxBreakdown: (costRevision.tax_breakdown ?? []).map((tax) => ({
                rate: ([0, 5, 10].includes(Number(tax.rate)) ? Number(tax.rate) : 10) as 0 | 5 | 10,
                grossAmount: Number(tax.grossAmount) || 0,
                taxableBase: Number(tax.taxableBase) || 0,
                taxAmount: Number(tax.taxAmount) || 0,
            })),
        } : null,
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
            productId: p.product_id ?? null,
            discountAmount: Number(p.discount_amount) || 0,
            taxRate: ([0, 5, 10].includes(Number(p.tax_rate)) ? Number(p.tax_rate) : 10) as 0 | 5 | 10,
            lineType: p.line_type || 'charged_part',
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
