# Integración de WhatsApp

## Descripción General

Se ha implementado un sistema completo de integración con WhatsApp que permite:
- Enviar mensajes directos a clientes
- Notificaciones de estado de reparaciones
- Recordatorios de pago
- Contacto directo con el negocio
- Botón flotante en el sitio público

## Archivos Creados

### 1. Utilidades Core (`src/lib/whatsapp.ts`)
Funciones principales para manejar WhatsApp:
- `formatWhatsAppPhone()` - Formatea números de teléfono
- `getWhatsAppLink()` - Genera enlaces de WhatsApp
- `openWhatsApp()` - Abre WhatsApp en nueva ventana
- `WhatsAppTemplates` - Plantillas de mensajes predefinidas
- `getBusinessWhatsApp()` - Obtiene el número del negocio

### 2. Componentes UI (`src/components/ui/whatsapp-button.tsx`)
- `WhatsAppButton` - Botón reutilizable de WhatsApp
- `WhatsAppLink` - Enlace de texto con icono de WhatsApp

### 3. Hook Personalizado (`src/hooks/useWhatsApp.ts`)
Hook React para facilitar el uso de WhatsApp:
- `sendMessage()` - Enviar mensaje personalizado
- `contactBusiness()` - Contactar al negocio
- `notifyRepairStatus()` - Notificar cambio de estado
- `notifyRepairReady()` - Notificar reparación lista
- `sendPaymentReminder()` - Enviar recordatorio de pago
- `trackRepair()` - Rastrear reparación
- `inquirePrice()` - Consultar precio

### 4. Botón Flotante (`src/components/whatsapp-float-button.tsx`)
Botón flotante con animaciones para el sitio público

## Configuración

### Variables de Entorno

Agregar en `.env.local`:

```env
# WhatsApp Business Number (con código de país, sin espacios ni guiones)
NEXT_PUBLIC_WHATSAPP_BUSINESS=595981123456
```

### Formato de Números

Los números deben estar en formato internacional:
- Paraguay: `595` + número (ej: `595981123456`)
- Sin espacios, guiones ni paréntesis
- El sistema formatea automáticamente números locales

## Uso Básico

### 1. Botón Simple

```tsx
import { WhatsAppButton } from '@/components/ui/whatsapp-button'

<WhatsAppButton
  phone="595981123456"
  message="Hola! Quisiera hacer una consulta"
>
  Contactar
</WhatsAppButton>
```

### 2. Botón Flotante

```tsx
import { WhatsAppButton } from '@/components/ui/whatsapp-button'

<WhatsAppButton
  phone="595981123456"
  variant="floating"
/>
```

### 3. Enlace de Texto

```tsx
import { WhatsAppLink } from '@/components/ui/whatsapp-button'

<WhatsAppLink
  phone="595981123456"
  message="Consulta sobre producto"
>
  Contactar por WhatsApp
</WhatsAppLink>
```

### 4. Usando el Hook

```tsx
import { useWhatsApp } from '@/hooks/useWhatsApp'

function MyComponent() {
  const { notifyRepairReady, contactBusiness } = useWhatsApp()

  const handleNotify = () => {
    notifyRepairReady(
      '595981123456',
      'REP-001',
      'Juan Pérez',
      'iPhone 12'
    )
  }

  return (
    <button onClick={handleNotify}>
      Notificar Cliente
    </button>
  )
}
```

## Plantillas de Mensajes

### Disponibles

1. **repairStatus** - Cambio de estado de reparación
2. **repairReady** - Reparación lista para retirar
3. **paymentReminder** - Recordatorio de pago
4. **welcomeMessage** - Mensaje de bienvenida
5. **newRepairNotification** - Nueva reparación (interno)
6. **lowStockAlert** - Alerta de stock bajo (interno)
7. **generalInquiry** - Consulta general
8. **trackRepair** - Rastrear reparación
9. **priceInquiry** - Consultar precio

### Ejemplo de Uso

```tsx
import { WhatsAppTemplates } from '@/lib/whatsapp'

const message = WhatsAppTemplates.repairReady(
  'REP-001',
  'Juan Pérez',
  'iPhone 12'
)
// Resultado: "¡Buenas noticias Juan Pérez! 🎉\n\nTu iPhone 12 (Reparación #REP-001) ya está listo para retirar..."
```

## Casos de Uso Implementados

### 1. Página de Perfil
- Botón para contactar con el negocio desde el perfil
- Ubicación: `src/app/(public)/perfil/page.tsx`

### 2. Notificaciones de Reparaciones
```tsx
// En el componente de reparaciones
const { notifyRepairStatus } = useWhatsApp()

const handleStatusChange = async (repair) => {
  // Actualizar en base de datos
  await updateRepairStatus(repair.id, newStatus)
  
  // Notificar por WhatsApp
  notifyRepairStatus(
    repair.customer.phone,
    repair.id,
    repair.customer.name,
    newStatus
  )
}
```

### 3. Recordatorios de Pago
```tsx
// En el componente de créditos/pagos
const { sendPaymentReminder } = useWhatsApp()

const handleSendReminder = (customer, amount, repairId) => {
  sendPaymentReminder(
    customer.phone,
    customer.name,
    amount,
    repairId
  )
}
```

### 4. Botón Flotante en Sitio Público
```tsx
// En el layout público
import { WhatsAppFloatButton } from '@/components/whatsapp-float-button'

export default function PublicLayout({ children }) {
  return (
    <>
      {children}
      <WhatsAppFloatButton 
        showOnPages={['/inicio', '/productos', '/mis-reparaciones']}
      />
    </>
  )
}
```

## Integración con Componentes Existentes

### En Lista de Reparaciones

```tsx
import { WhatsAppButton } from '@/components/ui/whatsapp-button'
import { WhatsAppTemplates } from '@/lib/whatsapp'

<WhatsAppButton
  phone={repair.customer.phone}
  message={WhatsAppTemplates.trackRepair(repair.id)}
  variant="outline"
  size="sm"
>
  Contactar Cliente
</WhatsAppButton>
```

### En Tarjeta de Cliente

```tsx
import { WhatsAppLink } from '@/components/ui/whatsapp-button'

<div className="customer-contact">
  <WhatsAppLink
    phone={customer.phone}
    message={WhatsAppTemplates.welcomeMessage(customer.name)}
  >
    {customer.phone}
  </WhatsAppLink>
</div>
```

### En Dashboard de Productos

```tsx
import { useWhatsApp } from '@/hooks/useWhatsApp'

const { inquirePrice } = useWhatsApp()

<Button onClick={() => inquirePrice(product.name)}>
  Consultar Precio
</Button>
```

## Estilos y Personalización

### Colores de WhatsApp
- Verde principal: `#25D366`
- Verde hover: `#20BA5A`

### Variantes del Botón
- `default` - Botón verde de WhatsApp
- `outline` - Botón con borde
- `ghost` - Botón transparente
- `floating` - Botón flotante circular

### Tamaños
- `sm` - Pequeño
- `default` - Normal
- `lg` - Grande
- `icon` - Solo icono

## Próximos Pasos (Opcional)

### 1. WhatsApp Business API Oficial
Para funcionalidades avanzadas:
- Envío automático de mensajes
- Mensajes programados
- Plantillas aprobadas por WhatsApp
- Webhooks para recibir mensajes

**Requisitos:**
- Cuenta de WhatsApp Business
- Verificación de Facebook Business
- Aprobación de Meta
- Costo por mensaje

### 2. Twilio WhatsApp API
Alternativa más fácil:
- Configuración más simple
- API REST
- Webhooks
- Costo por mensaje

**Implementación básica:**
```typescript
// src/lib/twilio-whatsapp.ts
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function sendWhatsAppMessage(to: string, body: string) {
  return await client.messages.create({
    from: 'whatsapp:+14155238886', // Twilio sandbox
    to: `whatsapp:${to}`,
    body
  })
}
```

### 3. Automatizaciones
- Envío automático al cambiar estado de reparación
- Recordatorios programados de pago
- Alertas de stock bajo
- Confirmaciones de citas

### 4. Analytics
- Tracking de mensajes enviados
- Tasa de respuesta
- Conversiones desde WhatsApp

## Mejores Prácticas

1. **Siempre pedir permiso** antes de enviar mensajes automáticos
2. **Validar números** antes de intentar enviar
3. **Usar plantillas** para mantener consistencia
4. **No abusar** del envío de mensajes
5. **Respetar horarios** comerciales
6. **Incluir opt-out** en mensajes automáticos
7. **Cumplir con GDPR/LGPD** si aplica

## Troubleshooting

### El enlace no abre WhatsApp
- Verificar que el número esté en formato correcto
- Asegurarse de que el usuario tenga WhatsApp instalado
- En desktop, debe tener WhatsApp Web configurado

### Números no se formatean correctamente
- Revisar el código de país en `formatWhatsAppPhone()`
- Verificar que no haya caracteres especiales

### Botón flotante no aparece
- Verificar que `framer-motion` esté instalado
- Revisar las rutas en `showOnPages` o `hideOnPages`

## Testing

```typescript
// Ejemplo de test
import { formatWhatsAppPhone, getWhatsAppLink } from '@/lib/whatsapp'

describe('WhatsApp Utils', () => {
  it('formats phone correctly', () => {
    expect(formatWhatsAppPhone('0981123456')).toBe('595981123456')
    expect(formatWhatsAppPhone('981123456')).toBe('595981123456')
    expect(formatWhatsAppPhone('595981123456')).toBe('595981123456')
  })

  it('generates correct link', () => {
    const link = getWhatsAppLink({
      phone: '595981123456',
      message: 'Hola'
    })
    expect(link).toBe('https://wa.me/595981123456?text=Hola')
  })
})
```

## Soporte

Para más información sobre la API de WhatsApp:
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Twilio WhatsApp](https://www.twilio.com/whatsapp)
- [wa.me Links](https://faq.whatsapp.com/general/chats/how-to-use-click-to-chat)
