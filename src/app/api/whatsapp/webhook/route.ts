import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger' // Asumiendo que usas tu logger

// Tu token de verificación secreto (configurado en el panel de Meta)
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'tu_token_secreto_123'

// 1. Manejar la verificación del Webhook (Petición GET)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.info('Webhook de WhatsApp verificado correctamente')
    // Es MUY importante devolver solo el 'challenge' como texto plano (status 200)
    return new NextResponse(challenge, { status: 200 })
  } else {
    logger.warn('Fallo la verificación del Webhook de WhatsApp')
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }
}

// 2. Recibir mensajes de WhatsApp (Petición POST)
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Comprobar si es un evento de WhatsApp (object: 'whatsapp_business_account')
    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0] &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        // Datos del mensaje recibido
        const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id
        const from = body.entry[0].changes[0].value.messages[0].from // Numero de quien envía
        const msgBody = body.entry[0].changes[0].value.messages[0].text.body // Texto del mensaje

        logger.info(`Mensaje recibido de ${from}: ${msgBody}`)

        // Aquí podrías guardar el mensaje en Supabase
        // await supabase.from('communication_messages').insert({ ... })
        
        // O responder automáticamente llamando a tu servicio de envío...
      }
      
      // Siempre devolver un 200 OK inmediatamente para que WhatsApp sepa que recibiste el mensaje
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    } else {
      return NextResponse.json({ status: 'not found' }, { status: 404 })
    }
  } catch (error) {
    logger.error('Error procesando webhook de WhatsApp', { error })
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
