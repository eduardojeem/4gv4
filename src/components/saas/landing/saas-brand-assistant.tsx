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
          src="/images/robot/robot-white-cyan.png"
          alt="Asistente de Mi Tienda"
          width={80}
          height={80}
          sizes="80px"
          className="h-full w-full object-contain drop-shadow-md select-none"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-cyan-200">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
          {description}
        </p>
      </div>
    </aside>
  )
}
