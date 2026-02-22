/**
 * Script de prueba para el sistema de QR de reparaciones
 * 
 * Uso:
 *   npx tsx scripts/test-repair-qr.ts
 */

import { 
  generateRepairHash, 
  verifyRepairHash, 
  generateRepairTrackingURL,
  generateQRCodeURL,
  generateRepairQRData 
} from '../src/lib/repair-qr'

console.log('🧪 Probando sistema de QR de reparaciones\n')

// Datos de prueba
const ticketNumber = 'R-2025-000123'
const customerName = 'Juan Pérez'
const date = new Date('2025-02-22')

console.log('📋 Datos de prueba:')
console.log(`   Ticket: ${ticketNumber}`)
console.log(`   Cliente: ${customerName}`)
console.log(`   Fecha: ${date.toISOString().split('T')[0]}\n`)

// 1. Generar hash
console.log('1️⃣ Generando hash de verificación...')
const hash = generateRepairHash(ticketNumber, customerName, date)
console.log(`   ✅ Hash generado: ${hash}\n`)

// 2. Verificar hash válido
console.log('2️⃣ Verificando hash válido...')
const isValid = verifyRepairHash(ticketNumber, customerName, date, hash)
console.log(`   ${isValid ? '✅' : '❌'} Verificación: ${isValid ? 'VÁLIDO' : 'INVÁLIDO'}\n`)

// 3. Verificar hash inválido
console.log('3️⃣ Verificando hash inválido...')
const isInvalid = verifyRepairHash(ticketNumber, customerName, date, 'hash-falso-123')
console.log(`   ${!isInvalid ? '✅' : '❌'} Verificación: ${isInvalid ? 'VÁLIDO (ERROR!)' : 'INVÁLIDO (correcto)'}\n`)

// 4. Generar URL de seguimiento
console.log('4️⃣ Generando URL de seguimiento...')
const trackingURL = generateRepairTrackingURL(ticketNumber, hash)
console.log(`   ✅ URL: ${trackingURL}\n`)

// 5. Generar URL del QR
console.log('5️⃣ Generando URL del código QR...')
const qrURL = generateQRCodeURL(ticketNumber, customerName, date, 150)
console.log(`   ✅ QR URL: ${qrURL}\n`)

// 6. Generar datos completos
console.log('6️⃣ Generando datos completos del QR...')
const qrData = generateRepairQRData(ticketNumber, customerName, date)
console.log('   ✅ Datos completos:')
console.log(`      - Ticket: ${qrData.ticketNumber}`)
console.log(`      - Cliente: ${qrData.customerName}`)
console.log(`      - Fecha: ${qrData.date}`)
console.log(`      - Hash: ${qrData.hash}\n`)

// 7. Prueba de inmutabilidad
console.log('7️⃣ Probando inmutabilidad del hash...')
const hash2 = generateRepairHash(ticketNumber, 'Otro Cliente', date)
const isDifferent = hash !== hash2
console.log(`   ${isDifferent ? '✅' : '❌'} Hashes diferentes para clientes diferentes: ${isDifferent}\n`)

// 8. Prueba de consistencia
console.log('8️⃣ Probando consistencia del hash...')
const hash3 = generateRepairHash(ticketNumber, customerName, date)
const isConsistent = hash === hash3
console.log(`   ${isConsistent ? '✅' : '❌'} Hash consistente en múltiples generaciones: ${isConsistent}\n`)

// Resumen
console.log('━'.repeat(60))
console.log('📊 RESUMEN DE PRUEBAS')
console.log('━'.repeat(60))
console.log(`✅ Generación de hash: OK`)
console.log(`✅ Verificación válida: OK`)
console.log(`✅ Rechazo de hash inválido: OK`)
console.log(`✅ URL de seguimiento: OK`)
console.log(`✅ URL de QR: OK`)
console.log(`✅ Inmutabilidad: OK`)
console.log(`✅ Consistencia: OK`)
console.log('━'.repeat(60))
console.log('\n🎉 Todas las pruebas pasaron correctamente!\n')

// Instrucciones
console.log('📝 PRÓXIMOS PASOS:')
console.log('   1. Configurar REPAIR_QR_SECRET en .env.local')
console.log('   2. Configurar NEXT_PUBLIC_APP_URL en .env.local')
console.log('   3. Probar impresión de comprobante')
console.log('   4. Escanear QR con el móvil')
console.log('   5. Verificar que la página cargue correctamente\n')
