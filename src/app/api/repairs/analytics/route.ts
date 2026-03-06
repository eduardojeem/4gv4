import { NextResponse } from "next/server";
import { correlateSymptoms, estimateDurations, recommendDiagnosis } from "@/lib/repair-predictive";
import { RepairOrder } from "@/types/repairs";
import { requireStaff, getAuthResponse } from "@/lib/auth/require-auth";

export async function POST(req: Request) {
  try {
    const auth = await requireStaff();
    { const r = getAuthResponse(auth); if (r) return r };
    const body = await req.json();
    const repairs = body.repairs as RepairOrder[];
    const issueText = body.issueText as string;
    const metrics = estimateDurations(repairs);
    const correlations = correlateSymptoms(repairs);
    const recommendations = recommendDiagnosis(repairs, issueText ?? "");
    return NextResponse.json({ ok: true, metrics, correlations, recommendations });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}

