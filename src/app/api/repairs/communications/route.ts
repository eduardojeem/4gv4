import { NextResponse } from "next/server";
import { CommunicationStore, sendMessage } from "@/services/communication-service";
import { CommunicationChannel, RepairOrder } from "@/types/repairs";

const store = new CommunicationStore();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const repair = body.repair as RepairOrder;
    const channel = body.channel as CommunicationChannel;
    const content = body.content as string;
    const msg = sendMessage(store, channel, repair, content);
    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ messages: store.all() });
}