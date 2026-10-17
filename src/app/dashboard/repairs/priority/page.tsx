"use client";
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { useBranch } from '@/contexts/branch-context'
import { defaultPriorityConfig } from '@/services/repair-priority'
import { logger } from '@/lib/logger'
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RepairOrder, type RepairStatus } from "@/types/repairs";
import { calculatePriorityScore, sortRepairsByPriority } from "@/services/repair-priority";
import { branchHeaders } from "@/lib/branches/client";
import { ACTIVE_REPAIR_STATUSES } from "@/lib/constants/repair-status";

/** Fila cruda de `repairs` tal como la devuelve /api/repairs. */
type RepairRow = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  priority?: string | null;
  device_model?: string | null;
  device_type?: string | null;
  issue_description?: string | null;
  customers?: { name?: string | null; email?: string | null; phone?: string | null } | null;
};

export default function RepairsPriorityPage() {
  const { scope, currentScope } = useTenantScope();
  const { selectedBranchId } = useBranch();
  const [error, setError] = useState<string | null>(null);
  const [repairs, setRepairs] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);
  // La configuración se edita en /dashboard/repairs/settings y se lee de
  // localStorage al montar; acá solo se consume.
  const [config] = useState(() => {
    try {
      const raw = localStorage.getItem("priorityConfig");
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  });

  // Historical value and complexity have no measured source; exclude their weights.
  const measuredConfig = useMemo(() => ({
    ...(config || defaultPriorityConfig),
    weights: {
      ...(config?.weights || defaultPriorityConfig.weights),
      historicalValueWeight: 0,
      technicalComplexityWeight: 0,
    },
  }), [config]);
  const queue = useMemo(() => sortRepairsByPriority(repairs, measuredConfig), [repairs, measuredConfig]);

  useEffect(() => {
    const controller = new AbortController();
    const requestScope = scope;
    setRepairs([]);
    setError(null);
    const fetchRepairs = async () => {
      setLoading(true);

      // Vía API en vez de consultar `repairs` directo desde el cliente: el
      // endpoint acota por organización y sucursal. La consulta directa
      // dependía solo de RLS y podía traer reparaciones de otras empresas.
      let data: RepairRow[] | null = null;
      try {
        const all: RepairRow[] = [];
        // Filter active work in the API before pagination, then load every page.
        for (let page = 1; ; page++) {
          const response = await fetch(`/api/repairs?chargeable=true&page=${page}&pageSize=100`, {
            cache: 'no-store', headers: branchHeaders(selectedBranchId), signal: controller.signal,
          });
          const payload = await response.json() as { repairs?: RepairRow[]; pagination?: { total?: number }; error?: string };
          if (controller.signal.aborted || currentScope.current !== requestScope) return;
          if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las reparaciones');
          const batch = payload.repairs ?? [];
          all.push(...batch);
          const total = payload.pagination?.total;
          if (typeof total !== 'number') throw new Error('Falta la cobertura de la cola. Reintentá.');
          if (all.length >= total) break;
          if (!batch.length) throw new Error('La cola cambió durante la carga. Reintentá.');
        }
        data = all.filter((item) => ACTIVE_REPAIR_STATUSES.has(String(item.status ?? '') as RepairStatus))
          .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
      } catch (error) {
        if (controller.signal.aborted || currentScope.current !== requestScope) return;
        setError(error instanceof Error ? error.message : 'No se pudo cargar la cola');
        logger.error('Error fetching repairs', { error })
        setLoading(false);
        return;
      }

      if (data) {
        const mappedRepairs: RepairOrder[] = data.map((item) => ({
          id: item.id,
          customerName: item.customers?.name || 'Cliente desconocido',
          customerPhone: item.customers?.phone,
          customerEmail: item.customers?.email,
          deviceModel: item.device_model || 'Dispositivo genérico',
          deviceType: item.device_type,
          issueDescription: item.issue_description,
          urgency: mapPriorityToUrgency(item.priority),
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          stage: item.status,
        }));
        setRepairs(mappedRepairs);
      }
      setLoading(false);
    };

    // Sin Realtime: repairs no está en la publicación supabase_realtime.
    void fetchRepairs();
    return () => controller.abort();
  }, [scope, currentScope, selectedBranchId]);

  if (loading && repairs.length === 0) {
    return <div className="p-6">Cargando cola de prioridades...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cola de Trabajo</h1>
          <p className="text-muted-foreground">Prioridad por urgencia y tiempo de espera. Valor histórico y complejidad sin datos: excluidos del cálculo.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/repairs/settings">Configurar</Link>
        </Button>
      </div>
      {error && <p role="alert" className="text-destructive">{error} Recargá para reintentar.</p>}
      <Card className="p-4">
        {error ? null : repairs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay reparaciones pendientes en la cola.
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((r) => (
              <div key={r.id} className="flex items-center justify-between border rounded p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {r.deviceModel} 
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {r.stage}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {r.issueDescription} • {r.customerName}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Espera: {calculateHoursWaited(r.createdAt)}h
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-primary">
                    {calculatePriorityScore(r, measuredConfig).toFixed(3)}
                  </div>
                  <div className="text-xs text-muted-foreground">score</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function mapPriorityToUrgency(priority: string | null): number {
  switch (priority?.toLowerCase()) {
    case 'high': return 5;
    case 'medium': return 3;
    case 'low': return 1;
    default: return 1;
  }
}

function calculateHoursWaited(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  return (diff / (1000 * 60 * 60)).toFixed(1);
}
