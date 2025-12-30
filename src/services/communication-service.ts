import {
  CommunicationChannel,
  CommunicationMessage,
  CommunicationTemplate,
  ReminderRule,
  RepairOrder,
} from "@/types/repairs";

export class CommunicationStore {
  private messages: CommunicationMessage[] = [];

  add(message: CommunicationMessage) {
    this.messages.push(message);
  }

  forRepair(repairId: string) {
    return this.messages
      .filter((m) => m.repairId === repairId)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }

  all() {
    return [...this.messages];
  }
}

export function expandTemplate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(vars[key] ?? ""));
}

export function validateContent(channel: CommunicationChannel, content: string) {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: "Contenido vacío" };
  }
  if (channel === "sms" && content.length > 160) {
    return { valid: false, error: "SMS excede 160 caracteres" };
  }
  return { valid: true };
}

/**
 * @deprecated Use useRepairCommunications hook instead.
 */
export function sendMessage(
  store: CommunicationStore,
  channel: CommunicationChannel,
  repair: RepairOrder,
  content: string
): CommunicationMessage {
  const validation = validateContent(channel, content);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const message: CommunicationMessage = {
    id,
    repairId: repair.id,
    channel,
    content,
    sentAt: new Date().toISOString(),
    status: validation.valid ? "sent" : "failed",
  };
  store.add(message);

  // naive dispatch for demo
  try {
    if (validation.valid) {
      if (channel === "whatsapp" && repair.customerPhone) {
        const url = `https://wa.me/${repair.customerPhone}?text=${encodeURIComponent(content)}`;
        if (typeof window !== "undefined") window.open(url, "_blank");
      }
      if (channel === "email" && repair.customerEmail) {
        const url = `mailto:${repair.customerEmail}?subject=${encodeURIComponent(
          `Actualización reparación ${repair.id}`
        )}&body=${encodeURIComponent(content)}`;
        if (typeof window !== "undefined") window.location.href = url;
      }
      if (channel === "sms" && repair.customerPhone) {
        const url = `sms:${repair.customerPhone}?body=${encodeURIComponent(content)}`;
        if (typeof window !== "undefined") window.location.href = url;
      }
    }
  } catch (e) {
    // ignore
  }
  return message;
}

export function scheduleReminders(
  rules: ReminderRule[],
  repairs: RepairOrder[],
  templates: CommunicationTemplate[],
  store: CommunicationStore
) {
  const now = Date.now();
  for (const rule of rules) {
    const tmpl = templates.find((t) => t.id === rule.templateId);
    if (!tmpl) continue;
    for (const r of repairs) {
      if (r.stage !== rule.trigger.stage) continue;
      const last = new Date(r.updatedAt ?? r.createdAt).getTime();
      const hours = (now - last) / (1000 * 60 * 60);
      if (hours >= rule.trigger.inactivityHours) {
        const content = expandTemplate(tmpl.content, {
          customerName: r.customerName || 'Cliente',
          repairId: r.id,
          deviceModel: r.deviceModel || 'Dispositivo',
        });
        sendMessage(store, tmpl.channel, r, content);
      }
    }
  }
}