import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { CommunicationChannel } from "@/types/repairs"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { repairId, channel, content, status } = body

    if (!repairId || !channel || !content) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("communication_messages")
      .insert({
        repair_id: repairId,
        channel: channel as CommunicationChannel,
        content: content,
        status: status || 'sent',
        direction: 'outbound',
        sent_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, message: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const repairId = searchParams.get('repairId')

    let query = supabase
      .from("communication_messages")
      .select("*")
      .order("created_at", { ascending: false })

    if (repairId) {
      query = query.eq("repair_id", repairId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ messages: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}


