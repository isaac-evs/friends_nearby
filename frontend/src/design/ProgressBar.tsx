import { cn } from '@/lib/cn'

export function ProgressBar({
  value, label, tone = 'primary', className, height = 'h-3.5',
}: { value: number; label: string; tone?: 'primary' | 'success'; className?: string; height?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('overflow-hidden rounded-full border border-line bg-surface', height, className)}
    >
      <div className={cn('h-full rounded-full', tone === 'primary' ? 'bg-primary' : 'bg-success')} style={{ width: `${pct}%` }} />
    </div>
  )
}
