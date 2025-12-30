import { PriorityConfig, PriorityLogEntry, RepairOrder } from "../types/repairs";
import { predictRepairTime } from "../lib/repair-predictive";
import { ProductStock } from "./inventory-repair-sync";

export const defaultPriorityConfig: PriorityConfig = {
  weights: {
    urgencyWeight: 0.4,
    waitTimeWeight: 0.3,
    historicalValueWeight: 0.2,
    technicalComplexityWeight: 0.1,
  },
  rules: [],
};

function normalize(value: number, min: number, max: number) {
  if (max === min) return 0;
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min);
}

export function calculatePriorityScore(repair: RepairOrder, config: PriorityConfig): number {
  const now = Date.now();
  const created = new Date(repair.createdAt).getTime();
  const waitHours = Math.max(0, (now - created) / (1000 * 60 * 60));

  const urgency = normalize(repair.urgency ?? 1, 1, 5);
  const waitTimeNorm = normalize(waitHours, 0, 240); // up to 10 days
  const historicalNorm = normalize(repair.historicalValue ?? 0, 0, 10000);
  const complexityNorm = normalize(repair.technicalComplexity ?? 1, 1, 5);

  let score =
    urgency * config.weights.urgencyWeight +
    waitTimeNorm * config.weights.waitTimeWeight +
    historicalNorm * config.weights.historicalValueWeight +
    complexityNorm * config.weights.technicalComplexityWeight;

  // apply rules
  for (const rule of config.rules) {
    const { condition, effect } = rule;
    const matchesStage = condition.stage ? repair.stage === condition.stage : true;
    const matchesModel = condition.deviceModelIncludes
      ? (repair.deviceModel || "").toLowerCase().includes(condition.deviceModelIncludes.toLowerCase())
      : true;
    const matchesIssue = condition.issueIncludes
      ? (repair.issueDescription || "").toLowerCase().includes(condition.issueIncludes.toLowerCase())
      : true;
    const matchesUrgency = condition.minUrgency ? (repair.urgency ?? 1) >= condition.minUrgency : true;
    const matches = matchesStage && matchesModel && matchesIssue && matchesUrgency;
    if (matches) {
      if (effect.priorityBonus) score += effect.priorityBonus;
      if (effect.priorityMultiplier) score *= effect.priorityMultiplier;
    }
  }

  return score;
}

export function sortRepairsByPriority(repairs: RepairOrder[], config: PriorityConfig): RepairOrder[] {
  return [...repairs].sort((a, b) => calculatePriorityScore(b, config) - calculatePriorityScore(a, config));
}

export class PriorityLogStore {
  private logs: PriorityLogEntry[] = [];

  add(entry: PriorityLogEntry) {
    this.logs.push(entry);
  }

  forRepair(repairId: string) {
    return this.logs.filter((l) => l.repairId === repairId).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  all() {
    return [...this.logs];
  }
}

export function availabilityPenalty(repair: RepairOrder, products: ProductStock[]): number {
  // penaliza si el componente sugerido no tiene stock
  const text = (repair.issueDescription || "").toLowerCase();
  const component = text.includes("pantalla")
    ? "screen"
    : text.includes("batería")
    ? "battery"
    : text.includes("puerto")
    ? "port"
    : undefined;
  if (!component) return 0;
  const candidate = products.find((p) => p.componentType === component);
  if (!candidate) return 0.1; // leve penalización si no hay sugerido
  return candidate.stock <= 0 ? 0.3 : 0; // penalización si está agotado
}

export function calculatePriorityScoreWithInventory(
  repair: RepairOrder,
  config: PriorityConfig,
  products: ProductStock[]
): number {
  const base = calculatePriorityScore(repair, config);
  const pred = predictRepairTime(repair);
  const predNorm = Math.min(pred.predictedHours / 24, 1); // normalizar sobre 24h
  const inventoryPen = availabilityPenalty(repair, products);
  // combinar: mayor tiempo previsto aumenta prioridad levemente, inventario sin stock reduce prioridad
  const combined = base + predNorm * 0.15 - inventoryPen;
  return Number(combined.toFixed(4));
}