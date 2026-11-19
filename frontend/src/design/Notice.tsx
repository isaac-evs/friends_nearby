import type { ReactNode } from 'react'
import { ShieldCheck, Eye, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tone = 'safety' | 'privacy' | 'accent' | 'warning'
const TONES: Record<Tone, string> = {
  safety: 'bg-cat-musica',
  privacy: 'bg-cat-estudiar',
  accent: 'bg-cat-comer',
  warning: 'bg-accent-soft',
}
const ICONS: Record<'shield' | 'eye' | 'lock', ReactNode> = {
  shield: <ShieldCheck aria-hidden="true" size={20} />,
  eye: <Eye aria-hidden="true" size={20} />,
  lock: <Lock aria-hidden="true" size={18} />,
}

/** Banner informativo: pastel (mint seguridad, lila privacidad), ícono dentro de una pastilla blanca + texto corto. */
export function Notice({
  tone = 'privacy', icon = 'eye', children, className, role,
}: { tone?: Tone; icon?: keyof typeof ICONS; children: ReactNode; className?: string; role?: 'status' | 'alert' }) {
  return (
    <div role={role} className={cn('flex items-center gap-3 rounded-xl border border-line px-3 py-2.5', TONES[tone], className)}>
      <span className="flex shrink-0 items-center justify-center text-ink">{ICONS[icon]}</span>
      <span className="text-meta leading-snug font-semibold text-ink">{children}</span>
    </div>
  )
}
