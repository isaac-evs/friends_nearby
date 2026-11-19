import { Flame } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Racha: un fuego y cuántas semanas seguidas (al menos un plan o evento por semana).
 * Con `onClick` es un botón (objetivo de 44 px) que abre el detalle de la racha.
 */
export function StreakBadge({ weeks, className, onClick }: { weeks: number; className?: string; onClick?: () => void }) {
  const badge = (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-bold text-ink', weeks > 0 ? 'bg-accent' : 'bg-surface-sunken text-muted', !onClick && className)}>
      <Flame aria-hidden="true" size={14} strokeWidth={2.4} />{weeks} sem<span className="sr-only"> de racha</span>
    </span>
  )
  if (!onClick) return badge
  return <button type="button" aria-haspopup="dialog" onClick={onClick} className={cn('inline-flex min-h-11 items-center', className)}>{badge}</button>
}
