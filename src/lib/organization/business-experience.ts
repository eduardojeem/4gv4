/** Shared presentation policy. It never grants a module or a permission. */
export function businessExperience(profile: {
    primaryActivity?: string | null;
    businessVertical?: string | null;
    operatingModel?: string | null;
    effectiveModules?: readonly string[];
    appointmentMode?: string | null;
    attentionMode?: string | null;
}) {
    const modules = profile.effectiveModules ?? [], services = modules.includes('services'), inventory = modules.includes('inventory');
    const serviceFocused = services && (profile.operatingModel === 'service' || profile.businessVertical === 'barbershop' || profile.businessVertical === 'beauty_services');
    const chosen = profile.primaryActivity, preferred = chosen === 'agenda' && services ? 'agenda' as const : chosen === 'repairs' && modules.includes('repairs') ? 'repairs' as const : chosen === 'pos' && modules.includes('pos') ? 'pos' as const : null;
    return { serviceFocused, focus: preferred === 'pos' ? null : preferred ?? (serviceFocused ? 'agenda' as const : modules.includes('repairs') ? 'repairs' as const : services ? 'agenda' as const : null), defaultCatalogView: services && (!inventory || serviceFocused) ? 'services' as const : 'products' as const, catalogLabel: services && !inventory ? 'Servicios' : services && inventory ? 'Productos y servicios' : 'Productos', professionalsLabel: profile.businessVertical === 'barbershop' ? 'barberos' : 'profesionales', walkInOnly: profile.appointmentMode === 'walk_in', attentionLabel: profile.attentionMode === 'home' ? 'Atención a domicilio' : profile.attentionMode === 'both' ? 'Atención en local y a domicilio' : 'Atención en el local' };
}
/** Use the canonical type for authorization, never a user-editable name or SKU. */
export function canUseCatalogRecord(servicesOnly: boolean | undefined, current: {
    unit_measure?: unknown;
}, patch?: {
    unit_measure?: unknown;
    [key: string]: unknown;
}) {
    return !servicesOnly || (current.unit_measure === 'servicio' && (patch?.unit_measure === undefined || patch.unit_measure === 'servicio'));
}
