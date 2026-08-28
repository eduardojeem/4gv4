import Image from 'next/image'

export function SaaSBrandAssistant() {
  return (
    <aside
      aria-label="Guía de la plataforma"
      className="mt-4 flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-2.5"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-cyan-300/30 bg-white shadow-sm">
        <Image
          src="/branding/mascot/mi-tienda-assistant.png"
          alt="Asistente de Mi Tienda"
          width={96}
          height={96}
          sizes="48px"
          className="absolute left-1/2 top-[42%] h-[190%] w-[190%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
        />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-semibold text-cyan-200">Tu negocio, paso a paso</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
          Una plataforma simple para ordenar, vender y crecer.
        </p>
      </div>
    </aside>
  )
}
