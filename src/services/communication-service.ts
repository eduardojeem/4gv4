import { CommunicationChannel, CommunicationMessage } from "@/types/repairs"

export function expandTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  return Object.entries(variables).reduce(
    (text, [key, value]) => text.replace(new RegExp(`{{${key}}}`, "g"), String(value)),
    template
  )
}

export function validateContent(
  first: CommunicationChannel | string,
  second: CommunicationChannel | string
): { valid: boolean; error?: string } {
  const isChannelFirst = first === "sms" || first === "email" || first === "whatsapp" || first === "in_app"
  const channel = (isChannelFirst ? first : second) as CommunicationChannel
  const content = String(isChannelFirst ? second : first)

  if (!content.trim()) return { valid: false, error: "El contenido no puede estar vacio" }
  if (channel === "sms" && content.length > 160) {
    return { valid: false, error: "El mensaje SMS excede los 160 caracteres" }
  }
  return { valid: true }
}

export class CommunicationStore {
  private messages: CommunicationMessage[] = []

  add(message: CommunicationMessage) {
    this.messages.push(message)
  }

  forRepair(repairId: string) {
    return this.messages
      .filter((message) => message.repairId === repairId)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
  }

  all() {
    return [...this.messages]
  }
}

export class CommunicationService {
  private supabase

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  async getMessages(repairId: string): Promise<CommunicationMessage[]> {
    const { data, error } = await this.supabase
      .from("communication_messages")
      .select("*")
      .eq("repair_id", repairId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return (data || []).map((msg: any) => ({
      id: msg.id,
      repairId: msg.repair_id,
      channel: msg.channel as CommunicationChannel,
      content: msg.content,
      sentAt: msg.sent_at,
      status: msg.status,
    }))
  }

  async logMessage(
    repairId: string,
    channel: CommunicationChannel,
    content: string,
    status: "sent" | "failed" = "sent"
  ): Promise<CommunicationMessage> {
    const { data, error } = await this.supabase
      .from("communication_messages")
      .insert({
        repair_id: repairId,
        channel,
        content,
        status,
        direction: "outbound",
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      repairId: data.repair_id,
      channel: data.channel as CommunicationChannel,
      content: data.content,
      sentAt: data.sent_at,
      status: data.status,
    }
  }
}
