import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Tarjeta `surface` con borde punteado, ícono en cuadro `primary-soft`, h2, texto y CTA. */
export function EmptyState({
  icon, title, text, children, className,
}: { icon: ReactNode; title: string; text: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed border-line-dashed bg-surface p-8 text-center', className)}>
      <div className="flex size-16 items-center justify-center rounded-[20px] bg-primary-soft text-primary">{icon}</div>
      <h2 className="text-[21px] font-extrabold tracking-[-0.4px]">{title}</h2>
      <p className="text-sm leading-normal text-muted">{text}</p>
      {children}
    </div>
  )
}
