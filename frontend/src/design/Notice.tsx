import type { ReactNode } from 'react'
import { ShieldCheck, Eye, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tone = 'safety' | 'privacy' | 'accent' | 'warning'
/** Cada tono: filo de color a la izquierda + pastilla del ícono. Fondo siempre claro y texto en tinta (contraste AA). */
const TONES: Record<Tone, { edge: string; chip: string }> = {
  safety: { edge: 'border-l-success', chip: 'bg-cat-musica text-success-text' },
  privacy: { edge: 'border-l-primary', chip: 'bg-primary-soft text-primary' },
  accent: { edge: 'border-l-accent', chip: 'bg-cat-comer text-accent-text' },
  warning: { edge: 'border-l-accent', chip: 'bg-accent-soft text-accent-text' },
}
const ICONS: Record<'shield' | 'eye' | 'lock', ReactNode> = {
  shield: <ShieldCheck aria-hidden="true" size={18} strokeWidth={2.3} />,
  eye: <Eye aria-hidden="true" size={18} strokeWidth={2.3} />,
  lock: <Lock aria-hidden="true" size={17} strokeWidth={2.3} />,
}

/**
 * Banner informativo: tarjeta blanca con un filo de color, el ícono en una pastilla redonda del mismo tono, un título
 * corto opcional y una o dos líneas. Mejor poco texto que mucho.
 */
export function Notice({
  tone = 'privacy', icon = 'eye', title, children, className, role,
}: { tone?: Tone; icon?: keyof typeof ICONS; title?: string; children: ReactNode; className?: string; role?: 'status' | 'alert' }) {
  const t = TONES[tone]
  return (
    <div role={role} className={cn('flex items-start gap-3 rounded-lg border border-l-4 border-line bg-surface py-3 pr-3.5 pl-3', t.edge, className)}>
      <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', t.chip)}>{ICONS[icon]}</span>
      <span className="flex min-w-0 flex-col gap-0.5 pt-px">
        {title && <span className="text-sm leading-tight font-extrabold text-ink">{title}</span>}
        <span className="text-meta leading-snug font-medium text-text">{children}</span>
      </span>
    </div>
  )
}
