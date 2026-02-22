# 🔍 Guía Rápida: QR en Comprobantes de Reparación

## ¿Qué es?

Ahora todos los comprobantes de reparación incluyen un código QR que permite:

- ✅ **Rastrear** el estado de la reparación desde el móvil
- ✅ **Verificar** la autenticidad del comprobante
- ✅ **Prevenir** falsificaciones
- ✅ **Acceder** al historial completo 24/7

## Configuración Inicial (5 minutos)

### 1. Agregar variables al archivo `.env.local`

```env
# Secret para QR (generar uno aleatorio)
REPAIR_QR_SECRET=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz

# URL de tu aplicación
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

### 2. Generar un secret seguro

**Opción A - Con Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Opción B - Con OpenSSL:**
```bash
openssl rand -hex 32
```

**Opción C - Online:**
Visita: https://www.random.org/strings/ (64 caracteres, alfanumérico)

### 3. Reiniciar el servidor

```bash
npm run dev
```

## ¿Cómo Funciona?

### Para el Cliente

1. **Recibe el comprobante** con el QR impreso
2. **Abre la cámara** de su teléfono
3. **Escanea el QR**
4. **Ve el estado** de su reparación automáticamente

### Para el Técnico

1. **Crea la reparación** normalmente
2. **Imprime el comprobante** (el QR se genera automáticamente)
3. **Entrega al cliente**

¡Eso es todo! No hay pasos adicionales.

## Ubicación del QR

### Comprobante del Cliente
- **Posición**: Esquina inferior derecha
- **Tamaño**: 100x100 píxeles
- **Incluye**: Hash de verificación visible

### Ticket Técnico
- **Posición**: Centro inferior
- **Tamaño**: 120x120 píxeles
- **Incluye**: Texto "Escanea para rastrear"

## Verificación de Autenticidad

Cuando el cliente escanea el QR:

1. Se abre la página de seguimiento
2. Aparece un **badge verde** si es auténtico
3. Aparece un **badge rojo** si es falso o modificado

### Badge Verde ✅
```
✓ Comprobante Verificado
Este es un comprobante auténtico emitido por R-2025-000123
```

### Badge Rojo ❌
```
⚠ Verificación Fallida
No se pudo verificar la autenticidad de este comprobante
```

## Preguntas Frecuentes

### ¿El QR funciona sin internet?
No, se necesita internet para:
- Generar el QR (usa API externa)
- Verificar el hash (consulta la base de datos)
- Mostrar el estado actual

### ¿Qué pasa si cambio el secret?
- Los QR antiguos seguirán funcionando para consultar
- Solo la verificación de autenticidad dejará de funcionar
- Los nuevos comprobantes usarán el nuevo secret

### ¿Puedo personalizar el QR?
Sí, en `src/lib/repair-qr.ts` puedes:
- Cambiar el tamaño
- Agregar logo (requiere librería adicional)
- Modificar el formato de datos

### ¿Funciona en papel térmico?
Sí, el QR está optimizado para:
- Papel térmico 58mm
- Papel térmico 80mm
- Papel A4

### ¿Qué datos contiene el QR?
El QR contiene una URL con:
- Número de ticket
- Hash de verificación (16 caracteres)

Ejemplo:
```
https://tu-dominio.com/mis-reparaciones/R-2025-000123?verify=abc123def456
```

### ¿Es seguro?
Sí, usa:
- Hash SHA-256
- Secret key privado
- Validación server-side
- Datos inmutables

## Solución de Problemas

### El QR no se genera
**Causa**: Falta configuración  
**Solución**: Verificar que `NEXT_PUBLIC_APP_URL` esté en `.env.local`

### El QR no escanea
**Causa**: Calidad de impresión  
**Solución**: 
- Aumentar contraste de la impresora
- Usar papel de mejor calidad
- Aumentar el tamaño del QR

### Verificación siempre falla
**Causa**: Secret incorrecto  
**Solución**: Verificar que `REPAIR_QR_SECRET` sea el mismo que cuando se generó

### Error "API externa no disponible"
**Causa**: qrserver.com no responde  
**Solución**: 
- Esperar unos minutos
- Verificar conexión a internet
- Considerar usar librería local (ver documentación completa)

## Probar el Sistema

### 1. Ejecutar script de prueba

```bash
npx tsx scripts/test-repair-qr.ts
```

Debe mostrar:
```
✅ Generación de hash: OK
✅ Verificación válida: OK
✅ Rechazo de hash inválido: OK
✅ URL de seguimiento: OK
✅ URL de QR: OK
✅ Inmutabilidad: OK
✅ Consistencia: OK
```

### 2. Probar en la interfaz

1. Crear una reparación de prueba
2. Imprimir el comprobante
3. Escanear el QR con el móvil
4. Verificar que cargue la página correctamente
5. Confirmar que aparezca el badge verde

## Componente Visual (Opcional)

Para mostrar el QR en la interfaz de administración:

```tsx
import { RepairQRCode } from '@/components/dashboard/repairs/RepairQRCode'

<RepairQRCode
  ticketNumber="R-2025-000123"
  customerName="Juan Pérez"
  createdAt={new Date()}
  size={200}
/>
```

## Soporte

Si tienes problemas:

1. Revisar esta guía
2. Ejecutar el script de prueba
3. Verificar logs del servidor
4. Consultar documentación completa: `docs/IMPLEMENTACION_QR_REPARACIONES.md`

---

**Última actualización**: 22 de febrero de 2025  
**Versión**: 1.0.0
