import { NextResponse } from 'next/server'

// Webhook de WhatsApp DESHABILITADO.
// La integración de WhatsApp no está implementada y fue retirada de los planes.
// Se deja el endpoint inerte (sin token de verificación ni procesamiento de payloads)
// para no exponer un receptor sin autenticar. Si en el futuro se implementa, hay que
// restaurar la verificación del handshake de Meta y validar la firma X-Hub-Signature-256.

function disabled() {
  return NextResponse.json({ error: 'WhatsApp integration is disabled' }, { status: 410 })
}

export async function GET() {
  return disabled()
}

export async function POST() {
  return disabled()
}
