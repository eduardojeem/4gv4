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
    version: 1,
    title: 'Política de Privacidad',
    content: `En cumplimiento con la **Ley N° 6534/2020** "De Protección de Datos Personales Crediticios y Tratamiento de Datos Personales" de la República del Paraguay, informamos a los usuarios y clientes acerca del tratamiento de sus datos personales en nuestra plataforma.

## 1. Responsable del Tratamiento

La plataforma opera como prestador tecnológico de servicios de software como servicio (SaaS) y comercio digital para empresas, comercios y usuarios finales.

## 2. Datos Recolectados

Podemos recolectar y tratar las siguientes categorías de datos personales:
- **Identificación y contacto:** Nombre, apellido, documento de identidad (C.I. / RUC), correo electrónico, número telefónico y dirección comercial.
- **Datos transaccionales:** Información de pedidos, facturación, cobros, tickets de servicio técnico y soporte.
- **Datos técnicos:** Dirección IP, tipo de navegador, sistema operativo y registros de auditoría de sesiones para prevención de fraudes y seguridad.

## 3. Finalidad del Tratamiento

Los datos personales recabados son utilizados para:
- Proveer, operar y optimizar las herramientas de punto de venta (POS), inventario y facturación.
- Gestionar cuentas de usuario, sucursales y permisos de acceso organizacional.
- Procesar transacciones y emitir comprobantes legales.
- Garantizar la seguridad, integridad del sistema y cumplimiento normativo.

## 4. Seguridad y Confidencialidad

Implementamos medidas técnicas y organizativas rigurosas (cifrado en tránsito mediante TLS, aislamiento estricto multi-inquilino a nivel de base de datos y control de accesos basados en roles) para salvaguardar sus datos personales contra acceso no autorizado, alteración o pérdida.

## 5. Derechos del Titular (Derechos ARCO)

Conforme a la legislación vigente, usted tiene derecho a acceder, rectificar, actualizar o solicitar la cancelación de sus datos personales. Para ejercer estos derechos, puede comunicarse a través de los canales de soporte del sistema.

## 6. Actualizaciones de la Política

Nos reservamos el derecho de modificar esta política para adaptarla a novedades legislativas o jurisprudenciales. Toda modificación será publicada en esta misma sección.`,
    status: 'published',
    changeSummary: 'Versión inicial oficial de la plataforma',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
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
