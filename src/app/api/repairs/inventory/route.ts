import { NextResponse } from "next/server";
import { suggestReservations, costReport, ProductStock } from "@/services/inventory-repair-sync";
import { RepairOrder } from "@/types/repairs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const repairs = body.repairs as RepairOrder[];
    const products = body.products as ProductStock[];
    const { reservations, alerts } = suggestReservations(repairs, products);
    const report = costReport(reservations, products, repairs);
    return NextResponse.json({ ok: true, reservations, alerts, report });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}