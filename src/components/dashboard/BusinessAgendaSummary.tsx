'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { agendaSummarySchema } from '@/lib/agenda/summary-model';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { usePermissions } from '@/hooks/use-permissions';
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext';
import { businessExperience } from '@/lib/organization/business-experience';
const schema = agendaSummarySchema;
export function BusinessAgendaSummary() {
    const { organizationId, scope, currentScope } = useTenantScope(), profile = useSubscriptionStatus(), experience = businessExperience(profile), { hasPermission } = usePermissions();
    const allowed = profile.effectiveModules.includes('services') && hasPermission('pos.read');
    const [attempt, setAttempt] = useState(0), [state, setState] = useState<{
        scope: string;
        data: z.infer<typeof schema> | null;
        error: string | null;
        receivedAt: number;
    } | null>(null);
    useEffect(() => {
        if (!allowed || !organizationId)
            return;
        const controller = new AbortController(), captured = scope;
        let active = true;
        fetch('/api/agenda', { headers: { 'x-organization-id': organizationId }, cache: 'no-store', signal: controller.signal }).then(async (response) => { if (!response.ok)
            throw new Error('No se pudo cargar la agenda.'); const result = schema.safeParse(await response.json()); if (!result.success)
            throw new Error('La agenda no está disponible. Revisá su configuración.'); if (active && currentScope.current === captured)
            setState({ scope: captured, data: result.data, error: null, receivedAt: Date.now() }); }).catch(error => { if (active && !controller.signal.aborted && currentScope.current === captured)
            setState({ scope: captured, data: null, error: error instanceof Error ? error.message : 'No se pudo cargar la agenda.', receivedAt: Date.now() }); });
        return () => { active = false; controller.abort(); };
    }, [organizationId, scope, currentScope, allowed, attempt]);
    useEffect(() => { if (!allowed)
        return; const reload = () => setAttempt(n => n + 1), timer = setInterval(() => { if (document.visibilityState === 'visible')
        reload(); }, 60000); window.addEventListener('focus', reload); window.addEventListener('agenda:changed', reload); return () => { clearInterval(timer); window.removeEventListener('focus', reload); window.removeEventListener('agenda:changed', reload); }; }, [allowed]);
    if (!allowed)
        return null;
    const value = state?.scope === scope ? state : null, data = value?.data;
    const next = data?.appointments.filter(item => item.status === 'confirmed' && Date.parse(item.starts_at) >= (value?.receivedAt ?? 0)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    const full = (data?.appointments.length ?? 0) >= 2000;
    return <section aria-label="Resumen de servicios" className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{experience.walkInOnly ? 'Atenciones de hoy' : 'Tu agenda de hoy'}</h2><p className="text-xs text-muted-foreground">Agenda de la empresa · {experience.attentionLabel} · {experience.professionalsLabel}</p></div><Link href="/dashboard/agenda" className="text-sm font-semibold text-primary">Abrir agenda →</Link></div>{value?.error ? <div role="alert" className="mt-3 text-sm">{value.error} <button onClick={() => setAttempt(n => n + 1)} className="underline">Reintentar</button></div> : !data ? <p className="mt-4 text-sm text-muted-foreground">Cargando agenda…</p> : <><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
                [experience.walkInOnly ? 'Atenciones registradas' : 'Turnos del día', String(data.appointments.filter(item => item.status !== 'cancelled').length) + (full ? ' o más' : '')],
                ['Atendidos', data.appointments.filter(item => item.status === 'completed').length],
                ['No asistieron', data.appointments.filter(item => item.status === 'no_show').length],
                ['Reservas futuras por confirmar', data.pendingCount],
            ].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>{full ? <p className="mt-2 text-xs text-muted-foreground">La agenda alcanzó el límite de consulta: los conteos del día son parciales.</p> : null}<p className="mt-3 text-sm">{next ? `Próximo turno: ${new Intl.DateTimeFormat('es-PY', { hour: '2-digit', minute: '2-digit', timeZone: data.timeZone }).format(new Date(next.starts_at))} · ${next.customer_name} · ${next.service_name}` : 'No hay próximos turnos confirmados para hoy.'}</p></>}</section>;
}
