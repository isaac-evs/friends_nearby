import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'accent'
export type ButtonSize = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-bold transition-colors duration-150 select-none ' +
  'disabled:bg-surface-sunken disabled:text-muted disabled:border disabled:border-dashed disabled:border-line-dashed disabled:shadow-none ' +
  'aria-disabled:bg-surface-sunken aria-disabled:text-muted aria-disabled:border aria-disabled:border-dashed aria-disabled:border-line-dashed aria-disabled:shadow-none'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  dark: 'bg-ink text-white hover:bg-text',
  secondary: 'bg-surface text-ink border border-line-input hover:bg-surface-muted',
  ghost: 'bg-transparent text-primary hover:text-primary-hover',
  accent: 'bg-accent text-ink hover:brightness-95',
}

const sizes: Record<ButtonSize, string> = {
  md: 'h-12 px-5 rounded-lg text-sm',
  lg: 'h-[54px] px-6 rounded-lg text-base font-extrabold',
}

export function buttonClass(variant: ButtonVariant, size: ButtonSize, pill?: boolean, extra?: string) {
  return cn(base, variants[variant], sizes[size], pill && 'rounded-full', variant === 'primary' && 'shadow-md', extra)
}

interface Common { variant?: ButtonVariant; size?: ButtonSize; pill?: boolean; full?: boolean; className?: string; icon?: ReactNode }

export function Button({
  variant = 'primary', size = 'md', pill, full, loading, icon, className, children, ...rest
}: Common & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, pill, cn(full && 'w-full', className))}
    >
      {loading ? <Loader2 aria-hidden="true" size={18} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary', size = 'md', pill, full, icon, className, children, ...rest
}: Common & LinkProps) {
  return (
    <Link {...rest} className={buttonClass(variant, size, pill, cn(full && 'w-full', className))}>
      {icon}
      {children}
    </Link>
  )
}

/** Botón de ícono: círculo de 44 px, `surface`, `shadow-sm`. */
export function IconButton({
  label, className, children, ...rest
}: { label: string; className?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      {...rest}
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-sm', className)}
    >
      {children}
    </button>
  )
}

export function IconLink({ label, className, children, ...rest }: { label: string; className?: string; children: ReactNode } & LinkProps) {
  return (
    <Link
      aria-label={label}
      {...rest}
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-sm', className)}
    >
      {children}
    </Link>
  )
}
