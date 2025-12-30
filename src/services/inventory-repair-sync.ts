import { InventoryAlert, InventoryReservation, RepairOrder } from "@/types/repairs";

export interface ProductStock {
  id: string;
  name: string;
  sku?: string;
  stock: number;
  componentType?: string; // e.g., screen, battery
  supplierName?: string;
  price?: number;
}

export function suggestReservations(
  repairs: RepairOrder[],
  products: ProductStock[]
): { reservations: InventoryReservation[]; alerts: InventoryAlert[] } {
  const reservations: InventoryReservation[] = [];
  const alerts: InventoryAlert[] = [];

  for (const r of repairs) {
    // naive matching: keyword in issueDescription -> componentType
    const needed = inferComponentType(r.issueDescription || '');
    const candidate = products
      .filter((p) => (needed ? p.componentType === needed : true))
      .sort((a, b) => (a.stock === b.stock ? (a.price ?? 0) - (b.price ?? 0) : b.stock - a.stock))[0];
    if (!candidate) {
      alerts.push({
        id: `${Date.now()}-${Math.random()}`,
        productId: "unknown",
        level: "warning",
        message: `Sin repuesto sugerido para ${r.deviceModel} (${r.issueDescription})`,
        createdAt: new Date().toISOString(),
        supplierSuggestion: { supplierName: "Repair Parts Express", leadTimeDays: 3 },
      });
      continue;
    }
    if (candidate.stock <= 0) {
      alerts.push({
        id: `${Date.now()}-${Math.random()}`,
        productId: candidate.id,
        level: "critical",
        message: `Stock agotado para ${candidate.name}`,
        createdAt: new Date().toISOString(),
        supplierSuggestion: { supplierName: candidate.supplierName ?? "Proveedor alternativo", leadTimeDays: 7 },
      });
      continue;
    }
    reservations.push({
      id: `${Date.now()}-${Math.random()}`,
      repairId: r.id,
      productId: candidate.id,
      quantity: 1,
      reservedAt: new Date().toISOString(),
      status: "reserved",
    });
  }

  return { reservations, alerts };
}

export function inferComponentType(issueDescription: string): string | undefined {
  const text = (issueDescription || "").toLowerCase();
  if (text.includes("pantalla") || text.includes("screen")) return "screen";
  if (text.includes("batería") || text.includes("battery")) return "battery";
  if (text.includes("puerto") || text.includes("charging")) return "port";
  return undefined;
}

export function costReport(
  reservations: InventoryReservation[],
  products: ProductStock[],
  repairs: RepairOrder[]
) {
  const byModel: Record<string, number> = {};
  const byFailure: Record<string, number> = {};
  for (const res of reservations) {
    const product = products.find((p) => p.id === res.productId);
    const repair = repairs.find((r) => r.id === res.repairId);
    const price = product?.price ?? 0;
    if (repair && repair.deviceModel) {
      byModel[repair.deviceModel] = (byModel[repair.deviceModel] ?? 0) + price;
      const failureType = inferComponentType(repair.issueDescription || '') ?? "otros";
      byFailure[failureType] = (byFailure[failureType] ?? 0) + price;
    }
  }
  return { byModel, byFailure };
}

export function checkAvailability(repair: RepairOrder, products: ProductStock[]) {
  const type = inferComponentType(repair.issueDescription || '');
  if (!type) return { available: true, product: undefined };
  const candidate = products.find((p) => p.componentType === type);
  return { available: !!candidate && candidate.stock > 0, product: candidate };
}

export function generateReorderAlerts(products: ProductStock[], threshold = 3) {
  const alerts: InventoryAlert[] = [];
  for (const p of products) {
    if (p.stock <= threshold) {
      alerts.push({
        id: `${Date.now()}-${Math.random()}`,
        productId: p.id,
        level: p.stock === 0 ? "critical" : "warning",
        message: `Stock bajo para ${p.name} (quedan ${p.stock})`,
        createdAt: new Date().toISOString(),
        supplierSuggestion: { supplierName: p.supplierName ?? "Proveedor", leadTimeDays: p.stock === 0 ? 7 : 3 },
      });
    }
  }
  return alerts;
}