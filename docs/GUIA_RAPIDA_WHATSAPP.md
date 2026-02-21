# Guía Rápida: Implementación de WhatsApp

## ✅ Ya Configurado

1. ✅ Variable de entorno `NEXT_PUBLIC_WHATSAPP_BUSINESS` agregada
2. ✅ Botón flotante agregado en el sitio público
3. ✅ Botón de WhatsApp en la página de perfil
4. ✅ Todas las utilidades y componentes creados

## 🚀 Próximos Pasos de Integración

### 1. Agregar WhatsApp en Lista de Reparaciones (Dashboard)

En `src/components/dashboard/repairs/RepairRow.tsx`, agregar el botón de WhatsApp en el menú de acciones:

```tsx
// Importar al inicio del archivo
import { MessageCircle } from 'lucide-react'
import { useWhatsApp } from '@/hooks/useWhatsApp'

// Dentro del componente RepairRow, agregar el hook
const { notifyRepairStatus, notifyRepairReady } = useWhatsApp()

// En el DropdownMenuContent, agregar estos items después de los existentes:
<DropdownMenuSeparator />
<DropdownMenuLabel>WhatsApp</DropdownMenuLabel>

<DropdownMenuItem
  onClick={() => notifyRepairStatus(
    repair.customer.phone,
    repair.ticketNumber || repair.id,
    repair.customer.name,
    repair.status
  )}
  disabled={!repair.customer.phone}
>
  <MessageCircle className="mr-2 h-4 w-4" />
  Enviar Estado
</DropdownMenuItem>

{repair.status === 'listo' && (
  <DropdownMenuItem
    onClick={() => notifyRepairReady(
      repair.customer.phone,
      repair.ticketNumber || repair.id,
      repair.customer.name,
      `${repair.brand} ${repair.model}`
    )}
    disabled={!repair.customer.phone}
  >
    <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
    Notificar Listo
  </DropdownMenuItem>
)}
```

### 2. Agregar WhatsApp en Tarjeta de Cliente

En `src/components/dashboard/customers/CustomerCard.tsx` (o donde muestres clientes):

```tsx
import { CustomerWhatsAppContact } from '@/components/customers/customer-whatsapp-contact'

// En el componente, donde muestres el teléfono:
<CustomerWhatsAppContact
  customerName={customer.name}
  customerPhone={customer.phone}
  variant="inline"
/>
```

### 3. Agregar WhatsApp en Detalle de Reparación

En `src/components/dashboard/repairs/RepairDetailDialog.tsx`:

```tsx
import { WhatsAppButton } from '@/components/ui/whatsapp-button'
import { WhatsAppTemplates } from '@/lib/whatsapp'

// En la sección de acciones del diálogo:
<WhatsAppButton
  phone={repair.customer.phone}
  message={WhatsAppTemplates.repairStatus(
    repair.ticketNumber || repair.id,
    repair.customer.name,
    repair.status
  )}
  variant="outline"
>
  Contactar Cliente
</WhatsAppButton>
```

### 4. Agregar WhatsApp en Página de Productos Públicos

En `src/app/(public)/productos/page.tsx`:

```tsx
import { WhatsAppButton } from '@/components/ui/whatsapp-button'
import { WhatsAppTemplates } from '@/lib/whatsapp'

// En cada tarjeta de producto:
<WhatsAppButton
  phone={process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS!}
  message={WhatsAppTemplates.priceInquiry(product.name)}
  variant="outline"
  size="sm"
>
  Consultar
</WhatsAppButton>
```

### 5. Agregar Notificaciones Automáticas

En el archivo donde cambias el estado de reparaciones:

```tsx
import { useWhatsApp } from '@/hooks/useWhatsApp'

const { notifyRepairStatus } = useWhatsApp()

const handleStatusChange = async (repairId: string, newStatus: string) => {
  // Actualizar en base de datos
  await updateRepairStatus(repairId, newStatus)
  
  // Obtener datos de la reparación
  const repair = repairs.find(r => r.id === repairId)
  
  // Notificar por WhatsApp si el cliente tiene teléfono
  if (repair?.customer.phone) {
    notifyRepairStatus(
      repair.customer.phone,
      repair.ticketNumber || repairId,
      repair.customer.name,
      newStatus
    )
  }
  
  // Mostrar confirmación
  toast.success('Estado actualizado y cliente notificado')
}
```

## 📱 Componentes Disponibles

### WhatsAppButton
Botón completo con icono y texto:
```tsx
<WhatsAppButton
  phone="595981123456"
  message="Hola! Quisiera consultar"
  variant="default" // default | outline | ghost | floating
  size="default"    // sm | default | lg | icon
>
  Contactar
</WhatsAppButton>
```

### WhatsAppLink
Enlace de texto con icono:
```tsx
<WhatsAppLink
  phone="595981123456"
  message="Consulta"
>
  +595 981 123456
</WhatsAppLink>
```

### WhatsAppFloatButton
Botón flotante (ya implementado en layout público):
```tsx
<WhatsAppFloatButton 
  showOnPages={['/inicio', '/productos']}
  hideOnPages={['/admin']}
/>
```

## 🎯 Plantillas de Mensajes

```tsx
import { WhatsAppTemplates } from '@/lib/whatsapp'

// Estado de reparación
WhatsAppTemplates.repairStatus(repairId, customerName, status)

// Reparación lista
WhatsAppTemplates.repairReady(repairId, customerName, device)

// Recordatorio de pago
WhatsAppTemplates.paymentReminder(customerName, amount, repairId)

// Mensaje de bienvenida
WhatsAppTemplates.welcomeMessage(customerName)

// Rastrear reparación
WhatsAppTemplates.trackRepair(repairId)

// Consultar precio
WhatsAppTemplates.priceInquiry(productName)

// Consulta general
WhatsAppTemplates.generalInquiry()
```

## 🔧 Hook useWhatsApp

```tsx
import { useWhatsApp } from '@/hooks/useWhatsApp'

const {
  sendMessage,           // Enviar mensaje personalizado
  contactBusiness,       // Contactar al negocio
  notifyRepairStatus,    // Notificar cambio de estado
  notifyRepairReady,     // Notificar reparación lista
  sendPaymentReminder,   // Enviar recordatorio de pago
  trackRepair,           // Rastrear reparación
  inquirePrice,          // Consultar precio
  templates              // Acceso a todas las plantillas
} = useWhatsApp()
```

## 🎨 Estilos de WhatsApp

Los componentes ya usan los colores oficiales de WhatsApp:
- Verde principal: `#25D366`
- Verde hover: `#20BA5A`

## 🧪 Probar la Integración

1. **Botón Flotante**: Visita cualquier página pública (inicio, productos, mis-reparaciones)
2. **Perfil**: Ve a tu perfil y busca el botón de WhatsApp
3. **Reparaciones**: Crea una reparación y prueba enviar notificaciones
4. **Clientes**: Contacta a un cliente desde su tarjeta

## 📊 Métricas Sugeridas

Para trackear el uso de WhatsApp, puedes agregar analytics:

```tsx
import { useWhatsApp } from '@/hooks/useWhatsApp'

const { sendMessage } = useWhatsApp()

const handleWhatsAppClick = (action: string) => {
  // Enviar evento a analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'whatsapp_click', {
      action: action,
      category: 'engagement'
    })
  }
  
  // Enviar mensaje
  sendMessage({ phone, message })
}
```

## 🔒 Mejores Prácticas

1. ✅ Siempre verificar que el cliente tenga teléfono antes de mostrar botones
2. ✅ Usar plantillas predefinidas para mantener consistencia
3. ✅ Agregar confirmación antes de enviar notificaciones masivas
4. ✅ Respetar horarios comerciales para notificaciones automáticas
5. ✅ Permitir que los clientes opten por no recibir notificaciones

## 🆘 Troubleshooting

**Problema**: El botón no abre WhatsApp
- Verificar que el número esté en formato correcto (595...)
- Asegurarse de que el usuario tenga WhatsApp instalado

**Problema**: El botón flotante no aparece
- Verificar que `framer-motion` esté instalado: `npm install framer-motion`
- Revisar las rutas en `showOnPages` o `hideOnPages`

**Problema**: Los mensajes no se formatean bien
- Usar `\n` para saltos de línea
- Usar `*texto*` para negrita en WhatsApp
- Usar emojis para hacer mensajes más amigables

## 📞 Soporte

Para más información, consulta:
- [Documentación Completa](./INTEGRACION_WHATSAPP.md)
- [WhatsApp Click to Chat](https://faq.whatsapp.com/general/chats/how-to-use-click-to-chat)
