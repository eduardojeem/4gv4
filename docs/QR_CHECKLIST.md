# ✅ Checklist de Implementación - QR en Comprobantes

## 📋 Configuración Inicial

### 1. Variables de Entorno
- [ ] Abrir archivo `.env.local` (crear si no existe)
- [ ] Agregar `REPAIR_QR_SECRET` con valor aleatorio de 32+ caracteres
- [ ] Agregar `NEXT_PUBLIC_APP_URL` con la URL de tu aplicación
- [ ] Guardar el archivo

**Ejemplo:**
```env
REPAIR_QR_SECRET=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

### 2. Generar Secret Seguro
- [ ] Ejecutar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Copiar el resultado
- [ ] Pegar en `REPAIR_QR_SECRET`

### 3. Reiniciar Servidor
- [ ] Detener el servidor (Ctrl+C)
- [ ] Ejecutar: `npm run dev`
- [ ] Esperar a que inicie correctamente

## 🧪 Pruebas

### 1. Script de Prueba
- [ ] Ejecutar: `npx tsx scripts/test-repair-qr.ts`
- [ ] Verificar que todas las pruebas pasen (7/7)
- [ ] Confirmar que no hay errores

**Resultado esperado:**
```
✅ Generación de hash: OK
✅ Verificación válida: OK
✅ Rechazo de hash inválido: OK
✅ URL de seguimiento: OK
✅ URL de QR: OK
✅ Inmutabilidad: OK
✅ Consistencia: OK
```

### 2. Prueba en Interfaz
- [ ] Acceder al dashboard
- [ ] Crear una reparación de prueba
- [ ] Imprimir el comprobante del cliente
- [ ] Verificar que el QR aparezca en la esquina inferior derecha
- [ ] Verificar que el hash sea visible debajo del QR

### 3. Prueba de Escaneo
- [ ] Abrir la cámara del móvil
- [ ] Escanear el QR del comprobante
- [ ] Verificar que abra la página de seguimiento
- [ ] Confirmar que aparezca el badge verde "Comprobante Verificado"
- [ ] Verificar que se muestre el estado de la reparación

### 4. Prueba de Verificación
- [ ] Modificar manualmente el hash en la URL
- [ ] Recargar la página
- [ ] Confirmar que aparezca el badge rojo "Verificación Fallida"
- [ ] Verificar que se muestre el toast de error

## 📱 Pruebas de Impresión

### Papel Térmico 58mm
- [ ] Configurar impresora térmica
- [ ] Imprimir comprobante de prueba
- [ ] Verificar que el QR sea legible
- [ ] Escanear con móvil
- [ ] Confirmar que funcione correctamente

### Papel Térmico 80mm
- [ ] Configurar impresora térmica
- [ ] Imprimir comprobante de prueba
- [ ] Verificar que el QR sea legible
- [ ] Escanear con móvil
- [ ] Confirmar que funcione correctamente

### Papel A4
- [ ] Configurar impresora láser/inkjet
- [ ] Imprimir comprobante de prueba
- [ ] Verificar que el QR sea legible
- [ ] Escanear con móvil
- [ ] Confirmar que funcione correctamente

## 🔒 Seguridad

### Verificación de Secret
- [ ] Confirmar que `REPAIR_QR_SECRET` no esté en el código fuente
- [ ] Verificar que `.env.local` esté en `.gitignore`
- [ ] Confirmar que el secret sea diferente en cada entorno
- [ ] Documentar el secret en lugar seguro (gestor de contraseñas)

### Pruebas de Falsificación
- [ ] Intentar crear un QR falso manualmente
- [ ] Verificar que la verificación falle
- [ ] Confirmar que aparezca el badge rojo
- [ ] Verificar que se registre en logs (opcional)

## 🌐 Producción

### Pre-Deploy
- [ ] Verificar que todas las pruebas pasen
- [ ] Confirmar configuración de variables de entorno
- [ ] Revisar que `NEXT_PUBLIC_APP_URL` sea la URL de producción
- [ ] Generar nuevo `REPAIR_QR_SECRET` para producción

### Deploy
- [ ] Configurar variables en plataforma de hosting
- [ ] Hacer deploy de la aplicación
- [ ] Verificar que el servidor inicie correctamente
- [ ] Probar endpoint: `/api/repairs/verify-qr`

### Post-Deploy
- [ ] Crear reparación de prueba en producción
- [ ] Imprimir comprobante
- [ ] Escanear QR desde móvil
- [ ] Verificar que funcione correctamente
- [ ] Confirmar badge de verificación

## 📊 Monitoreo

### Logs
- [ ] Configurar logging de verificaciones
- [ ] Monitorear intentos de verificación fallidos
- [ ] Revisar logs de errores
- [ ] Configurar alertas (opcional)

### Métricas
- [ ] Contar comprobantes generados con QR
- [ ] Medir tasa de escaneos
- [ ] Analizar verificaciones exitosas vs fallidas
- [ ] Identificar problemas comunes

## 📚 Documentación

### Interna
- [ ] Leer `docs/QR_REPARACIONES_GUIA_RAPIDA.md`
- [ ] Revisar `docs/IMPLEMENTACION_QR_REPARACIONES.md`
- [ ] Consultar `docs/QR_REPARACIONES_RESUMEN.md`
- [ ] Familiarizarse con el código

### Para el Equipo
- [ ] Capacitar al equipo sobre el nuevo sistema
- [ ] Explicar cómo funciona la verificación
- [ ] Mostrar cómo escanear QR
- [ ] Documentar procedimientos

### Para Clientes
- [ ] Preparar material explicativo
- [ ] Crear instructivo de escaneo
- [ ] Diseñar poster/flyer informativo
- [ ] Actualizar sitio web con información

## 🎯 Validación Final

### Funcionalidad
- [ ] QR se genera automáticamente
- [ ] Comprobante se imprime correctamente
- [ ] QR es escaneable
- [ ] Verificación funciona
- [ ] Badge aparece correctamente

### Rendimiento
- [ ] Generación de QR < 1 segundo
- [ ] Verificación < 500ms
- [ ] Página carga rápidamente
- [ ] Sin errores en consola
- [ ] Sin warnings en build

### UX
- [ ] QR es visible y legible
- [ ] Badge es claro y comprensible
- [ ] Toast notifications funcionan
- [ ] Diseño es responsive
- [ ] Compatible con móviles

### Seguridad
- [ ] Hash es único por comprobante
- [ ] Verificación rechaza hashes falsos
- [ ] Secret no está expuesto
- [ ] API está protegida
- [ ] Datos sensibles no se exponen

## ✨ Mejoras Opcionales

### Fase 2
- [ ] Agregar logo de empresa al QR
- [ ] Implementar estadísticas de escaneos
- [ ] Configurar notificaciones push
- [ ] Crear QR dinámicos
- [ ] Integrar con Analytics

### Fase 3
- [ ] Implementar blockchain
- [ ] Agregar firma digital
- [ ] Incluir certificado SSL
- [ ] Geolocalización de escaneos
- [ ] Historial completo de escaneos

## 🐛 Troubleshooting

### Si algo falla:
- [ ] Revisar logs del servidor
- [ ] Verificar variables de entorno
- [ ] Ejecutar script de prueba
- [ ] Consultar documentación
- [ ] Revisar este checklist

### Problemas comunes:
- [ ] QR no se genera → Verificar `NEXT_PUBLIC_APP_URL`
- [ ] Verificación falla → Revisar `REPAIR_QR_SECRET`
- [ ] QR no escanea → Mejorar calidad de impresión
- [ ] Error 500 → Revisar logs del servidor

---

## 📝 Notas

**Fecha de implementación**: _______________  
**Implementado por**: _______________  
**Versión**: 1.0.0  
**Estado**: [ ] En progreso [ ] Completado [ ] En producción

**Observaciones**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

**¿Todo listo?** ✅  
Si marcaste todos los items, ¡el sistema está completamente implementado!
