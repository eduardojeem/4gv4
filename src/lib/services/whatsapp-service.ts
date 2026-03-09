const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0' // O la versión actual
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN // Token temporal o permanente de Meta
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID // ID del número que envía

export class WhatsAppService {
  
  static async enviarMensajeTexto(numeroDestino: string, texto: string) {
    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
      console.warn('WhatsApp API no está configurada. Faltan variables de entorno.')
      return null
    }

    try {
      const response = await fetch(`${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numeroDestino, // Formato internacional, ej: 595981123456
          type: 'text',
          text: {
            preview_url: false,
            body: texto
          }
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('Error enviando mensaje WhatsApp:', data)
        throw new Error(data.error?.message || 'Error al enviar WhatsApp')
      }

      return data
    } catch (error) {
      console.error('Excepción en WhatsAppService:', error)
      throw error
    }
  }
}
