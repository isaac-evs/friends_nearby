import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Input con label arriba. 16 px para evitar el zoom de iOS; alto 50, radio `md`, borde `line-input`. */
export function Field({
  label, hint, error, icon, className, 'aria-describedby': extraDescribedBy, ...rest
}: { label: string; hint?: string; error?: string; icon?: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-meta font-bold">{label}</label>
      <span className="relative block">
        {icon && <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink">{icon}</span>}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          {...rest}
          aria-describedby={[error || hint ? hintId : null, extraDescribedBy].filter(Boolean).join(' ') || undefined}
          className={cn(
            'h-[50px] w-full rounded-md border bg-surface px-4 text-base text-ink',
            error ? 'border-danger' : 'border-line-input',
            !!icon && 'pl-10',
          )}
        />
      </span>
      {(error || hint) && (
        <span id={hintId} role={error ? 'alert' : undefined} className={cn('text-caption font-medium', error ? 'text-danger' : 'text-muted')}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}
