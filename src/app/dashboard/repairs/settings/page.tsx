'use client'

import { useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PrioritizationSettings } from "@/components/repairs/admin/PrioritizationSettings";
import { WarrantyPolicySettings } from "@/components/repairs/admin/WarrantyPolicySettings";
import { RepairCostPolicySettings } from "@/components/repairs/admin/RepairCostPolicySettings";
import { defaultPriorityConfig } from "@/services/repair-priority";
import { RepairOrder } from "@/types/repairs";
import { ShieldCheck, SlidersHorizontal, Shield, ArrowLeft, Loader2, ReceiptText } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const sampleRepairs: RepairOrder[] = [
  { id: "R-1001", customerName: "Ana López", deviceModel: "iPhone 12", issueDescription: "Pantalla rota", urgency: 5, historicalValue: 1200, technicalComplexity: 3, createdAt: "2026-08-18T12:00:00.000Z", stage: "diagnosis" },
  { id: "R-1002", customerName: "Carlos Pérez", deviceModel: "Galaxy S21", issueDescription: "Batería no carga", urgency: 3, historicalValue: 300, technicalComplexity: 2, createdAt: "2026-08-20T06:00:00.000Z", stage: "awaiting_parts" },
  { id: "R-1003", customerName: "María Gómez", deviceModel: "Lenovo ThinkPad", issueDescription: "Puerto de carga dañado", urgency: 4, historicalValue: 800, technicalComplexity: 4, createdAt: "2026-08-16T12:00:00.000Z", stage: "in_repair" },
];

export default function RepairsSettingsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const canAccess = Boolean(isAdmin || user?.role === 'admin' || user?.role === 'super_admin');
  const [activeTab, setActiveTab] = useState("garantias");

  if (authLoading) {
    return (
      <div className="mx-auto flex max-w-[1480px] flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-500">Verificando permisos de acceso...</p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-6">
        <div className="max-w-md w-full text-center space-y-4 bg-card p-8 rounded-2xl border border-border shadow-lg">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Shield className="h-8 w-8 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">Acceso Restringido</h1>
            <p className="text-xs text-muted-foreground">
              La configuración avanzada de políticas y prioridades del taller está reservada para administradores.
            </p>
          </div>
          <Button asChild className="gap-2 text-xs font-semibold rounded-xl mt-2" size="sm">
            <Link href="/dashboard/repairs">
              <ArrowLeft className="h-4 w-4" />
              Volver a Reparaciones
            </Link>
          </Button>
        </div>
      </div>
    );
  }

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
        <TabsList className="grid w-full grid-cols-3 max-w-xl bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="garantias" className="gap-2 rounded-lg font-semibold text-xs sm:text-sm">
            <ShieldCheck className="h-4 w-4 text-amber-500" />
            Política de Garantías
          </TabsTrigger>
          <TabsTrigger value="prioridad" className="gap-2 rounded-lg font-semibold text-xs sm:text-sm">
            <SlidersHorizontal className="h-4 w-4 text-blue-500" />
            Priorización
          </TabsTrigger>
          <TabsTrigger value="costos" className="gap-2 rounded-lg font-semibold text-xs sm:text-sm">
            <ReceiptText className="h-4 w-4 text-emerald-500" />
            Costos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="garantias" className="space-y-4">
          <WarrantyPolicySettings />
        </TabsContent>

        <TabsContent value="prioridad" className="space-y-4">
          <PrioritizationSettings sampleRepairs={sampleRepairs} initialConfig={defaultPriorityConfig} />
        </TabsContent>

        <TabsContent value="costos" className="space-y-4">
          <RepairCostPolicySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
