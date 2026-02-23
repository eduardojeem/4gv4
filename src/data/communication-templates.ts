
import { CommunicationTemplate } from "@/types/repairs"

export const DEFAULT_TEMPLATES: CommunicationTemplate[] = [
  {
    id: "t1",
    name: "Recepción de Equipo",
    channel: "whatsapp",
    content:
      "Hola {{customerName}}, hemos recibido tu {{deviceModel}} para reparación. Número de ticket: {{repairId}}. Te mantendremos informado del progreso.",
  },
  {
    id: "t2",
    name: "Diagnóstico Completado",
    channel: "whatsapp",
    content:
      "{{customerName}}, hemos completado el diagnóstico de tu {{deviceModel}}. El problema identificado es: [DESCRIBIR PROBLEMA]. Costo estimado: [MONTO]. ¿Deseas proceder?",
  },
  {
    id: "t3",
    name: "Esperando Repuestos",
    channel: "whatsapp",
    content:
      "{{customerName}}, estamos esperando los repuestos necesarios para tu {{deviceModel}} ({{repairId}}). Te notificaremos cuando lleguen.",
  },
  {
    id: "t4",
    name: "Reparación en Proceso",
    channel: "whatsapp",
    content:
      "{{customerName}}, tu {{deviceModel}} está siendo reparado. Estimamos tenerlo listo en [TIEMPO ESTIMADO].",
  },
  {
    id: "t5",
    name: "Equipo Listo",
    channel: "whatsapp",
    content:
      "¡Buenas noticias {{customerName}}! Tu {{deviceModel}} está listo para recoger. Horario: Lunes a Viernes 9am-6pm. Ticket: {{repairId}}",
  },
  {
    id: "t6",
    name: "Recordatorio de Recogida",
    channel: "sms",
    content:
      "{{customerName}}, tu {{deviceModel}} está listo desde hace [DÍAS] días. Por favor pasa a recogerlo. Ticket: {{repairId}}",
  },
  {
    id: "t7",
    name: "Solicitud de Aprobación",
    channel: "email",
    content:
      "Estimado/a {{customerName}},\n\nHemos diagnosticado tu {{deviceModel}} y necesitamos tu aprobación para proceder.\n\nProblema: [DESCRIBIR]\nCosto: [MONTO]\nTiempo estimado: [TIEMPO]\n\nPor favor responde este correo o llámanos para confirmar.\n\nTicket: {{repairId}}",
  },
  {
    id: "t8",
    name: "Encuesta de Satisfacción",
    channel: "whatsapp",
    content:
      "{{customerName}}, gracias por confiar en nosotros para reparar tu {{deviceModel}}. ¿Cómo calificarías nuestro servicio? Tu opinión es muy importante.",
  },
]
