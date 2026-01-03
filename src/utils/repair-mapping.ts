import { Repair, RepairPriority, RepairUrgency, DeviceType, RepairStatus } from '@/types/repairs'

interface SupabaseCustomer {
    id?: string
    name?: string
    first_name?: string
    last_name?: string
    phone?: string
    email?: string
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

interface SupabaseRepair {
    id: string
    customer?: SupabaseCustomer
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
    technician?: SupabaseTechnician
    location?: string
    warranty?: string
    warranty_months?: number
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
}

/**
 * Mapea los datos de Supabase al formato del frontend
 * Ya no es necesario convertir estados porque usamos español directamente
 */
export const mapSupabaseRepairToUi = (r: SupabaseRepair): Repair => {
    return {
        id: r.id,
        customer: {
            id: r.customer?.id,
            name: r.customer?.name || r.customer?.first_name + ' ' + r.customer?.last_name || 'Cliente Desconocido',
            phone: r.customer?.phone || '',
            email: r.customer?.email || ''
        },
        device: `${r.device_brand} ${r.device_model}`,
        deviceType: (r.device_type as DeviceType) || 'smartphone',
        brand: r.device_brand,
        model: r.device_model,
        issue: r.problem_description,
        description: r.diagnosis || r.solution || '',
        accessType: (r.access_type as 'none' | 'pin' | 'password' | 'pattern' | 'biometric' | 'other') || 'none',
        accessPassword: r.access_password || undefined,
        status: r.status as RepairStatus, // Ahora usamos el estado directamente de la DB
        priority: (r.priority as RepairPriority) || 'medium',
        urgency: (r.urgency as RepairUrgency) || 'normal',
        estimatedCost: r.estimated_cost || 0,
        finalCost: r.final_cost ?? null,
        laborCost: r.labor_cost || 0,
        technician: r.technician ? {
            name: r.technician.full_name || r.technician.email,
            id: r.technician.id
        } : null,
        location: r.location || 'Taller Principal',
        warranty: r.warranty_months ? `${r.warranty_months} meses` : null,
        createdAt: r.created_at,
        estimatedCompletion: r.estimated_completion ?? null,
        completedAt: r.completed_at ?? null,
        lastUpdate: r.updated_at,
        progress: r.progress || 0,
        customerRating: r.customer_rating ?? null,
        notes: [], 
        parts: [], 
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
