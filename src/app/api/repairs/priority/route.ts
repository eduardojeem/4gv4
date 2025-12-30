import { NextResponse } from "next/server";
import { calculatePriorityScore, defaultPriorityConfig, sortRepairsByPriority } from "@/services/repair-priority";
import { RepairOrder } from "@/types/repairs";

let CONFIG = defaultPriorityConfig;
let REPAIRS: RepairOrder[] = [
  { id: "R-9001", customerName: "Test A", deviceModel: "iPhone 13", issueDescription: "Pantalla rota", urgency: 4, technicalComplexity: 3, createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), stage: "diagnosis" },
  { id: "R-9002", customerName: "Test B", deviceModel: "Galaxy S22", issueDescription: "Batería defectuosa", urgency: 2, technicalComplexity: 2, createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(), stage: "awaiting_parts" },
];

export async function GET() {
  const queue = sortRepairsByPriority(REPAIRS, CONFIG).map((r) => ({ id: r.id, score: calculatePriorityScore(r, CONFIG), repair: r }));
  return NextResponse.json({ queue, config: CONFIG });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.config) CONFIG = body.config;
    if (body.repairs) REPAIRS = body.repairs;
    const queue = sortRepairsByPriority(REPAIRS, CONFIG).map((r) => ({ id: r.id, score: calculatePriorityScore(r, CONFIG), repair: r }));
    return NextResponse.json({ ok: true, queue });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}