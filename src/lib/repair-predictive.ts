import { PredictiveMetrics, RepairOrder } from "@/types/repairs";

export interface TimePrediction {
  predictedHours: number;
  confidence: number; // 0..1
  rationale: string[];
}

export interface EarlyAlert {
  id: string;
  level: "info" | "warning" | "critical";
  message: string;
  createdAt: string;
}

export function estimateDurations(repairs: RepairOrder[]): PredictiveMetrics[] {
  const byModel: Record<string, number[]> = {};
  for (const r of repairs) {
    const dur = r.estimatedDurationHours ?? inferDuration(r);
    if (!byModel[r.deviceModel]) byModel[r.deviceModel] = [];
    byModel[r.deviceModel].push(dur);
  }
  const metrics: PredictiveMetrics[] = [];
  for (const model of Object.keys(byModel)) {
    const arr = byModel[model];
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    const std = Math.sqrt(variance);
    const ci: [number, number] = [Math.max(0, mean - 1.96 * std), mean + 1.96 * std];
    metrics.push({ deviceModel: model, meanDurationHours: mean, stdDevHours: std, confidenceIntervalHours: ci, topSymptoms: [] });
  }
  return metrics;
}

export function correlateSymptoms(repairs: RepairOrder[]): { symptom: string; correlation: number }[] {
  const symptoms = ["pantalla", "batería", "puerto", "audio", "wifi"];
  const scores: { symptom: string; correlation: number }[] = [];
  for (const s of symptoms) {
    const total = repairs.length;
    const matches = repairs.filter((r) => (r.issueDescription || "").toLowerCase().includes(s)).length;
    const corr = total ? matches / total : 0;
    scores.push({ symptom: s, correlation: Number(corr.toFixed(2)) });
  }
  return scores.sort((a, b) => b.correlation - a.correlation).slice(0, 5);
}

export function recommendDiagnosis(repairs: RepairOrder[], issueText: string) {
  const text = (issueText || "").toLowerCase();
  const metrics = correlateSymptoms(repairs);
  const likely = metrics.filter((m) => text.includes(m.symptom));
  return likely.length ? likely.map((l) => ({ diagnosis: l.symptom, confidence: l.correlation })) : metrics.map((m) => ({ diagnosis: m.symptom, confidence: m.correlation / 2 }));
}

function inferDuration(r: RepairOrder) {
  const base = 4; // hours
  let plus = 0;
  const t = (r.issueDescription || "").toLowerCase();
  if (t.includes("pantalla")) plus += 2;
  if (t.includes("batería")) plus += 1.5;
  if (t.includes("puerto")) plus += 2.5;
  plus += (r.technicalComplexity ?? 1) * 0.5;
  return base + plus;
}

export function predictRepairTime(repair: RepairOrder): TimePrediction {
  const hours = inferDuration(repair);
  const rationale: string[] = [];
  const t = (repair.issueDescription || "").toLowerCase();
  if (t.includes("pantalla")) rationale.push("Casos de pantalla añaden ~2h");
  if (t.includes("batería")) rationale.push("Casos de batería añaden ~1.5h");
  if (t.includes("puerto")) rationale.push("Casos de puerto añaden ~2.5h");
  if (repair.technicalComplexity) rationale.push(`Complejidad técnica ${repair.technicalComplexity} contribuye tiempo`);
  const confidence = 0.6; // placeholder; mejorar con datos históricos
  return { predictedHours: Number(hours.toFixed(1)), confidence, rationale };
}

export function generateEarlyAlerts(repair: RepairOrder): EarlyAlert[] {
  const alerts: EarlyAlert[] = [];
  const t = (repair.issueDescription || "").toLowerCase();
  if ((repair.urgency ?? 1) >= 4) {
    alerts.push({ id: `al-${Date.now()}-u`, level: "critical", message: "Urgencia alta: priorizar diagnóstico", createdAt: new Date().toISOString() });
  }
  if (t.includes("líquido") || t.includes("mojado") || t.includes("agua")) {
    alerts.push({ id: `al-${Date.now()}-l`, level: "warning", message: "Posible daño por líquido: mayor complejidad", createdAt: new Date().toISOString() });
  }
  if (t.includes("intermitente") || t.includes("aleatorio")) {
    alerts.push({ id: `al-${Date.now()}-i`, level: "info", message: "Fallo intermitente: planificar pruebas extendidas", createdAt: new Date().toISOString() });
  }
  return alerts;
}

export function trainPredictiveModel(_repairs: RepairOrder[]): { status: "ok"; samples: number } {
  // Placeholder para entrenamiento ML; en producción usaría un modelo real
  return { status: "ok", samples: _repairs.length };
}