'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Wrench,
  ShoppingCart,
  Boxes,
  Users,
  Building2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Smartphone,
  TrendingUp,
  Receipt,
  Gift,
  Search,
  MessageCircle,
  Laptop,
  Coins,
  AlertTriangle,
  FileCheck2,
  Store,
  ChevronDown,
  Hammer,
  ShoppingBag,
  Tv,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ─── Helpers de animación ────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, delay },
})

// ─── Tipos de Negocios que se benefician del SaaS ───────────────────────────
const supportedBusinesses = [
  {
    icon: Wrench,
    title: 'Talleres de Reparación',
    description: 'Celulares, notebooks, consolas y electrodomésticos con órdenes de servicio, fotos y QR de seguimiento.',
    badge: 'Técnico & Postventa',
  },
  {
    icon: Smartphone,
    title: 'Tecnología y Electrónica',
    description: 'Venta de accesorios, cargadores, gadgets y periféricos con control por códigos de barras e IMEI.',
    badge: 'Retail Tecnológico',
  },
  {
    icon: Hammer,
    title: 'Ferreterías y Repuesteras',
    description: 'Inventario de repuestos y herramientas con variantes de medidas, marcas y stock mínimo con reposición.',
    badge: 'Insumos & Repuestos',
  },
  {
    icon: ShoppingBag,
    title: 'Tiendas Minoristas y Bazares',
    description: 'Punto de venta ágil (POS), cobros multimoneda, tickets térmicos y programa de puntos acumulativos.',
    badge: 'Comercio General',
  },
  {
    icon: Store,
    title: 'Negocios con Venta Online',
    description: 'Catálogo web público sincronizado en tiempo real con el stock físico de tus sucursales y pedidos por WhatsApp.',
    badge: 'Omnicanal',
  },
  {
    icon: Building2,
    title: 'Cadenas y Multirubro',
    description: 'Empresas con múltiples sucursales, traspaso de mercadería entre depósitos y cierres de caja independientes.',
    badge: 'Multi-Sucursal',
  },
]

// ─── Matriz de Problemas vs. Soluciones ──────────────────────────────────────
const problemsVsSolutions = [
  {
    category: 'Taller Técnico y Órdenes de Servicio',
    icon: Wrench,
    problem: 'Boletas de papel que se pierden, clientes llamando constantemente para preguntar si su equipo está listo y sin registro de repuestos utilizados.',
    solution: 'Tickets con número y QR de seguimiento web en tiempo real, validación segura por teléfono/email, fotos de ingreso, avisos por WhatsApp y control exacto de repuestos.',
    badge: 'Taller Ordenado',
    color: 'border-amber-500/30 bg-amber-500/5 text-amber-500',
  },
  {
    category: 'Punto de Venta y Fugas de Caja',
    icon: ShoppingCart,
    problem: 'Al final del día la plata no coincide con las notas, adelantos de reparaciones que nadie anotó y descontrol entre efectivo, QR y tarjetas.',
    solution: 'Turnos de caja con saldo inicial, arqueo ciego obligatorio, cobros mixtos y registro automático de adelantos y saldos pendientes vinculados a la orden.',
    badge: 'Caja Blindada',
    color: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-500',
  },
  {
    category: 'Inventario y Repuestos Fantasma',
    icon: Boxes,
    problem: 'No saber si queda stock de un repuesto, piezas que desaparecen sin justificación o tener que llamar a otra sucursal para consultar existencias.',
    solution: 'Inventario multialmacén en tiempo real, alertas de stock bajo, códigos de barra, trazabilidad total y separación clara entre productos para venta y repuestos.',
    badge: 'Stock Exacto',
    color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500',
  },
  {
    category: 'Clientes Duplicados y Desconectados',
    icon: Users,
    problem: 'La misma persona registrada tres veces (por taller, por mostrador y por teléfono), dividiendo sus garantías, deudas y compras en fichas distintas.',
    solution: 'Verificación inteligente en tiempo real por teléfono y RUC/C.I. con autoselección en 1 clic. Historial unificado, límite de crédito y programa de puntos.',
    badge: 'Ficha Unificada',
    color: 'border-violet-500/30 bg-violet-500/5 text-violet-500',
  },
  {
    category: 'Márgenes de Ganancia Inciertos',
    icon: TrendingUp,
    problem: 'Facturar mucho pero no saber si realmente estás ganando dinero tras descontar costo de repuestos, mano de obra e insumos de reparación.',
    solution: 'Editor de costos en vivo con semáforo de margen por orden: cálculo automático de beneficio neto en Guaraníes antes de entregar el equipo reparado.',
    badge: 'Rentabilidad Clara',
    color: 'border-rose-500/30 bg-rose-500/5 text-rose-500',
  },
  {
    category: 'Tienda Online Desincronizada',
    icon: Store,
    problem: 'Pagar otra plataforma web donde tenés que actualizar precios a mano y vender productos en la web que ya se habían vendido en el local.',
    solution: 'Catálogo público integrado con tu inventario físico: lo que se vende en mostrador se descuenta inmediatamente de tu catálogo online y pedidos por WhatsApp.',
    badge: 'Omnicanal Real',
    color: 'border-blue-500/30 bg-blue-500/5 text-blue-500',
  },
]

// ─── Pilares de la Solución ──────────────────────────────────────────────────
const solutionPillars = [
  {
    id: 'taller',
    title: '1. Sistema Integral para Taller Técnico',
    subtitle: 'El corazón de tu servicio técnico, organizado de punta a punta',
    description: 'Diseñado pensando en el día a día de técnicos y recepcionistas. Registrá equipos con fotos, contraseña, falla declarada y accesorios.',
    icon: Wrench,
    color: 'from-amber-500/20 to-orange-500/20 text-amber-500 border-amber-500/30',
    features: [
      'Estados en vivo: Recibido, Diagnóstico, Esperando Repuesto, Reparado, Entregado.',
      'Portal web público (/mis-reparaciones): El cliente consulta con su número de ticket y teléfono registrado o escaneando su comprobante QR.',
      'Teléfono alternativo de aviso con parentesco (ideal si el equipo reparado es su celular).',
      'Plantillas de WhatsApp en 1 clic para presupuestos, confirmaciones y avisos de retiro.',
      'Control de garantías con vencimiento automático y bloqueo de reclamos fuera de plazo.',
    ],
  },
  {
    id: 'caja-pos',
    title: '2. Punto de Venta (POS) y Caja Blindada',
    subtitle: 'Cobros rápidos sin diferencias de dinero',
    description: 'Tu mostrador necesita velocidad y seguridad. Cobrá con código de barras, gestioná adelantos de reparación y controlá tu caja en turnos.',
    icon: ShoppingCart,
    color: 'from-cyan-500/20 to-blue-500/20 text-cyan-500 border-cyan-500/30',
    features: [
      'Cobro multidivisa y multimétodo: Efectivo (Gs.), Tarjetas, Transferencia QR y Saldo.',
      'Arqueo ciego de caja: El cajero cuenta sin ver el total del sistema para evitar ajustes falsos.',
      'Comprobantes térmicos imprimibles y tickets digitales listos para enviar por WhatsApp.',
      'Cuentas corrientes: Asigná límite de crédito y controlá cuotas y deudas pendientes.',
      'Adelantos de reparación integrados directamente al turno de caja activo.',
    ],
  },
  {
    id: 'inventario',
    title: '3. Inventario Inteligente y Multirubro',
    subtitle: 'Cada producto y repuesto exactamente donde tiene que estar',
    description: 'Organizá repuestos para taller y productos de venta directa con soporte para variantes (color, memoria, modelo) y control multidepósito.',
    icon: Boxes,
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-500 border-emerald-500/30',
    features: [
      'Stock centralizado y por sucursal con alertas automáticas de reposición.',
      'Consumo automático: El repuesto cargado a una orden se descuenta del inventario al instante.',
      'Transferencias seguras entre depósitos o locales comerciales.',
      'Compatibilidad total con lectores de códigos de barras USB y Bluetooth.',
      'Historial completo de auditoría: quién modificó, ingresó o dio de baja cada ítem.',
    ],
  },
  {
    id: 'fidelizacion',
    title: '4. Fidelización de Clientes, Puntos y Sorteos',
    subtitle: 'Hacé que tus clientes vuelvan siempre a tu negocio',
    description: 'Dejá de competir solo por precio. Premiá a quienes eligen tu taller y tu tienda con un programa de fidelidad automático y divertido.',
    icon: Gift,
    color: 'from-violet-500/20 to-purple-500/20 text-violet-500 border-violet-500/30',
    features: [
      'Acumulación automática de puntos tanto por compras en POS como por reparaciones pagadas.',
      'Canje de puntos por descuentos en servicios técnicos o productos.',
      'Módulo de sorteos transparentes con cupones automáticos para generar engagement en redes.',
      'Detección instantánea de clientes por teléfono o RUC/CI para no duplicar historiales.',
      'Historial 360° del cliente: compras, órdenes, garantías, pagos y saldo acumulado.',
    ],
  },
  {
    id: 'finanzas',
    title: '5. Finanzas Claras y Márgenes en Tiempo Real',
    subtitle: 'Conocé la rentabilidad exacta de tu operación en Guaraníes',
    description: 'Tomá decisiones con datos reales. Nuestro sistema desglosa los costos de insumos, mano de obra y repuestos para que siempre ganes dinero.',
    icon: TrendingUp,
    color: 'from-rose-500/20 to-pink-500/20 text-rose-500 border-rose-500/30',
    features: [
      'Semáforo financiero por reparación: sabé en segundos si tu margen es saludable (verde), ajustado (ámbar) o a pérdida (rojo).',
      'Reportes de facturación diaria, semanal y mensual por sucursal o técnico.',
      'Desglose transparente: Mano de Obra vs. Costo Repuestos vs. Ganancia Neta.',
      'Reglas de flujo de caja para asegurar reposición de repuestos sin descapitalizarte.',
      'Exportación de balances y métricas clave para tu contador o gestión interna.',
    ],
  },
]

// ─── Preguntas frecuentes sobre las soluciones ──────────────────────────────
const faqs = [
  {
    q: '¿Qué soluciona principalmente este sistema frente a un Excel o cuadernos?',
    a: 'Elimina las órdenes extraviadas, el stock que no coincide, las fugas de dinero en caja y las llamadas constantes de clientes. Al estar todo conectado en la nube, el técnico carga un repuesto, la caja lo cobra, el inventario lo descuenta y el cliente puede ver el estado desde su celular.',
  },
  {
    q: '¿Mis clientes pueden consultar el estado de su equipo por su cuenta?',
    a: 'Sí. Al registrar un equipo, el sistema genera una orden con su número de ticket único y un código QR en el comprobante. Tu cliente puede ingresar al enlace público (/mis-reparaciones) introduciendo su número de ticket junto a su teléfono o email registrado, o escanear directamente el QR desde su celular para ver en tiempo real si su equipo está en revisión, el presupuesto o si ya está listo para retirar, reduciendo drásticamente las llamadas y mensajes preguntando lo mismo.',
  },
  {
    q: '¿Cómo evita el sistema que un cliente quede duplicado en el sistema?',
    a: 'Al escribir el teléfono o RUC/C.I. en el formulario de alta, el sistema busca en tiempo real en la base de datos. Si el cliente ya existe, muestra una tarjeta destacada con sus datos y un botón para seleccionarlo directamente para la reparación, manteniendo su historial, garantías y puntos unificados.',
  },
  {
    q: '¿El sistema sirve para otros tipos de negocios además de talleres de reparación?',
    a: 'Totalmente. El sistema fue construido sobre una arquitectura modular. Funciona de manera sobresaliente en tiendas de tecnología y accesorios, ferreterías, casas de repuestos, bazares y comercios minoristas en general. Podés utilizar únicamente el Punto de Venta (POS), la gestión de inventario multidepósito con variantes y códigos de barras, el arqueo de cajas ciegas y la fidelización con puntos y sorteos, sin necesidad de activar el módulo de reparaciones si tu negocio no lo requiere.',
  },
  {
    q: '¿Puedo usar el sistema si solo tengo venta de repuestos y accesorios sin taller?',
    a: '¡Por supuesto! El sistema es modular. Podés utilizar exclusivamente el Punto de Venta (POS), control de caja e inventario multialmacén, o activar el módulo de taller técnico cuando lo necesites.',
  },
  {
    q: '¿Qué pasa si tengo más de una sucursal o taller?',
    a: 'El sistema soporta múltiples sucursales bajo una misma empresa. Podés consultar el stock de cada local, transferir repuestos entre sucursales y ver reportes consolidados o individuales de cada caja.',
  },
  {
    q: '¿Mis empleados tienen acceso a los costos y ganancias del negocio?',
    a: 'No, a menos que vos lo autorices. El sistema cuenta con roles granulares: el técnico solo ve sus órdenes de reparación, el cajero solo su turno de venta, y solo los administradores o dueños tienen acceso a la rentabilidad, reportes financieros y configuración de precios.',
  },
]

export function SaaSSolutionsPageContent() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="overflow-hidden">
      {/* ── HERO SECTION ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white py-16 sm:py-24">
        {/* Glow de fondo */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(6,182,212,0.18),transparent)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            {...fadeUp(0)}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-600/30 bg-cyan-100/70 dark:border-cyan-500/40 dark:bg-cyan-950/40 px-4 py-1.5 text-xs font-semibold text-cyan-800 dark:text-cyan-300 shadow-xs backdrop-blur-md"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Soluciones Reales para Negocios y Comercios</span>
          </motion.div>

          <motion.h1
            {...fadeUp(0.1)}
            className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl max-w-4xl mx-auto leading-tight text-slate-950 dark:text-white"
          >
            Eliminamos el desorden en tu{' '}
            <span className="bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 dark:from-cyan-400 dark:via-teal-300 dark:to-blue-500 bg-clip-text text-transparent">
              taller, tienda y mostrador
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.2)}
            className="mt-6 text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 max-w-3xl mx-auto"
          >
            Diseñado tanto para <strong>talleres de reparación</strong> como para <strong>tiendas de tecnología, venta de repuestos, ferreterías, bazares y comercios minoristas</strong>. Dejá atrás los cuadernos, el stock desfasado y las cajas descontroladas con una plataforma modular adaptada a tu rubro.
          </motion.p>

          <motion.div
            {...fadeUp(0.3)}
            className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
          >
            <Button
              asChild
              size="lg"
              className="h-12 px-7 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 dark:from-cyan-500 dark:to-blue-600 dark:hover:from-cyan-400 dark:hover:to-blue-500 text-white dark:text-slate-950 font-bold shadow-lg shadow-cyan-600/20 dark:shadow-cyan-500/25 rounded-xl text-sm"
            >
              <Link href="/register">
                Empezar Prueba Gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 px-6 border-slate-300 bg-white hover:bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-800 dark:text-slate-200 font-semibold rounded-xl text-sm"
            >
              <Link href="/saas/planes">
                Ver Planes y Precios
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── SECCIÓN RUBROS Y TIPOS DE NEGOCIOS ADMITIDOS ──────────────────── */}
      <section className="py-14 sm:py-20 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="outline" className="text-xs font-bold text-teal-700 dark:text-teal-400 border-teal-600/30 dark:border-teal-500/30 px-3 py-1 bg-teal-50 dark:bg-teal-950/30">
              Versatilidad Multirubro
            </Badge>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Un sistema que se adapta a tu modelo comercial
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              No estás atado a un solo formato: podés usar solo el punto de venta con control de stock, habilitar la recepción técnica o gestionar múltiples sucursales a la vez.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {supportedBusinesses.map((biz, idx) => {
              const BizIcon = biz.icon
              return (
                <motion.div
                  key={idx}
                  {...fadeUp(idx * 0.07)}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/60 p-5 sm:p-6 transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-950/90 flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
                        <BizIcon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="text-[10px] font-semibold border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300">
                        {biz.badge}
                      </Badge>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                      {biz.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {biz.description}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN ANTES VS AHORA (PROBLEMAS QUE SOLUCIONAMOS) ──────────── */}
      <section className="py-16 sm:py-24 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="outline" className="text-xs font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/30 px-3 py-1">
              Transformación Operativa
            </Badge>
            <h2 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              ¿Qué cambia al implementar nuestro sistema?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Compará cómo se trabaja en un negocio tradicional frente a la tranquilidad de operar con nuestra solución integral.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {problemsVsSolutions.map((card, idx) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={idx}
                  {...fadeUp(idx * 0.08)}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {card.category}
                        </span>
                      </div>
                      <Badge className={`text-[10px] font-bold py-0.5 border ${card.color}`}>
                        {card.badge}
                      </Badge>
                    </div>

                    {/* El Problema */}
                    <div className="rounded-xl border border-rose-200/80 bg-rose-50/70 dark:border-rose-950/60 dark:bg-rose-950/20 p-3 mb-3">
                      <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 text-xs font-bold mb-1">
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>El problema habitual:</span>
                      </div>
                      <p className="text-xs text-rose-900/80 dark:text-rose-300/80 leading-relaxed">
                        {card.problem}
                      </p>
                    </div>

                    {/* La Solución */}
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-950/60 dark:bg-emerald-950/20 p-3">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Cómo lo soluciona nuestro SaaS:</span>
                      </div>
                      <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed font-medium">
                        {card.solution}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── LOS 5 PILARES DETALLADOS ────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16 sm:space-y-24">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="outline" className="text-xs font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/30 px-3 py-1">
              Módulos Especializados
            </Badge>
            <h2 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Cada área de tu empresa en sintonía perfecta
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Conocé en detalle las herramientas diseñadas para automatizar tareas repetitivas y darte control total.
            </p>
          </div>

          {solutionPillars.map((pillar, idx) => {
            const Icon = pillar.icon
            const isReversed = idx % 2 === 1
            return (
              <motion.div
                key={pillar.id}
                {...fadeUp(0.1)}
                className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-center ${
                  isReversed ? 'lg:flex-row-reverse' : ''
                }`}
              >
                {/* Columna Texto */}
                <div className={`lg:col-span-6 space-y-4 ${isReversed ? 'lg:order-2' : ''}`}>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-slate-100 dark:bg-slate-900 px-3 py-1 text-xs font-bold text-foreground">
                    <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    <span>{pillar.title}</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    {pillar.subtitle}
                  </h3>

                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {pillar.description}
                  </p>

                  <ul className="space-y-2.5 pt-2">
                    {pillar.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-3">
                    <Button asChild variant="outline" size="sm" className="rounded-xl font-bold text-xs">
                      <Link href="/saas/planes">
                        Ver planes que incluyen este módulo
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Columna Visual / Card Ilustrativa */}
                <div className={`lg:col-span-6 ${isReversed ? 'lg:order-1' : ''}`}>
                  <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900/80 p-6 sm:p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 h-44 w-44 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

                    <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-5">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${pillar.color} border shadow-xs`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{pillar.title}</p>
                          <p className="text-[11px] text-muted-foreground">Flujo activo en tiempo real</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono bg-background">
                        ONLINE 24/7
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border border-border/80 bg-background/90 p-3 shadow-2xs space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-foreground">Estado Operativo</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Sincronizado
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Cada acción realizada impacta en caja, repuestos y la vista del cliente sin demoras.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5">
                          <span className="text-[10px] text-muted-foreground block">Tiempo de respuesta</span>
                          <span className="font-bold text-foreground">Inmediato</span>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5">
                          <span className="text-[10px] text-muted-foreground block">Aislamiento de datos</span>
                          <span className="font-bold text-foreground">100% Seguro</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ── CÓMO EMPEZAR EN 3 PASOS ──────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white border-t border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900 dark:text-white">
              Empezá en 3 simples pasos
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              No necesitás instalaciones complicadas ni técnicos externos. Todo funciona en la nube desde tu navegador o celular.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 relative shadow-xs">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-black text-sm mb-4">
                1
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Registrá tu negocio</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Creá tu cuenta, elegí el nombre de tu empresa, configurá tus sucursales y personalizá los comprobantes con tu logo y datos fiscales.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 relative shadow-xs">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-black text-sm mb-4">
                2
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Cargá tu catálogo u órdenes</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Subí tus productos y repuestos, o comenzá directamente a registrar las órdenes de reparación que ingresan a tu taller.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 relative shadow-xs">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-black text-sm mb-4">
                3
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Operá con control total</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Mirá cómo tu caja cuadra al centavo, tus clientes siguen su equipo en línea y tus márgenes de ganancia crecen mes a mes.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Button
              asChild
              size="lg"
              className="h-12 px-8 bg-cyan-600 hover:bg-cyan-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-cyan-600/20 dark:shadow-cyan-500/20"
            >
              <Link href="/register">
                Crear Mi Cuenta Ahora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── PREGUNTAS FRECUENTES SOBRE SOLUCIONES ────────────────────────── */}
      <section className="py-16 sm:py-24 bg-slate-50 dark:bg-slate-900/30">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Badge variant="outline" className="text-xs font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/30 px-3 py-1">
              Preguntas Frecuentes
            </Badge>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Respuestas a las dudas más comunes
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Todo lo que necesitás saber antes de dar el salto hacia una gestión profesional.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-cyan-600 dark:text-cyan-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 mt-1">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
