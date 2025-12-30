"use client";
import { useState, useMemo } from "react";
import { CommunicationCenter } from "@/components/repairs/CommunicationCenter";
import { useRepairs } from "@/hooks/use-repairs";
import { useRepairCommunications } from "@/hooks/use-repair-communications";
import { CommunicationTemplate, CommunicationChannel } from "@/types/repairs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function RepairsCommunicationsPage() {
  const router = useRouter();
  const { repairs, isLoading: repairsLoading } = useRepairs();
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);

  // Get selected repair object
  const selectedRepair = useMemo(() => 
    repairs.find(r => r.id === selectedRepairId) || null, 
  [repairs, selectedRepairId]);

  const { messages, sendMessage } = useRepairCommunications(selectedRepairId || undefined);

  // Mock templates (could be fetched from DB too later)
  const templates: CommunicationTemplate[] = [
    { id: "t1", name: "Diagnóstico", channel: "whatsapp", content: "Hola {{customerName}}, tu reparación {{repairId}} está en diagnóstico para {{deviceModel}}." },
    { id: "t2", name: "Piezas", channel: "sms", content: "{{customerName}}, estamos esperando repuestos para {{deviceModel}} ({{repairId}})." },
    { id: "t3", name: "Entrega", channel: "email", content: "Estimado/a {{customerName}}, tu {{deviceModel}} está listo. Número de reparación: {{repairId}}." },
  ];

  const handleSendMessage = async (channel: CommunicationChannel, content: string, templateId?: string) => {
    if (!selectedRepair) return false;
    return sendMessage(
        channel, 
        content, 
        selectedRepair.customer.phone, 
        selectedRepair.customer.email, 
        templateId
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/repairs')}
          className="gap-2 -ml-2 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Reparaciones
        </Button>
        <h1 className="text-2xl font-bold">Centro de Comunicación</h1>
        <p className="text-muted-foreground">Envía mensajes por WhatsApp, SMS y email con historial unificado.</p>
      </div>

      {/* Selector de Reparación */}
      <Card>
        <CardHeader className="pb-3">
            <CardTitle className="text-base">Seleccionar Reparación</CardTitle>
            <CardDescription>Elige el cliente/dispositivo para gestionar sus comunicaciones</CardDescription>
        </CardHeader>
        <CardContent>
            <Select 
                value={selectedRepairId || ""} 
                onValueChange={setSelectedRepairId}
                disabled={repairsLoading}
            >
                <SelectTrigger className="w-full md:w-[400px]">
                    <SelectValue placeholder={repairsLoading ? "Cargando reparaciones..." : "Buscar reparación..."} />
                </SelectTrigger>
                <SelectContent>
                    {repairs.map((repair) => (
                        <SelectItem key={repair.id} value={repair.id}>
                            {repair.customer.name} - {repair.device} ({repair.status})
                        </SelectItem>
                    ))}
                    {repairs.length === 0 && !repairsLoading && (
                        <SelectItem value="none" disabled>No hay reparaciones activas</SelectItem>
                    )}
                </SelectContent>
            </Select>
        </CardContent>
      </Card>

      <CommunicationCenter 
        repair={selectedRepair} 
        templates={templates} 
        messages={messages}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}
