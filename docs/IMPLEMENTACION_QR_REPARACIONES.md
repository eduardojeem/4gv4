# Implementación de QR con Verificación en Comprobantes de Reparación

## Descripción General

Se ha implementado un sistema completo de códigos QR con verificación criptográfica para los comprobantes de reparación. Este sistema permite:

1. **Generar QR únicos** para cada comprobante con hash de verificación
2. **Rastrear reparaciones** escaneando el QR desde cualquier dispositivo
3. **Verificar autenticidad** del comprobante mediante hash SHA-256
4. **Prevenir falsificaciones** con validación en tiempo real

## Componentes Implementados

### 1. Librería de Utilidades QR (`src/lib/repair-qr.ts`)

Funciones principales:

- `generateRepairHash()`: Genera hash SHA-256 único basado en:
  - Número de ticket
  - Nombre del cliente
  - Fecha de creación
  - Secret key (configurable en `.env`)

- `verifyRepairHash()`: Verifica si un hash es válido

- `generateQRCodeURL()`: Genera URL del QR usando qrserver.com API

- `generateRepairTrackingURL()`: Crea URL de seguimiento con hash incluido

### 2. API de Verificación (`src/app/api/repairs/verify-qr/route.ts`)

Endpoint: `GET /api/repairs/verify-qr?ticket=R-2025-000001&hash=abc123`

Respuestas:
- ✅ `200`: Hash válido, comprobante auténtico
- ❌ `403`: Hash inválido, posible falsificación
- ❌ `404`: Ticket no encontrado
- ❌ `400`: Parámetros faltantes

### 3. Comprobante Actualizado (`src/lib/repair-receipt.ts`)

#### Comprobante del Cliente
- QR en la esquina inferior derecha (100x100px)
- Hash de verificación visible debajo del QR
- Espacio para firma del cliente
- Diseño responsive para impresión

#### Ticket Técnico
- QR centrado (120x120px)
- Texto "Escanea para rastrear"
- Optimizado para papel térmico y A4

### 4. Página de Verificación (`src/app/(public)/mis-reparaciones/[ticketId]/page.tsx`)

Características:
- Detección automática del parámetro `?verify=hash`
- Badge visual de verificación (verde/rojo)
- Toast notifications para feedback inmediato
- Integración con el flujo existente de consulta

## Flujo de Uso

### Para el Cliente

1. **Recibe el comprobante** impreso con QR
2. **Escanea el QR** con su teléfono
3. **Accede a la página de búsqueda** con el ticket pre-cargado
4. **Ve el badge de verificación** confirmando autenticidad
5. **Ingresa su email o teléfono** para autenticarse
6. **Consulta el estado** de su reparación en tiempo real

### Para el Técnico/Administrador

1. **Genera el comprobante** desde el sistema
2. **El QR se crea automáticamente** con hash único
3. **Imprime** el comprobante (térmico o A4)
4. **Entrega al cliente** con garantía de autenticidad

## Configuración

### Variables de Entorno

Agregar a `.env.local`:

```env
# Secret para generación de hash QR (CAMBIAR EN PRODUCCIÓN)
REPAIR_QR_SECRET=tu-secret-key-super-seguro-aqui

# URL base de la aplicación (para QR)
# En desarrollo, se usa automáticamente window.location.origin
# En producción, configurar con tu dominio real
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

⚠️ **IMPORTANTE**: 
- En desarrollo, el sistema usa automáticamente `window.location.origin`
- En producción, configurar `NEXT_PUBLIC_APP_URL` con tu dominio real
- Cambiar `REPAIR_QR_SECRET` por un valor aleatorio y seguro

### Generar Secret Seguro

```bash
# En Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# En Linux/Mac
openssl rand -hex 32
```

## Seguridad

### Características de Seguridad

1. **Hash SHA-256**: Algoritmo criptográfico robusto
2. **Secret Key**: Previene generación de hashes falsos
3. **Datos inmutables**: Ticket + Cliente + Fecha
4. **Validación server-side**: No se puede falsificar desde el cliente
5. **Hash truncado**: 16 caracteres para QR compacto

### Prevención de Ataques

- ✅ **Falsificación**: Imposible sin conocer el secret
- ✅ **Replay**: Hash único por comprobante
- ✅ **Modificación**: Cualquier cambio invalida el hash
- ✅ **Fuerza bruta**: SHA-256 + secret de 32 bytes

## Ejemplos de Uso

### Generar Comprobante con QR

```typescript
import { printRepairReceipt } from '@/lib/repair-receipt'

const payload = {
  ticketNumber: 'R-2025-000123',
  date: new Date(),
  customer: {
    name: 'Juan Pérez',
    phone: '+595981234567',
    email: 'juan@example.com'
  },
  devices: [{
    typeLabel: 'Smartphone',
    brand: 'Samsung',
    model: 'Galaxy S21',
    issue: 'Pantalla rota',
    estimatedCost: 500000
  }],
  priority: 'high',
  warrantyMonths: 3
}

// Imprime comprobante con QR automático
printRepairReceipt('customer', payload)
```

### Verificar QR Manualmente

```typescript
import { verifyRepairHash } from '@/lib/repair-qr'

const isValid = verifyRepairHash(
  'R-2025-000123',
  'Juan Pérez',
  new Date('2025-02-22'),
  'abc123def456'
)

console.log(isValid ? 'Auténtico' : 'Falso')
```

## Formato del QR

El QR contiene una URL completa que redirige a la página de búsqueda:

```
https://tu-dominio.com/mis-reparaciones?ticket=R-2025-000123&verify=abc123def456
```

Componentes:
- **Base URL**: Dominio de la aplicación
- **Página**: `/mis-reparaciones` (página de búsqueda)
- **Ticket**: Número único de reparación (parámetro `ticket`)
- **Hash**: Código de verificación de 16 caracteres (parámetro `verify`)

### Flujo del Usuario

1. Cliente escanea el QR
2. Se abre `/mis-reparaciones` con el ticket pre-cargado
3. Sistema verifica automáticamente el hash
4. Muestra badge verde/rojo de verificación
5. Cliente ingresa su email o teléfono
6. Sistema muestra el estado de la reparación

## Beneficios

### Para el Negocio

- ✅ Previene comprobantes falsos
- ✅ Mejora la imagen profesional
- ✅ Reduce fraudes y disputas
- ✅ Facilita el seguimiento
- ✅ Automatiza la verificación

### Para el Cliente

- ✅ Consulta rápida del estado
- ✅ Confianza en la autenticidad
- ✅ Acceso 24/7 desde el móvil
- ✅ No necesita apps adicionales
- ✅ Historial completo visible

## Mantenimiento

### Rotación del Secret

Si el secret se compromete:

1. Generar nuevo secret
2. Actualizar `.env.local`
3. Reiniciar la aplicación
4. Los QR antiguos seguirán funcionando para consulta
5. Solo la verificación de nuevos comprobantes usará el nuevo secret

### Monitoreo

Revisar logs de verificación fallida:

```typescript
// En el endpoint de verificación
if (!isValid) {
  console.warn('QR verification failed', { ticketNumber, hash })
}
```

## Próximas Mejoras

### Fase 2 (Opcional)

- [ ] QR con logo de la empresa en el centro
- [ ] Estadísticas de escaneos por ticket
- [ ] Notificaciones push al escanear
- [ ] QR dinámicos con actualización de estado
- [ ] Integración con Google Analytics
- [ ] Exportar comprobante como PDF con QR

### Fase 3 (Avanzado)

- [ ] Blockchain para inmutabilidad
- [ ] Firma digital del comprobante
- [ ] Certificado SSL en el QR
- [ ] Geolocalización del escaneo
- [ ] Historial de escaneos

## Troubleshooting

### El QR no se genera

- Verificar que `NEXT_PUBLIC_APP_URL` esté configurado
- Revisar conexión a internet (usa API externa)
- Comprobar que los datos del payload sean válidos

### Verificación falla siempre

- Confirmar que `REPAIR_QR_SECRET` sea el mismo en generación y verificación
- Verificar que la fecha del comprobante sea correcta
- Revisar que el nombre del cliente coincida exactamente

### QR no escanea

- Aumentar el tamaño del QR (parámetro `size`)
- Mejorar calidad de impresión
- Asegurar buen contraste (fondo blanco)
- Verificar que la URL sea accesible públicamente

## Soporte

Para dudas o problemas:
1. Revisar logs del servidor
2. Verificar configuración de variables de entorno
3. Comprobar que la API de qrserver.com esté disponible
4. Consultar documentación de Next.js para SSR/CSR

---

**Fecha de implementación**: 22 de febrero de 2025  
**Versión**: 1.0.0  
**Autor**: Sistema de Gestión 4G Celulares
