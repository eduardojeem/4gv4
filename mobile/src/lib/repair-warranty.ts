type WarrantyFields = {
  warranty_months?: number | null;
  warranty_type?: string | null;
  warranty_notes?: string | null;
  warranty_expires_at?: string | null;
  delivered_at?: string | null;
  status?: string;
};

/** Presenta lo registrado por el servidor, sin crear plazos nuevos desde el teléfono. */
export function repairWarrantySummary(repair: WarrantyFields, now = new Date()) {
  const months = repair.warranty_months;
  const duration = months == null ? 'No especificada' : months > 0 ? `${months} ${months === 1 ? 'mes' : 'meses'}` : 'Sin garantía';
  const coverage = ({ labor: 'Solo mano de obra', parts: 'Solo repuestos', full: 'Mano de obra y repuestos' } as Record<string, string>)[repair.warranty_type ?? ''] ?? 'No especificada';
  const expiration = repair.warranty_expires_at ? new Date(repair.warranty_expires_at) : null;
  const validExpiration = expiration && Number.isFinite(expiration.getTime()) ? expiration : null;
  const delivered = Boolean(repair.delivered_at) || repair.status === 'entregado';
  const status = months == null ? 'Garantía sin especificar' : months <= 0 ? 'Sin garantía' : !delivered ? 'Pendiente de entrega' : !validExpiration ? 'Vencimiento sin registrar' : validExpiration.getTime() < now.getTime() ? 'Vencida' : 'Vigente';
  return { duration, coverage, status, notes: repair.warranty_notes?.trim() || null, expiresAt: delivered && validExpiration ? validExpiration.toLocaleDateString('es-PY') : null };
}