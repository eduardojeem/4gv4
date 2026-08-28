import Image from 'next/image'
import styles from './saas-brand-assistant.module.css'

type SaaSBrandAssistantProps = {
  title?: string
  description?: string
  className?: string
}

export function SaaSBrandAssistant({
  title = 'Tu negocio, paso a paso',
  description = 'Una plataforma simple para ordenar, vender y crecer.',
  className = '',
}: SaaSBrandAssistantProps = {}) {
  return (
    <aside
      aria-label="Guía de la plataforma"
      className={`${styles.card} mt-4 flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-2.5 ${className}`}
    >
      <div className={styles.mascotStage}>
        <span className={styles.mascotGlow} aria-hidden="true" />
        <Image
          src="/branding/mascot/mi-tienda-assistant-2d.png"
          alt="Asistente de Mi Tienda"
          width={80}
          height={73}
          sizes="68px"
          className={styles.mascot}
        />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-semibold text-cyan-200">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
          {description}
        </p>
      </div>
    </aside>
  )
}
