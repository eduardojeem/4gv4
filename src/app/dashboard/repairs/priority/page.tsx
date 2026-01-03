"use client";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RepairOrder } from "@/types/repairs";
import { calculatePriorityScore, sortRepairsByPriority } from "@/services/repair-priority";
import { createClient } from "@/lib/supabase/client";

export default function RepairsPriorityPage() {
  const [repairs, setRepairs] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(() => {
    try {
      const raw = localStorage.getItem("priorityConfig");
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  });

  const queue = useMemo(() => sortRepairsByPriority(repairs, config), [repairs, config]);

  useEffect(() => {
    const fetchRepairs = async () => {
      setLoading(true);
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('repairs')
        .select(`
          *,
          customers (
            name,
            email,
            phone
          )
        `)
        .in('status', ['recibido', 'diagnostico', 'reparacion', 'pausado'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching repairs:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const mappedRepairs: RepairOrder[] = data.map((item: any) => ({
          id: item.id,
          customerName: item.customers?.name || 'Cliente desconocido',
          customerPhone: item.customers?.phone,
          customerEmail: item.customers?.email,
          deviceModel: item.device_model || 'Dispositivo genérico',
          deviceType: item.device_type,
          issueDescription: item.issue_description,
          urgency: mapPriorityToUrgency(item.priority),
          // Valores calculados o por defecto ya que no están en BD actualmente
          historicalValue: 0, // TODO: Implementar cálculo basado en historial de cliente
          technicalComplexity: 1, // TODO: Implementar lógica de complejidad
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          stage: item.status,
        }));
        setRepairs(mappedRepairs);
      }
      setLoading(false);
    };

    fetchRepairs();

    // Configurar suscripción en tiempo real
    const supabase = createClient();
    const channel = supabase
      .channel('repairs-priority')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, () => {
        fetchRepairs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading && repairs.length === 0) {
    return <div className="p-6">Cargando cola de prioridades...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cola de Trabajo</h1>
          <p className="text-muted-foreground">Priorización inteligente basada en urgencia, tiempo de espera y valor.</p>
        </div>
        <Button asChild>
          <a href="/dashboard/repairs/settings">Configurar</a>
        </Button>
      </div>
      <Card className="p-4">
        {repairs.length === 0 ? (
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
                    {calculatePriorityScore(r, config).toFixed(3)}
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
