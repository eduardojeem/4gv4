"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrioritizationSettings } from "@/components/repairs/admin/PrioritizationSettings";
import { WarrantyPolicySettings } from "@/components/repairs/admin/WarrantyPolicySettings";
import { defaultPriorityConfig } from "@/services/repair-priority";
import { RepairOrder } from "@/types/repairs";
import { ShieldCheck, SlidersHorizontal } from "lucide-react";

export default function RepairsSettingsPage() {
  const [activeTab, setActiveTab] = useState("garantias");

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          ⚙️ Configuración de Reparaciones y Taller
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona las políticas de garantía predeterminadas, términos legales y reglas de priorización del taller.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="garantias" className="gap-2 rounded-lg font-semibold text-xs sm:text-sm">
            <ShieldCheck className="h-4 w-4 text-amber-500" />
            Política de Garantías
          </TabsTrigger>
          <TabsTrigger value="prioridad" className="gap-2 rounded-lg font-semibold text-xs sm:text-sm">
            <SlidersHorizontal className="h-4 w-4 text-blue-500" />
            Priorización
          </TabsTrigger>
        </TabsList>

        <TabsContent value="garantias" className="space-y-4">
          <WarrantyPolicySettings />
        </TabsContent>

        <TabsContent value="prioridad" className="space-y-4">
          <PrioritizationSettings sampleRepairs={sampleRepairs} initialConfig={defaultPriorityConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}