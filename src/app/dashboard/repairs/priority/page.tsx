"use client";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RepairOrder } from "@/types/repairs";
import { calculatePriorityScore, sortRepairsByPriority } from "@/services/repair-priority";

export default function RepairsPriorityPage() {
  const [repairs, setRepairs] = useState<RepairOrder[]>(mockRepairs());
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
    const interval = setInterval(() => {
      // simulate real-time updates
      setRepairs((prev) => prev.map((r) => ({ ...r, updatedAt: new Date().toISOString(), urgency: Math.max(1, Math.min(5, (r.urgency ?? 3) + (Math.random() > 0.7 ? 1 : 0))) })));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cola de Trabajo</h1>
          <p className="text-muted-foreground">Actualizada en tiempo real según configuración actual.</p>
        </div>
        <Button asChild>
          <a href="/dashboard/repairs/settings">Configurar</a>
        </Button>
      </div>
      <Card className="p-4">
        <div className="space-y-2">
          {queue.map((r) => (
            <div key={r.id} className="flex items-center justify-between border rounded p-2">
              <div>
                <div className="font-medium">{r.deviceModel} • {r.issueDescription}</div>
                <div className="text-sm text-muted-foreground">{r.customerName} • etapa {r.stage}</div>
              </div>
              <div className="text-sm font-mono">score {calculatePriorityScore(r, config).toFixed(3)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function mockRepairs(): RepairOrder[] {
  return [
    {
      id: "R-2001",
      customerName: "Juan",
      deviceModel: "iPhone X",
      issueDescription: "Batería defectuosa",
      urgency: 2,
      historicalValue: 500,
      technicalComplexity: 2,
      createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      stage: "diagnosis",
    },
    {
      id: "R-2002",
      customerName: "Luisa",
      deviceModel: "iPad Air",
      issueDescription: "Pantalla con manchas",
      urgency: 4,
      historicalValue: 800,
      technicalComplexity: 3,
      createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      stage: "awaiting_parts",
    },
    {
      id: "R-2003",
      customerName: "Diego",
      deviceModel: "Dell XPS",
      issueDescription: "Puerto de carga flojo",
      urgency: 3,
      historicalValue: 1000,
      technicalComplexity: 4,
      createdAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
      stage: "in_repair",
    },
  ];
}