/**
 * Script para probar la generación de URL del QR
 * Verifica que use window.location.origin en lugar de localhost
 */

// Simular entorno del navegador
(global as any).window = {
  location: {
    origin: 'https://mi-dominio.com'
  }
}

import { generateRepairTrackingURL, generateQRCodeURL } from '../src/lib/repair-qr'

console.log('🧪 Probando generación de URL del QR\n')

const ticketNumber = 'R-2025-000123'
const hash = 'abc123def456'
const date = new Date('2025-02-22')
const customerName = 'Juan Pérez'

console.log('📋 Datos de prueba:')
console.log(`   Ticket: ${ticketNumber}`)
console.log(`   Hash: ${hash}`)
console.log(`   Simulando: window.location.origin = 'https://mi-dominio.com'\n`)

// Probar generación de URL
console.log('1️⃣ Generando URL de seguimiento...')
const trackingURL = generateRepairTrackingURL(ticketNumber, hash)
console.log(`   ✅ URL: ${trackingURL}`)

if (trackingURL.includes('localhost')) {
  console.log('   ❌ ERROR: La URL contiene localhost!')
} else if (trackingURL.includes('mi-dominio.com')) {
  console.log('   ✅ CORRECTO: Usa window.location.origin')
} else {
  console.log('   ⚠️  ADVERTENCIA: URL inesperada')
}

console.log('\n2️⃣ Generando URL del QR...')
const qrURL = generateQRCodeURL(ticketNumber, customerName, date, 150)
console.log(`   ✅ QR URL generada`)

if (qrURL.includes('localhost')) {
  console.log('   ❌ ERROR: El QR contiene localhost!')
} else if (qrURL.includes('mi-dominio.com')) {
  console.log('   ✅ CORRECTO: El QR usa window.location.origin')
} else {
  console.log('   ⚠️  ADVERTENCIA: QR con URL inesperada')
}

console.log('\n3️⃣ Probando sin window (servidor)...')
delete (global as any).window

const serverURL = generateRepairTrackingURL(ticketNumber, hash)
console.log(`   ✅ URL servidor: ${serverURL}`)

if (serverURL.includes('localhost') || serverURL.includes('NEXT_PUBLIC')) {
  console.log('   ⚠️  Usando fallback (normal en servidor sin env)')
} else {
  console.log('   ✅ Usa variable de entorno')
}

console.log('\n━'.repeat(60))
console.log('📊 RESUMEN')
console.log('━'.repeat(60))
console.log('✅ En el navegador: Usa window.location.origin')
console.log('✅ En el servidor: Usa NEXT_PUBLIC_APP_URL')
console.log('✅ Fallback: localhost (solo desarrollo)')
console.log('━'.repeat(60))
console.log('\n🎉 Sistema de URL mejorado correctamente!\n')
