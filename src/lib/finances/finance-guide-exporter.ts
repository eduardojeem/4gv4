/**
 * finance-guide-exporter.ts
 *
 * Módulo de exportación del Manual de Administración Financiera.
 * Soporta descarga en PDF profesional (vía jsPDF y autotable),
 * descarga en formato Markdown (.md) e impresión directa con estilos modernos.
 */

export interface GuideSectionData {
  key: string
  title: string
  subtitle: string
  objective: string
  badgeText: string
  keyPoints: { title: string; desc: string }[]
  formulas?: { name: string; formula: string; explanation: string }[]
  example?: {
    title: string
    description: string
    rows: [string, string, string, string][]
  }
  tips: string[]
}

export const FINANCE_GUIDE_DATA: Record<string, GuideSectionData> = {
  resumen: {
    key: 'resumen',
    title: 'Resumen Financiero y Rutina de Gestión',
    subtitle: 'Control Diario, Semanal y Mensual de Resultados y Liquidez',
    badgeText: 'Pilar 1 • Rutina y Control',
    objective:
      'Garantizar que el dueño o administrador conozca en todo momento el rendimiento real de la empresa, distinguiendo la utilidad contable del dinero líquido en caja.',
    keyPoints: [
      {
        title: 'Resultado Devengado vs. Flujo de Caja',
        desc: 'El devengado mide lo ganado por ventas y servicios ejecutados sin importar si se cobraron hoy. El flujo de caja mide el dinero real que ingresó y egresó de tus bolsillos o cuentas.',
      },
      {
        title: 'Rutina Diaria',
        desc: '1) Apertura de caja con fondo inicial. 2) Registrar cobros y adelantos al instante. 3) Registro inmediato de gastos de caja chica. 4) Arqueo ciego obligatorio al cierre.',
      },
      {
        title: 'Rutina Semanal',
        desc: '1) Revisar cuentas por pagar próximas en el panel de Gastos. 2) Auditar ventas o reparaciones sin costo directo cargado. 3) Contactar clientes con créditos vencidos.',
      },
      {
        title: 'Rutina Mensual',
        desc: '1) Preparar y aprobar la liquidación de nómina. 2) Analizar márgenes netos y de rentabilidad. 3) Evaluar si el beneficio cubre los costos fijos y reinversión.',
      },
    ],
    formulas: [
      {
        name: 'Utilidad Bruta',
        formula: 'Ingresos Operativos - Costos Directos (Repuestos/Insumos)',
        explanation: 'Lo que deja tu operación antes de pagar sueldos fijos, alquiler y servicios.',
      },
      {
        name: 'Margen Bruto (%)',
        formula: '(Utilidad Bruta / Ingresos Operativos) × 100',
        explanation: 'Porcentaje que retiene el negocio por cada Guaraní vendido. Meta taller: > 50%.',
      },
      {
        name: 'Utilidad Neta',
        formula: 'Utilidad Bruta - Gastos Fijos - Nómina Total',
        explanation: 'La ganancia real del período que pertenece a los dueños o para reinversión.',
      },
      {
        name: 'Flujo Neto de Caja',
        formula: 'Total Cobrado en el Período - Total Desembolsado',
        explanation: 'La variación neta de dinero líquido en cuentas bancarias y cajas físicas.',
      },
    ],
    example: {
      title: 'Ejemplo Práctico: Taller & Comercio en Asunción',
      description: 'Cierre mensual comparativo de devengado vs. flujo real',
      rows: [
        ['Facturación Devengada', 'Reparaciones y ventas realizadas en el mes', 'Gs. 45.000.000', 'Impacta en Ganancia Bruta'],
        ['Costos Directos Repuestos', 'Pantallas, pines y accesorios consumidos', 'Gs. 15.000.000', 'Resta de Ganancia Bruta'],
        ['Gastos Operativos & Nómina', 'Alquiler Gs. 4.000.000 + Nómina Gs. 12.000.000', 'Gs. 16.000.000', 'Resta de Ganancia Neta'],
        ['Utilidad Neta del Mes', 'Gs. 45.000.000 - Gs. 15.000.000 - Gs. 16.000.000', 'Gs. 14.000.000', 'Rentabilidad Neta: 31.1%'],
        ['Flujo Real de Fondos', 'Cobrado Gs. 38.000.000 - Pagado Gs. 29.000.000', 'Gs. 9.000.000', 'Dinero nuevo disponible en caja'],
      ],
    },
    tips: [
      'Nunca tomes decisiones de retiro de utilidades mirando solo la Ganancia Neta; verificá siempre el Flujo de Caja disponible.',
      'Si el flujo es menor a la ganancia, el dinero está en cuentas por cobrar de clientes o en repuestos almacenados.',
      'Realizá siempre arqueos ciegos: el cajero no debe saber cuánto debería haber en el sistema antes de contar los billetes.',
    ],
  },

  gastos: {
    key: 'gastos',
    title: 'Gastos Operativos y Cuentas por Pagar',
    subtitle: 'Registro de Obligaciones, Compras a Crédito y Egresos de Caja',
    badgeText: 'Pilar 2 • Cuentas por Pagar',
    objective:
      'Controlar los compromisos financieros con proveedores, diferenciando el reconocimiento de una deuda del desembolso real de fondos.',
    keyPoints: [
      {
        title: 'Registrar un Gasto NO es Pagarlo',
        desc: 'Al registrar una factura o compra, se genera una obligación (estado Pendiente). El dinero no sale de tus cuentas hasta asentar un pago parcial o total.',
      },
      {
        title: 'Compras a Crédito con Vencimiento',
        desc: 'Asigná siempre la fecha de vencimiento acordada con el proveedor para que el sistema te alerte antes de caer en mora.',
      },
      {
        title: 'Abonos y Pagos Parciales',
        desc: 'El sistema permite registrar múltiples pagos a una misma obligación, manteniendo visible el saldo restante en todo momento.',
      },
      {
        title: 'Caja Abierta Obligatoria para Efectivo',
        desc: 'Si pagás en efectivo en el local, debe seleccionarse una sesión de caja abierta. Así el arqueo del cajero coincidirá al centavo.',
      },
    ],
    formulas: [
      {
        name: 'Saldo Pendiente',
        formula: 'Monto Total de la Obligación - Sumatoria de Pagos Realizados',
        explanation: 'Deuda exigible al día de hoy por el proveedor.',
      },
      {
        name: 'Gasto Devengado',
        formula: 'Obligaciones cuya fecha contable corresponde al período filtrado',
        explanation: 'Afecta la ganancia del mes sin importar cuándo se termine de liquidar.',
      },
    ],
    example: {
      title: 'Ejemplo Práctico: Compra de Repuestos al Por Mayor',
      description: 'Manejo de crédito comercial con entrega inicial',
      rows: [
        ['Carga de Factura', 'Compra lote 20 pantallas a Distribuidora Sur', 'Gs. 3.000.000', 'Estado: Pendiente (Deuda registrada)'],
        ['Anticipo en Efectivo', 'Pago inicial con sesión de caja de turno', 'Gs. 1.000.000', 'Estado: Pago Parcial (Resta de caja)'],
        ['Saldo a 30 Días', 'Vencimiento fijado para el día 25 del mes', 'Gs. 2.000.000', 'Alerta en panel de vencimientos'],
        ['Cancelación Bancaria', 'Transferencia bancaria al vencimiento', 'Gs. 2.000.000', 'Estado: Pagado (Comprobante archivado)'],
      ],
    },
    tips: [
      'Clasificá siempre la categoría adecuada (Alquiler, Servicios, Repuestos, Publicidad) para detectar fugas de dinero en los gráficos.',
      'Si pagás por transferencia o cheque corporativo, utilizá los métodos bancarios para no alterar el arqueo físico del cajero.',
      'Si un gasto fue cargado por error, anúlalo antes de emitir los reportes para revertir los movimientos contables.',
    ],
  },

  nomina: {
    key: 'nomina',
    title: 'Nómina, Salarios y Comisiones',
    subtitle: 'Liquidación Transparente de Técnicos y Vendedores',
    badgeText: 'Pilar 3 • Recursos Humanos',
    objective:
      'Liquidar salarios fijos y comisiones con base en datos reales de ventas y órdenes de trabajo cobradas, garantizando equidad y control del flujo de fondos.',
    keyPoints: [
      {
        title: 'Paso 1: Preparar Corrida',
        desc: 'Seleccioná el período mensual o quincenal. El sistema calcula los salarios base y totaliza las comisiones devengadas según las reglas configuradas.',
      },
      {
        title: 'Paso 2: Revisar con el Colaborador',
        desc: 'Visualizá el detalle de reparaciones y ventas asociadas a cada técnico. Corregí cualquier discrepancia antes de emitir la orden de pago.',
      },
      {
        title: 'Paso 3: Aprobar',
        desc: 'Congela los números del período. La nómina pasa a estado Aprobada y queda registrada como un pasivo laboral firme del negocio.',
      },
      {
        title: 'Paso 4: Pagar y Registrar Salida',
        desc: 'El dinero se descuenta formalmente cuando ejecutás el Pago (efectivo con caja asignada o transferencia bancaria).',
      },
    ],
    formulas: [
      {
        name: 'Total Liquidado',
        formula: 'Salario Base Mensual + Comisiones Devengadas - Anticipos/Descuentos',
        explanation: 'Monto neto a transferir o entregar en sobre al colaborador.',
      },
      {
        name: 'Comisión por Mano de Obra',
        formula: 'Monto Mano de Obra Cobrada × % Comisión Asignada',
        explanation: 'Incentivo directo por reparaciones completadas y cobradas.',
      },
    ],
    example: {
      title: 'Ejemplo Práctico: Liquidación de Técnico Senior',
      description: 'Cálculo de sueldo fijo más variable por productividad',
      rows: [
        ['Sueldo Fijo Base', 'Salario mensual acordado en contrato', 'Gs. 2.800.000', 'Compromiso fijo mensual'],
        ['Mano de Obra Generada', '40 reparaciones entregadas y cobradas', 'Gs. 6.000.000', 'Base para comisión técnica'],
        ['Comisión por Taller (10%)', '10% sobre la mano de obra propia', 'Gs. 600.000', 'Variable por productividad'],
        ['Anticipo Quincenal', 'Vale retirado a mitad de mes', '- Gs. 500.000', 'Descuento aplicado en liquidación'],
        ['Neto a Cobrar', 'Gs. 2.800.000 + Gs. 600.000 - Gs. 500.000', 'Gs. 2.900.000', 'Monto abonado por transferencia'],
      ],
    },
    tips: [
      'Liquida comisiones solo sobre órdenes cobradas (no sobre presupuestos ni órdenes pendientes de retiro).',
      'Configurá los sueldos base al inicio del mes en la pestaña Configuración para evitar cálculos manuales.',
      'Asegurate de que los técnicos conozcan sus metas de comisiones para mantener al equipo motivado y alineado.',
    ],
  },

  rentabilidad: {
    key: 'rentabilidad',
    title: 'Rentabilidad Operativa y Análisis de Márgenes',
    subtitle: 'Control de Costos de Repuestos y Detección de Fugas',
    badgeText: 'Pilar 4 • Rentabilidad y Precios',
    objective:
      'Identificar la rentabilidad real de cada línea de productos y servicios de taller, asegurando precios que superen el costo de reposición y la inflación.',
    keyPoints: [
      {
        title: 'El Semáforo de Rentabilidad',
        desc: 'Verde (>15%): Margen saludable. Ámbar (0% a 15%): Margen ajustado, vulnerable a imprevistos. Rojo (<0%): Operación a pérdida, requiere ajuste urgente de tarifa.',
      },
      {
        title: 'Alerta de Cobertura Incompleta',
        desc: 'Si una orden o venta no tiene registrado el costo del repuesto o insumo, el sistema la marcará. Un costo no cargado infla falsamente la ganancia del negocio.',
      },
      {
        title: 'Mano de Obra vs. Repuesto',
        desc: 'Separar el cobro del repuesto del cobro de la mano de obra permite medir qué porcentaje del ingreso queda realmente en el taller.',
      },
      {
        title: 'Exportación y Auditoría',
        desc: 'El panel permite exportar las operaciones detalladas para auditoría externa o revisión con el contador.',
      },
    ],
    formulas: [
      {
        name: 'Margen Bruto de Servicio',
        formula: '[(Precio Cobrado - Costo del Repuesto) / Precio Cobrado] × 100',
        explanation: 'Rentabilidad porcentual por cada reparación individual.',
      },
      {
        name: 'Markup sobre Repuesto',
        formula: '[(Precio Venta Repuesto - Costo Compra) / Costo Compra] × 100',
        explanation: 'Recargo aplicado al repuesto instalado o vendido en mostrador.',
      },
    ],
    example: {
      title: 'Ejemplo Práctico: Cambio de Pantalla Curva OLED',
      description: 'Estructura de costos de reparación de gama alta',
      rows: [
        ['Precio Total Cobrado', 'Módulo original instalado con garantía', 'Gs. 650.000', 'Ingreso bruto'],
        ['Costo Directo del Módulo', 'Precio de compra al distribuidor', 'Gs. 280.000', 'Costo de mercadería consumida'],
        ['Utilidad Bruta de la Orden', 'Gs. 650.000 - Gs. 280.000', 'Gs. 370.000', 'Margen Bruto: 56.9% (Verde)'],
        ['Comisión al Técnico (10%)', '10% sobre la mano de obra neta (Gs. 370.000)', 'Gs. 37.000', 'Costo variable de personal'],
        ['Margen Neto del Taller', 'Gs. 370.000 - Gs. 37.000', 'Gs. 333.000', 'Contribución a costos fijos y beneficio'],
      ],
    },
    tips: [
      'Exigí a los técnicos que descuenten los repuestos del inventario en cada orden para que el costo se compute en el momento exacto.',
      'Si el margen de un servicio está en color ámbar (<15%), ajustá el precio o negociá mejores precios con tus proveedores de repuestos.',
      'Revisá periódicamente los productos de baja rotación que inmovilizan capital de trabajo.',
    ],
  },

  configuracion: {
    key: 'configuracion',
    title: 'Configuración de Parámetros y Reglas',
    subtitle: 'Sueldos Base, Escalas de Comisiones y Políticas Financieras',
    badgeText: 'Pilar 5 • Políticas del Negocio',
    objective:
      'Definir las bases contractuales y políticas financieras para que las liquidaciones y reportes se generen de manera 100% automática y sin errores.',
    keyPoints: [
      {
        title: 'Sueldos Base por Colaborador',
        desc: 'Establecé el salario fijo mensual de cada empleado. El sistema lo utilizará como base al generar cada corrida de nómina.',
      },
      {
        title: 'Reglas de Comisiones Configurables',
        desc: 'Permite definir comisiones por: a) % sobre mano de obra facturada, b) % sobre repuestos/accesorios vendidos, o c) Monto fijo en Guaraníes por orden concluida.',
      },
      {
        title: 'Ciclo de Vida de las Reglas',
        desc: 'Borrador (en elaboración) -> Aprobada (vigente y activa para liquidaciones) -> Retirada (histórica, no aplica a nuevas corridas pero preserva auditoría).',
      },
      {
        title: 'Alineación con Metas del Local',
        desc: 'Ajustar las comisiones incentiva a los técnicos a resolver reparaciones complejas con rapidez y a los vendedores a colocar accesorios de alto margen.',
      },
    ],
    formulas: [
      {
        name: 'Regla Porcentual',
        formula: 'Base Imponible × (Porcentaje / 100)',
        explanation: 'Cálculo para comisiones variables vinculadas al volumen facturado.',
      },
      {
        name: 'Regla Fija por Trabajo',
        formula: 'Cantidad de Trabajos Calificados × Monto Fijo en Gs.',
        explanation: 'Incentivo fijo por tipo de servicio (ej: Gs. 20.000 por cambio de pin de carga).',
      },
    ],
    example: {
      title: 'Ejemplo Práctico: Esquema de Incentivos del Negocio',
      description: 'Combinación de salario base y metas escalonadas',
      rows: [
        ['Técnico Tallerista', 'Salario Base: Gs. 2.800.000', '12% Mano de Obra', 'Estado: Regla Aprobada'],
        ['Vendedor Mostrador', 'Salario Base: Gs. 2.500.000', '3% Ventas Accesorios', 'Estado: Regla Aprobada'],
        ['Premio Especial Pantallas', 'Monto Fijo: Gs. 15.000 por módulo', 'Por equipo terminado', 'Estado: Regla Aprobada'],
        ['Regla Antigua Promoción', 'Comisión fija de verano 2025', 'Gs. 10.000 fija', 'Estado: Retirada (Histórico)'],
      ],
    },
    tips: [
      'Al modificar el salario o la comisión de un colaborador, hacelo antes de iniciar la corrida de nómina del nuevo mes.',
      'Nunca borres una regla que ya fue utilizada en períodos anteriores; utiliza el estado "Retirada" para salvaguardar el historial contable.',
    ],
  },

  tips: {
    key: 'tips',
    title: 'Tips de Oro y Solución de Errores Frecuentes',
    subtitle: 'Buenas Prácticas de Control Interno y Solución de Inconvenientes',
    badgeText: 'Pilar 6 • Control Interno',
    objective:
      'Blindar el negocio contra fugas de efectivo, descalces de liquidez y errores operativos habituales en el comercio minorista y talleres.',
    keyPoints: [
      {
        title: '1. El Efectivo Manda: Arqueo Ciego Diario',
        desc: 'El cajero debe declarar el dinero contado sin ver el sistema. Solo el administrador o dueño verifica sobrantes o faltantes.',
      },
      {
        title: '2. Nunca Entregar sin Cobrar o Registrar Saldo',
        desc: 'Si un cliente retira un equipo a crédito, debe registrarse como cuenta por cobrar con fecha de vencimiento clara.',
      },
      {
        title: '3. Repuesto Usado = Repuesto Descontado',
        desc: 'Cada componente instalado debe ser descontado de la orden de trabajo para imputar el costo y mantener el inventario al día.',
      },
      {
        title: '4. Ganancia Neta no es Dinero en Mano',
        desc: 'Si ganaste Gs. 15.000.000 pero solo tenés Gs. 4.000.000 en el banco, el resto está en repuestos guardados o en cuotas por cobrar.',
      },
      {
        title: '5. Separar Caja del Negocio del Bolsillo Personal',
        desc: 'Los retiros del dueño deben registrarse como retiros de utilidades o sueldo, nunca como egresos imprevistos de caja chica.',
      },
    ],
    tips: [
      'Problema: "No puedo registrar un pago de gasto en efectivo" -> Solución: Abrí la sesión de caja del día o seleccioná transferencia bancaria.',
      'Problema: "Aprobé la nómina pero el dinero no se descontó" -> Solución: Aprobar solo reconoce la deuda. Para descontar el dinero, hacé clic en "Pagar".',
      'Problema: "Venta con ganancia 100% que parece falsa" -> Solución: La orden no tiene costo de repuesto cargado. Editá y asigná el costo real.',
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN A PDF PROFESIONAL (jsPDF + autoTable)
// ─────────────────────────────────────────────────────────────────────────────

export type GuideContentType = 'all' | 'manual' | 'examples'

export interface ExportGuidePdfOptions {
  sectionKey?: string
  allSections?: boolean
  companyName?: string
  contentType?: GuideContentType
}

export async function exportFinanceGuideToPdf({
  sectionKey,
  allSections = true,
  companyName = '4G Sistema de Gestión',
  contentType = 'all',
}: ExportGuidePdfOptions): Promise<void> {
  const [jsPdfModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const JsPdfClass: any = (jsPdfModule as any).jsPDF || (jsPdfModule as any).default || jsPdfModule
  const autoTable: any = (autoTableModule as any).default || autoTableModule

  const doc = new JsPdfClass({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const contentWidth = pageWidth - margin * 2

  const sectionsToExport: GuideSectionData[] = allSections || !sectionKey
    ? Object.values(FINANCE_GUIDE_DATA)
    : [FINANCE_GUIDE_DATA[sectionKey] || FINANCE_GUIDE_DATA.resumen]

  const todayStr = new Date().toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const subtitleBanner =
    contentType === 'manual'
      ? 'MANUAL DE PROCEDIMIENTOS Y RUTINAS OPERATIVAS'
      : contentType === 'examples'
      ? 'CUADERNO DE CASOS PRÁCTICOS Y EJEMPLOS EN GUARANÍES (Gs.)'
      : 'MANUAL DE ADMINISTRACIÓN FINANCIERA • CONTROL DEL NEGOCIO'

  // Recorrer cada sección en una o dos páginas organizadas
  sectionsToExport.forEach((section, index) => {
    if (index > 0) {
      doc.addPage()
    }

    let y = 30

    // Banner de Encabezado Superior con estilo corporativo
    doc.setFillColor(15, 23, 42) // Slate 900
    doc.roundedRect(margin, y, contentWidth, 54, 4, 4, 'F')

    // Barra de acento con gradiente simulado
    doc.setFillColor(79, 70, 229) // Indigo 600
    doc.rect(margin, y, contentWidth * 0.6, 3, 'F')
    doc.setFillColor(16, 185, 129) // Emerald 500
    doc.rect(margin + contentWidth * 0.6, y, contentWidth * 0.4, 3, 'F')

    // Título principal en Banner
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(companyName.toUpperCase(), margin + 14, y + 22)

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(203, 213, 225)
    doc.text(subtitleBanner, margin + 14, y + 38)

    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(`Fecha: ${todayStr}`, pageWidth - margin - 14, y + 22, { align: 'right' })
    doc.text(
      contentType === 'manual'
        ? 'Manual de Normas y Rutinas'
        : contentType === 'examples'
        ? 'Casos Reales en Gs.'
        : 'Confidencial / Uso Interno',
      pageWidth - margin - 14,
      y + 38,
      { align: 'right' }
    )

    y += 68

    // Título de la Sección con Pill / Badge
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(margin, y, contentWidth, 38, 4, 4, 'F')

    doc.setFillColor(
      contentType === 'examples' ? 16 : 79,
      contentType === 'examples' ? 185 : 70,
      contentType === 'examples' ? 129 : 229
    )
    doc.roundedRect(margin + 10, y + 9, 8, 20, 2, 2, 'F')

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(section.title, margin + 26, y + 20)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 116, 139)
    const extraLabel =
      contentType === 'manual'
        ? ' • Procedimientos y Rutinas de Control'
        : contentType === 'examples'
        ? ' • Cuaderno de Casos y Cálculos en Gs.'
        : ''
    doc.text(`${section.subtitle}${extraLabel}`, margin + 26, y + 32)

    y += 48

    // Caja de Objetivo
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.8)
    doc.roundedRect(margin, y, contentWidth, 32, 4, 4, 'FD')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(79, 70, 229)
    doc.text('OBJETIVO:', margin + 10, y + 15)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    const objLines = doc.splitTextToSize(section.objective, contentWidth - 85)
    doc.text(objLines, margin + 65, y + 15)

    y += 42

    // Tabla de Puntos Clave / Metodología (solo para manual o todo)
    if (contentType !== 'examples') {
      const keyPointRows = section.keyPoints.map((kp) => [kp.title, kp.desc])
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Metodología / Aspecto', 'Instrucción Operativa y Control Interno']],
        body: keyPointRows,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          cellPadding: 5,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59],
          cellPadding: 5,
          lineColor: [226, 232, 240],
        },
        columnStyles: {
          0: { cellWidth: 140, fontStyle: 'bold', textColor: [15, 23, 42] },
          1: { cellWidth: contentWidth - 140 },
        },
      })

      y = ((doc as any).lastAutoTable?.finalY ?? y + 100) + 14
    }

    // Fórmulas si están disponibles
    if (section.formulas && section.formulas.length > 0) {
      if (y > pageHeight - 160) {
        doc.addPage()
        y = 40
      }

      const formulaRows = section.formulas.map((f) => [f.name, f.formula, f.explanation])
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Concepto / Indicador', 'Fórmula de Cálculo', 'Interpretación para el Negocio']],
        body: formulaRows,
        theme: 'striped',
        headStyles: {
          fillColor: [16, 185, 129], // Emerald 500
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          cellPadding: 4,
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
          cellPadding: 4,
        },
        columnStyles: {
          0: { cellWidth: 100, fontStyle: 'bold' },
          1: { cellWidth: 190, fontStyle: 'bold', textColor: [5, 150, 105] },
          2: { cellWidth: contentWidth - 290 },
        },
      })

      y = ((doc as any).lastAutoTable?.finalY ?? y + 80) + 14
    }

    // Ejemplo Práctico en Guaraníes (solo para ejemplos o todo)
    if (section.example && contentType !== 'manual') {
      if (y > pageHeight - 170) {
        doc.addPage()
        y = 40
      }

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [
          [
            `CASO PRÁCTICO EN GUARANÍES: ${section.example.title}`,
            '',
            '',
            '',
          ],
          ['Concepto / Etapa', 'Detalle Operativo', 'Monto / Operación (Gs.)', 'Impacto Contable / Caja'],
        ],
        body: section.example.rows,
        theme: 'grid',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          cellPadding: 4,
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: 4,
          lineColor: [226, 232, 240],
        },
        columnStyles: {
          0: { cellWidth: 110, fontStyle: 'bold' },
          1: { cellWidth: 180 },
          2: { cellWidth: 110, fontStyle: 'bold', halign: 'right', textColor: [30, 41, 59] },
          3: { cellWidth: contentWidth - 400, textColor: [79, 70, 229] },
        },
      })

      y = ((doc as any).lastAutoTable?.finalY ?? y + 80) + 12
    }

    // Tips de Oro al pie (solo para manual o todo)
    if (section.tips && section.tips.length > 0 && contentType !== 'examples') {
      if (y > pageHeight - 100) {
        doc.addPage()
        y = 40
      }

      doc.setFillColor(254, 243, 199) // Amber 100
      doc.setDrawColor(245, 158, 11) // Amber 500
      doc.setLineWidth(1)
      const tipBoxHeight = Math.min(65, section.tips.length * 15 + 14)
      doc.roundedRect(margin, y, contentWidth, tipBoxHeight, 4, 4, 'FD')

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(180, 83, 9)
      doc.text('★ TIPS DE ORO Y REGLAS DE CONTROL INTERNO:', margin + 10, y + 12)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(120, 53, 15)

      section.tips.slice(0, 3).forEach((tip, tIdx) => {
        const lines = doc.splitTextToSize(`• ${tip}`, contentWidth - 24)
        doc.text(lines[0], margin + 12, y + 25 + tIdx * 12)
      })
    }
  })

  // Numeración y pie de página en todo el documento
  const totalPages = (doc.internal as any).getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22)

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    const footerDocName =
      contentType === 'manual'
        ? 'Manual de Normas y Procedimientos • 4G Soluciones'
        : contentType === 'examples'
        ? 'Cuaderno de Casos Prácticos en Gs. • 4G Soluciones'
        : 'Manual de Administración y Control Financiero • 4G Soluciones'
    doc.text(footerDocName, margin, pageHeight - 12)
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: 'right' })
  }

  const fileName =
    contentType === 'manual'
      ? (allSections || !sectionKey ? 'Manual_Procedimientos_Finanzas_4G.pdf' : `Manual_Procedimientos_${sectionKey}_4G.pdf`)
      : contentType === 'examples'
      ? (allSections || !sectionKey ? 'Casos_Practicos_Finanzas_4G.pdf' : `Casos_Practicos_${sectionKey}_4G.pdf`)
      : (allSections || !sectionKey ? 'Manual_Administracion_Financiera_4G.pdf' : `Guia_Finanzas_${sectionKey}_4G.pdf`)

  doc.save(fileName)
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN A FORMATO MARKDOWN (.md)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportGuideMarkdownOptions {
  sectionKey?: string
  allSections?: boolean
  companyName?: string
  contentType?: GuideContentType
}

export function exportFinanceGuideToMarkdown({
  sectionKey,
  allSections = true,
  companyName = '4G Sistema de Gestión',
  contentType = 'all',
}: ExportGuideMarkdownOptions): void {
  const sectionsToExport: GuideSectionData[] = allSections || !sectionKey
    ? Object.values(FINANCE_GUIDE_DATA)
    : [FINANCE_GUIDE_DATA[sectionKey] || FINANCE_GUIDE_DATA.resumen]

  const todayStr = new Date().toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const docHeaderTitle =
    contentType === 'manual'
      ? 'Manual de Normas y Procedimientos de Gestión'
      : contentType === 'examples'
      ? 'Cuaderno de Casos Prácticos y Cálculos Reales (Gs.)'
      : 'Manual Práctico de Administración Financiera y Gestión del Negocio'

  let md = `# ${companyName}\n`
  md += `## ${docHeaderTitle}\n\n`
  md += `> **Fecha de Emisión:** ${todayStr} | **Moneda:** Guaraníes (Gs.) | **Tipo de Documento:** ${
    contentType === 'manual' ? 'Manual y Normativa' : contentType === 'examples' ? 'Casos y Números Reales' : 'Compendio Integral'
  }\n\n`
  md += `Este documento proporciona las directivas y análisis necesarios para operar con total solvencia contable y control de caja en el comercio.\n\n`
  md += `---\n\n`

  sectionsToExport.forEach((sec, idx) => {
    md += `## ${idx + 1}. ${sec.title}\n\n`
    md += `*${sec.subtitle}*\n\n`
    md += `**Objetivo:** ${sec.objective}\n\n`

    if (contentType !== 'examples') {
      md += `### Metodología y Control Interno\n\n`
      sec.keyPoints.forEach((kp) => {
        md += `- **${kp.title}:** ${kp.desc}\n`
      })
      md += `\n`
    }

    if (sec.formulas && sec.formulas.length > 0) {
      md += `### Fórmulas e Indicadores Clave\n\n`
      md += `| Indicador | Fórmula de Cálculo | Interpretación de Negocio |\n`
      md += `|---|---|---|\n`
      sec.formulas.forEach((f) => {
        md += `| **${f.name}** | \`${f.formula}\` | ${f.explanation} |\n`
      })
      md += `\n`
    }

    if (sec.example && contentType !== 'manual') {
      md += `### Caso Práctico en Guaraníes (Gs.): ${sec.example.title}\n\n`
      md += `*${sec.example.description}*\n\n`
      md += `| Concepto / Etapa | Detalle Operativo | Monto (Gs.) | Impacto Contable / Caja |\n`
      md += `|---|---|---|---|\n`
      sec.example.rows.forEach((r) => {
        md += `| ${r[0]} | ${r[1]} | **${r[2]}** | ${r[3]} |\n`
      })
      md += `\n`
    }

    if (sec.tips && sec.tips.length > 0 && contentType !== 'examples') {
      md += `### Tips de Oro y Errores a Evitar\n\n`
      sec.tips.forEach((t) => {
        md += `- ⭐ ${t}\n`
      })
      md += `\n`
    }

    md += `---\n\n`
  })

  // Descargar archivo .md en el navegador
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download =
    contentType === 'manual'
      ? (allSections || !sectionKey ? 'Manual_Procedimientos_Finanzas_4G.md' : `Manual_Procedimientos_${sectionKey}_4G.md`)
      : contentType === 'examples'
      ? (allSections || !sectionKey ? 'Casos_Practicos_Finanzas_4G.md' : `Casos_Practicos_${sectionKey}_4G.md`)
      : (allSections || !sectionKey ? 'Manual_Administracion_Financiera_4G.md' : `Guia_Finanzas_${sectionKey}_4G.md`)

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPRESIÓN Y VISTA PREVIA DIRECTA (HTML Print)
// ─────────────────────────────────────────────────────────────────────────────

export interface PrintGuideOptions {
  sectionKey?: string
  allSections?: boolean
  companyName?: string
  contentType?: GuideContentType
}

export function printFinanceGuide({
  sectionKey,
  allSections = true,
  companyName = '4G Sistema de Gestión',
  contentType = 'all',
}: PrintGuideOptions): void {
  const sectionsToExport: GuideSectionData[] = allSections || !sectionKey
    ? Object.values(FINANCE_GUIDE_DATA)
    : [FINANCE_GUIDE_DATA[sectionKey] || FINANCE_GUIDE_DATA.resumen]

  const todayStr = new Date().toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const printTitle =
    contentType === 'manual'
      ? 'Manual de Normas y Procedimientos'
      : contentType === 'examples'
      ? 'Cuaderno de Casos Prácticos y Ejemplos (Gs.)'
      : 'Manual de Administración Financiera'

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Manual de Administración Financiera - ${companyName}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 12mm 15mm 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11pt;
      margin: 0;
      padding: 20px;
    }
    .header-banner {
      background: #0f172a;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 4px solid #4f46e5;
    }
    .header-title {
      font-size: 16pt;
      font-weight: 700;
      margin: 0;
    }
    .header-sub {
      font-size: 9pt;
      color: #cbd5e1;
      margin-top: 4px;
    }
    .section-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .section-header {
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 14pt;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }
    .section-subtitle {
      font-size: 9.5pt;
      color: #64748b;
      margin: 3px 0 0 0;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
      background: #e0e7ff;
      color: #3730a3;
      margin-bottom: 6px;
    }
    .objective-box {
      background: #f8fafc;
      border-left: 3px solid #4f46e5;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      font-size: 9.5pt;
      margin: 12px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 9pt;
    }
    th {
      background: #1e293b;
      color: white;
      text-align: left;
      padding: 7px 10px;
      font-weight: 600;
    }
    td {
      border-bottom: 1px solid #e2e8f0;
      padding: 6px 10px;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .formula-table th {
      background: #059669;
    }
    .example-table th {
      background: #4f46e5;
    }
    .tips-box {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 14px;
      border-radius: 6px;
      margin-top: 14px;
    }
    .tips-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #b45309;
      margin: 0 0 6px 0;
    }
    .footer {
      text-align: center;
      font-size: 8.5pt;
      color: #94a3b8;
      margin-top: 20px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <div>
      <div class="header-title">${companyName}</div>
      <div class="header-sub">${printTitle.toUpperCase()} • DOCUMENTO OFICIAL</div>
    </div>
    <div style="text-align: right; font-size: 8.5pt; color: #cbd5e1;">
      <div>Fecha: ${todayStr}</div>
      <div>Moneda: Guaraníes (Gs.)</div>
    </div>
  </div>

  ${sectionsToExport
    .map(
      (sec) => `
    <div class="section-card">
      <div class="section-header">
        <span class="badge">${sec.badgeText}</span>
        <h2 class="section-title">${sec.title}</h2>
        <p class="section-subtitle">${sec.subtitle}</p>
      </div>

      <div class="objective-box">
        <strong>Objetivo de Gestión:</strong> ${sec.objective}
      </div>

      ${
        contentType !== 'examples'
          ? `
      <h3 style="font-size: 10pt; font-weight: 700; margin: 12px 0 6px 0;">Metodología y Controles Internos:</h3>
      <ul>
        ${sec.keyPoints.map((kp) => `<li><strong>${kp.title}:</strong> ${kp.desc}</li>`).join('')}
      </ul>
      `
          : ''
      }

      ${
        sec.formulas && sec.formulas.length > 0
          ? `
        <h3 style="font-size: 10pt; font-weight: 700; margin: 14px 0 6px 0;">Fórmulas e Indicadores:</h3>
        <table class="formula-table">
          <thead>
            <tr>
              <th>Indicador</th>
              <th>Fórmula</th>
              <th>Interpretación</th>
            </tr>
          </thead>
          <tbody>
            ${sec.formulas
              .map(
                (f) => `
              <tr>
                <td><strong>${f.name}</strong></td>
                <td><code>${f.formula}</code></td>
                <td>${f.explanation}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
          : ''
      }

      ${
        sec.example && contentType !== 'manual'
          ? `
        <h3 style="font-size: 10pt; font-weight: 700; margin: 14px 0 6px 0;">Caso Práctico (Gs.): ${sec.example.title}</h3>
        <p style="font-size: 8.5pt; color: #64748b; margin: 0 0 6px 0;">${sec.example.description}</p>
        <table class="example-table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Detalle</th>
              <th style="text-align: right;">Monto (Gs.)</th>
              <th>Impacto</th>
            </tr>
          </thead>
          <tbody>
            ${sec.example.rows
              .map(
                (r) => `
              <tr>
                <td><strong>${r[0]}</strong></td>
                <td>${r[1]}</td>
                <td style="text-align: right; font-weight: 700;">${r[2]}</td>
                <td>${r[3]}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
          : ''
      }

      ${
        sec.tips && sec.tips.length > 0 && contentType !== 'examples'
          ? `
      <div class="tips-box">
        <div class="tips-title">★ REGLAS DE ORO Y BUENAS PRÁCTICAS</div>
        <ul style="margin: 0; padding-left: 18px; font-size: 8.5pt; color: #92400e;">
          ${sec.tips.map((t) => `<li>${t}</li>`).join('')}
        </ul>
      </div>
      `
          : ''
      }
    </div>
  `
    )
    .join('')}

  <div class="footer">
    4G Sistema de Gestión Empresarial • Documento de Control Interno • Impreso el ${todayStr}
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 250);
    });
  </script>
</body>
</html>
  `

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  }
}
