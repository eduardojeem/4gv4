import type { LegalDocument, LegalDocumentType } from '@/lib/legal/shared'

/**
 * Textos base de los documentos legales. Sin dependencias de servidor: los usa
 * la página pública (si la base no responde) y el editor (para arrancar el
 * primer borrador en vez de una hoja en blanco).
 */
export const DEFAULT_LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocument> = {
  privacy: {
    id: 'default-privacy',
    documentType: 'privacy',
    version: 2,
    title: 'Política de privacidad',
    content: `Esta política explica qué datos personales trata MiTiendaPy, para qué, con quién los compartimos, cuánto tiempo los guardamos y cómo podés ejercer tus derechos. Se aplica a la web www.mitiendapy.com, a las tiendas publicadas en ella y a la app **Mi TiendaPy** para Android y iOS.

## 1. Quién es el responsable

El responsable del tratamiento es **MiTiendaPy**, que también publica la app Mi TiendaPy en Google Play y App Store. Para cualquier consulta sobre tus datos escribinos a **soporte@mitiendapy.com**.

MiTiendaPy está pensada para comercios y personas en Paraguay.

## 2. Dos papeles distintos: tu cuenta y los datos de cada comercio

- **Somos responsables** de los datos de las cuentas de la plataforma (dueños, administradores y empleados de los comercios, y compradores registrados en el marketplace), de la facturación de las suscripciones y de los registros técnicos y de seguridad.
- **Cada comercio es responsable** de los datos de sus propios clientes que carga o recibe en el sistema (por ejemplo, fichas de clientes, ventas, reparaciones, turnos y créditos). MiTiendaPy los guarda y procesa solo por cuenta del comercio y para prestarle el servicio. Si sos cliente de un comercio, para ejercer tus derechos sobre esos datos escribile primero al comercio; si no responde, podés escribirnos.

## 3. Qué datos tratamos

- **Cuenta:** nombre, correo, teléfono, foto de perfil, contraseña (guardada cifrada, nunca la vemos), rol y permisos. Si entrás con Google, recibimos de Google tu nombre, correo y foto; no recibimos tu contraseña de Google.
- **Verificación en dos pasos:** si la activás, guardamos el factor de tu app de códigos; los códigos se generan en tu teléfono.
- **Datos del comercio:** razón social, RUC, dirección, teléfonos, redes, horarios, logo, productos, precios, stock y fotos de productos.
- **Datos que el comercio carga de sus clientes:** nombre, documento o RUC, teléfono, WhatsApp, correo, dirección, fecha de nacimiento, notas, compras, pedidos, comprobantes, reparaciones, turnos, créditos y pagos.
- **Compras en el marketplace y las tiendas:** datos de contacto y entrega, productos, montos, favoritos y carrito.
- **Pagos de la suscripción:** plan, montos, fechas y estado. Los datos de la tarjeta los procesa directamente la entidad de pago; nosotros no los guardamos.
- **Datos técnicos y de seguridad:** dirección IP, navegador, sistema operativo, inicios de sesión y registros de auditoría de acciones dentro del panel.
- **Visitas a la web:** página visitada, sitio de origen, campaña (utm), tipo de dispositivo, país aproximado y un identificador aleatorio del navegador. No guardamos la dirección IP en estas estadísticas.

## 4. Para qué los usamos

- Prestar el servicio: punto de venta, inventario, catálogo y tienda web, pedidos, comprobantes, reparaciones, turnos, créditos y reportes.
- Crear y proteger tu cuenta: inicio de sesión, verificación en dos pasos, permisos por rol y prevención de fraude y abuso (por ejemplo, limitar intentos repetidos).
- Cobrar la suscripción y emitir los comprobantes que exige la ley.
- Enviarte correos y notificaciones del servicio: invitaciones, avisos de pedidos, recordatorios de pago y de vencimiento. Los mensajes que un comercio manda a sus clientes los decide ese comercio.
- Darte soporte cuando nos escribís.
- Medir de forma agregada qué páginas se visitan, para mejorar la plataforma y mostrarle a cada comercio las visitas de su tienda.

No vendemos datos personales ni los usamos para publicidad de terceros.

## 5. App móvil

La app pide permisos solo cuando usás la función que los necesita, y podés negarlos o quitarlos desde los ajustes del teléfono:

- **Cámara:** para escanear códigos de barras y sacar fotos de productos. El escaneo se hace en el teléfono; solo se suben las fotos que elegís guardar.
- **Fotos:** para elegir imágenes de la galería y cargarlas como fotos de productos o del comercio.
- **Huella o Face ID:** para desbloquear la app sin escribir la contraseña. La verificación la hace el sistema del teléfono: la app no recibe ni guarda tu huella ni tu rostro, y ningún dato biométrico sale del dispositivo.
- **Almacenamiento seguro:** la sesión, el correo recordado y tus preferencias se guardan cifrados en el almacenamiento seguro del teléfono (Keystore en Android, Keychain en iOS).
- **Notificaciones:** si las aceptás, guardamos un identificador del dispositivo para enviarte avisos.
- **Ubicación aproximada:** solo si tocás **Tiendas cerca mío** en el marketplace. El teléfono averigua tu ciudad y país, y la app los usa para filtrar las tiendas. No pedimos tu ubicación precisa ni en segundo plano, y no guardamos tus coordenadas.

La app no usa tu micrófono ni tus contactos.

## 6. Cookies y almacenamiento en el navegador

Usamos cookies y almacenamiento local para mantener tu sesión, el carrito y tus preferencias; sin ellos el sitio no funciona. Además usamos un identificador aleatorio para contar visitas. En el aviso de cookies podés elegir **Solo esenciales**: la medición de visitas se detiene y se borran sus identificadores. Podés cambiar tu elección en cualquier momento desde **Preferencias de cookies**, al pie de la página.

## 7. Con quién compartimos datos

Usamos proveedores que procesan datos por cuenta nuestra y solo para prestar el servicio:

- **Supabase:** base de datos, inicio de sesión y almacenamiento de fotos y archivos.
- **Vercel:** alojamiento de la web.
- **Upstash:** control de intentos repetidos por dirección IP.
- **Resend:** envío de correos.
- **Expo:** envío de notificaciones a la app.
- **Google:** inicio de sesión con Google, si lo elegís, y los mapas que muestran la ubicación de una tienda. Al ver ese mapa, tu navegador se conecta con Google Maps.
- **Bancard y Stripe:** cobro de la suscripción.

Algunos de estos proveedores guardan los datos en servidores fuera de Paraguay, principalmente en Estados Unidos. Los elegimos porque aplican medidas de seguridad reconocidas y los usan solo para prestarnos el servicio. También podemos entregar datos cuando una autoridad competente lo exija conforme a la ley.

## 8. Cuánto tiempo los guardamos

- **Cuenta:** mientras esté activa. Si pedís eliminarla, se bloquea en el momento y a los 30 días se borran tus datos personales.
- **Ventas, caja y comprobantes de los comercios:** 5 años, el plazo que fija la ley tributaria, sin tus datos personales si eliminaste tu cuenta.
- **Datos de clientes de un comercio:** mientras el comercio los mantenga en el sistema. Si el comercio se cierra, quedan desactivados y se borran si el comercio lo pide.
- **Comercios que no renuevan la suscripción:** quedan suspendidos con sus datos guardados; a los 91 días se archivan y dejan de estar publicados, y a los 180 días se eliminan o anonimizan sus datos operativos, salvo los que la ley obliga a conservar (ver los Términos y condiciones).
- **Registros técnicos, de seguridad y estadísticas de visitas:** el tiempo necesario para la seguridad, la auditoría y las estadísticas; los revisamos periódicamente para borrar lo que ya no hace falta.

## 9. Eliminar tu cuenta

Podés pedirlo desde la app (**Perfil → Eliminar cuenta**) o desde www.mitiendapy.com/saas/eliminar-cuenta. Si no podés entrar, escribinos a soporte@mitiendapy.com desde el correo de la cuenta. En esa página se explica qué se borra y qué se conserva.

## 10. Tus derechos

Podés pedir acceder a tus datos, corregirlos, actualizarlos, eliminarlos u oponerte a su uso, y retirar un consentimiento que hayas dado. Escribinos a **soporte@mitiendapy.com** desde el correo de tu cuenta; te respondemos dentro de los 15 días hábiles. Si no quedás conforme, podés recurrir a la autoridad de protección de datos o a la acción de hábeas data.

## 11. Seguridad

Los datos viajan cifrados (HTTPS/TLS) y se guardan cifrados en los servidores de nuestros proveedores. Cada comercio solo puede ver sus propios datos, el acceso dentro de cada comercio depende del rol de cada usuario, las contraseñas se guardan cifradas y ofrecemos verificación en dos pasos. Ningún sistema es infalible: si ocurre un incidente que afecte tus datos, te avisamos y tomamos medidas para contenerlo.

## 12. Menores de edad

MiTiendaPy es un servicio para comercios y no está dirigido a menores de 18 años. No creamos cuentas de menores a sabiendas.

## 13. Ley aplicable

Tratamos los datos conforme a la Constitución de la República del Paraguay (artículos 33 y 135, hábeas data), la Ley N° 7593/2025 de Protección de Datos Personales y las demás normas paraguayas aplicables.

## 14. Cambios en esta política

Si cambiamos esta política publicamos la nueva versión en esta página, con su fecha de vigencia. Si el cambio es importante, también te avisamos por correo o dentro de la plataforma.`,
    status: 'published',
    changeSummary: 'Se suman la app móvil (incluida la ubicación aproximada de Tiendas cerca mío), los proveedores, los plazos de conservación, el borrado de cuenta, las cookies y la Ley 7593/2025',
    createdAt: '2026-11-19T12:00:00.000Z',
    updatedAt: '2026-11-19T12:00:00.000Z',
    publishedAt: '2026-11-19T12:00:00.000Z',
  },
  terms: {
    id: 'default-terms',
    documentType: 'terms',
    version: 1,
    title: 'Términos y Condiciones de Uso',
    content: `Bienvenido a la plataforma. Al acceder, registrarse o utilizar cualquiera de nuestros servicios, usted acepta y se compromete a cumplir con los presentes Términos y Condiciones.

## 1. Objeto y Alcance del Servicio

La plataforma proporciona una solución integral de gestión comercial en la nube (SaaS), que incluye punto de venta (POS), administración de inventarios, facturación, catálogo público, módulo de servicio técnico y reparaciones, y gestión de cuentas por cobrar.

## 2. Cuentas y Responsabilidades del Usuario

- El usuario debe proporcionar información verídica y mantener actualizados sus datos.
- Cada usuario y organización es enteramente responsable de preservar la confidencialidad de sus credenciales y de toda acción realizada bajo su cuenta.
- Queda prohibido el uso de la plataforma para actividades ilícitas, fraudulentas o que vulneren derechos de terceros o la normativa paraguaya.

## 3. Planes, Facturación y Pagos

- El uso de ciertas funcionalidades está sujeto a planes de suscripción activos.
- Los pagos por planes y servicios adicionales se abonan por adelantado según la periodicidad contratada a través de los medios de pago autorizados.
- La falta de pago faculta a la plataforma a suspender temporalmente el acceso a los módulos operativos vinculados a la suscripción.

## 4. Propiedad Intelectual

Todos los derechos sobre el software, código fuente, interfaces, marcas y contenidos pertenecen exclusivamente a la plataforma y sus licenciantes. Queda prohibida su reproducción, descompilación o ingeniería inversa sin autorización expresa por escrito.

## 5. Limitación de Responsabilidad

La plataforma se suministra bajo estándares de alta disponibilidad y seguridad razonables. No asumimos responsabilidad por interrupciones ajenas derivadas de proveedores de telecomunicaciones, caídas de internet o fallas en dispositivos locales del cliente.

## 6. Ley Aplicable y Jurisdicción

Estos Términos y Condiciones se rigen por las leyes de la República del Paraguay. Cualquier controversia será dirimida ante los juzgados y tribunales de la ciudad de Asunción.`,
    status: 'published',
    changeSummary: 'Versión inicial oficial de la plataforma',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
  },
}
