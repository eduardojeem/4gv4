"use client";
import { PrioritizationSettings } from "@/components/repairs/admin/PrioritizationSettings";
import { defaultPriorityConfig } from "@/services/repair-priority";
import { RepairOrder } from "@/types/repairs";

export default function RepairsSettingsPage() {
  const sampleRepairs: RepairOrder[] = [
    {
      id: "R-1001",
      customerName: "Ana López",
      deviceModel: "iPhone 12",
      issueDescription: "Pantalla rota",
      urgency: 5,
      historicalValue: 1200,
      technicalComplexity: 3,
      createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      stage: "diagnosis",
    },
    {
      id: "R-1002",
      customerName: "Carlos Pérez",
      deviceModel: "Galaxy S21",
      issueDescription: "Batería no carga",
      urgency: 3,
      historicalValue: 300,
      technicalComplexity: 2,
      createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      stage: "awaiting_parts",
    },
    {
      id: "R-1003",
      customerName: "María Gómez",
      deviceModel: "Lenovo ThinkPad",
      issueDescription: "Puerto de carga dañado",
      urgency: 4,
      historicalValue: 800,
      technicalComplexity: 4,
      createdAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
      stage: "in_repair",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración de Prioridad</h1>
        <p className="text-muted-foreground">Ajusta pesos y reglas para el sistema de priorización.</p>
      </div>
      <PrioritizationSettings sampleRepairs={sampleRepairs} initialConfig={defaultPriorityConfig} />
    </div>
  );
}