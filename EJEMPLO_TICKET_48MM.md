# Ejemplo Visual - Ticket Optimizado para 48mm

## 📄 Ticket Básico Mejorado (32 caracteres de ancho)

```
████████████████████████████████
        TIENDA EJEMPLO
    Calle Principal 123
      RUC: 80012345-6
      Tel: 555-123-4567
================================
      TICKET N° REC-1737394225
        20/01/2026
        14:30:25
================================
CLIENTE: María González
RUC: 98765432-1
--------------------------------
PRODUCTOS:
iPhone 15 Pro Max 256GB Azul
2 x $1,200.00              $2,400.00
  Desc: -$100.00
Funda Protectora Transparente
1 x $25.00                   $25.00
Protector Pantalla Cristal
1 x $15.00                   $15.00
  Desc: -$2.00
Cable USB-C Lightning 2m
1 x $30.00                   $30.00
--------------------------------
SUBTOTAL:                 $2,470.00
DESCUENTO:                 -$102.00
IVA:                        $355.20
================================
TOTAL:                    $2,723.20
================================
PAGO: Tarjeta de Crédito
PAGADO:                   $2,723.20
================================
    ¡GRACIAS POR SU COMPRA!
         Vuelva pronto
================================
      www.tiendaejemplo.com
     Soporte: 555-123-4567
████████████████████████████████


```

## 📄 Ticket con Código QR

```
████████████████████████████████
        TIENDA EJEMPLO
    Calle Principal 123
      RUC: 80012345-6
      Tel: 555-123-4567
================================
      TICKET N° REC-1737394225
        20/01/2026
        14:30:25
================================
CLIENTE: María González
RUC: 98765432-1
--------------------------------
PRODUCTOS:
iPhone 15 Pro Max 256GB Azul
2 x $1,200.00              $2,400.00
  Desc: -$100.00
Funda Protectora Transparente
1 x $25.00                   $25.00
Protector Pantalla Cristal
1 x $15.00                   $15.00
  Desc: -$2.00
Cable USB-C Lightning 2m
1 x $30.00                   $30.00
--------------------------------
SUBTOTAL:                 $2,470.00
DESCUENTO:                 -$102.00
IVA:                        $355.20
================================
TOTAL:                    $2,723.20
================================
PAGO: Tarjeta de Crédito
PAGADO:                   $2,723.20
================================
    ¡GRACIAS POR SU COMPRA!
         Vuelva pronto
================================
      www.tiendaejemplo.com
     Soporte: 555-123-4567
████████████████████████████████

================================
   CODIGO QR PARA VERIFICACION
        [QR CODE AQUI]
      Escanea para verificar
        la autenticidad
================================
Hash: A1B2C3D4
================================


```

## 🎯 Características Destacadas

### ✅ Optimización de Espacio
- **32 caracteres por línea**: Perfecto para papel de 48mm
- **Texto truncado inteligente**: Los nombres largos se cortan con "..."
- **Alineación perfecta**: Precios alineados a la derecha
- **Separadores visuales**: Líneas claras entre secciones

### ✅ Información Completa
- **Header completo**: Nombre, dirección, RUC, teléfono
- **Fecha y hora**: Formato DD/MM/YYYY y HH:MM:SS
- **Cliente**: Información del comprador (si aplica)
- **Productos detallados**: Cantidad, precio unitario, subtotal
- **Descuentos visibles**: Claramente marcados por producto
- **Totales claros**: Subtotal, descuentos, IVA, total final
- **Información de pago**: Método y montos

### ✅ Elementos Visuales
- **Bordes decorativos**: Líneas dobles (█) para destacar
- **Separadores**: Líneas simples (=) y guiones (-)
- **Centrado**: Información importante centrada
- **Espaciado**: Distribución equilibrada del contenido

## 📱 Comandos ESC/POS (Versión Térmica)

Cuando se usa `formatThermalReceipt()`, el ticket incluye comandos especiales:

```
[ESC]@                    // Inicializar impresora
[ESC]a[1][GS]![1]        // Centrar + Doble altura
TIENDA EJEMPLO
[GS]![0][ESC]E[0]        // Tamaño normal + Sin negrita
Calle Principal 123
RUC: 80012345-6
Tel: 555-123-4567
================================
[ESC]E[1]                // Negrita ON
TICKET N° REC-1737394225
[ESC]E[0]                // Negrita OFF
20/01/2026 14:30:25
================================
[ESC]a[0][ESC]E[1]       // Izquierda + Negrita
CLIENTE:
[ESC]E[0]                // Sin negrita
María González
RUC: 98765432-1
--------------------------------
[ESC]E[1]                // Negrita
PRODUCTOS:
[ESC]E[0]                // Sin negrita
iPhone 15 Pro Max 256GB Azul
2 x $1,200.00              $2,400.00
  Desc: -$100.00
...
[ESC]a[1]                // Centrar
================================
[ESC]E[1][GS]![1]        // Negrita + Doble altura
TOTAL: $2,723.20
[GS]![0][ESC]E[0]        // Normal
================================
¡GRACIAS POR SU COMPRA!
Vuelva pronto
================================
Papel: 48mm | 20/01/2026
================================



[GS]V[0]                 // Cortar papel
```

## 🔍 Código QR - Datos Incluidos

El código QR contiene información en formato JSON:

```json
{
  "empresa": "TIENDA EJEMPLO",
  "ticket": "REC-1737394225",
  "fecha": "20/01/2026",
  "total": 2723.20,
  "ruc": "80012345-6",
  "hash": "A1B2C3D4"
}
```

### Hash de Verificación
El hash se genera combinando:
- Número de ticket
- Fecha completa
- Total de la venta
- RUC de la empresa

Esto permite verificar la autenticidad del ticket.

## 📏 Comparación de Tamaños

### Antes (40 caracteres)
```
========================================
           TIENDA EJEMPLO
       Calle Principal 123
         RUC: 80012345-6
========================================
     TICKET N° REC-1737394225
   Dom 20/01/2026 14:30:25 GMT-0500
========================================
iPhone 15 Pro Max 256GB Azul Titanio
2 x $1,200.00 = $2,400.00
```

### Después (32 caracteres - 48mm)
```
████████████████████████████████
        TIENDA EJEMPLO
    Calle Principal 123
      RUC: 80012345-6
================================
      TICKET N° REC-1737394225
        20/01/2026
        14:30:25
================================
iPhone 15 Pro Max 256GB Azul
2 x $1,200.00              $2,400.00
```

## 🎨 Ventajas del Nuevo Formato

### ✅ Más Compacto
- **20% menos ancho**: De 40 a 32 caracteres
- **Mejor aprovechamiento**: Del papel térmico de 48mm
- **Menos desperdicio**: Papel más eficiente

### ✅ Más Legible
- **Separación clara**: Entre secciones
- **Alineación mejorada**: Precios y totales
- **Información organizada**: Jerarquía visual clara

### ✅ Más Profesional
- **Bordes decorativos**: Apariencia premium
- **Formato consistente**: Espaciado uniforme
- **Información completa**: Todos los datos necesarios

### ✅ Más Funcional
- **Código QR**: Para verificación
- **Hash de seguridad**: Previene falsificaciones
- **Múltiples formatos**: Según necesidad

## 🚀 Implementación en el POS

En el sistema POS, ahora tienes 3 opciones de impresión:

1. **"Imprimir HTML"**: Versión tradicional para impresoras normales
2. **"Ticket 48mm"**: Optimizado para impresoras térmicas de 48mm
3. **"Ticket + QR"**: Incluye código QR para verificación

Cada opción genera el formato más apropiado para su uso específico.