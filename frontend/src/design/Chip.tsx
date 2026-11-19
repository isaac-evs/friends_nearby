import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/cn'

/** FilterChip: alto 34, pill. Activo = primary-soft + borde primary + texto primary-hover. */
export function Chip({
  selected, className, children, ...rest
}: { selected: boolean; className?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      className={cn(
        'inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-meta font-semibold transition-colors',
        selected ? 'border-primary bg-primary-soft text-primary-hover' : 'border-line bg-surface text-text',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Variante `dark` del chip (p. ej. "+ Crear"). */
export function ChipLink({ className, children, ...rest }: { className?: string; children: ReactNode } & LinkProps) {
  return (
    <Link
      {...rest}
      className={cn('inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-meta font-bold text-white', className)}
    >
      {children}
    </Link>
  )
}

/** Pill informativa (no interactiva). */
export function Pill({
  tone = 'surface', className, children,
}: { tone?: 'surface' | 'accent' | 'muted' | 'primary' | 'dark' | 'live'; className?: string; children: ReactNode }) {
  const tones = {
    surface: 'bg-surface text-ink border border-line',
    accent: 'bg-accent-soft text-accent-text',
    muted: 'bg-surface-muted text-text',
    primary: 'bg-primary text-white',
    dark: 'bg-ink text-white',
    live: 'bg-cat-musica text-success-text',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-bold', tones[tone], className)}>
      {children}
    </span>
  )
}
