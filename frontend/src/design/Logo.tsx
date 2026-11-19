import { cn } from '@/lib/cn'

/** Marca de la empresa. `className` ajusta el tamaño (por defecto 22 px). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('text-[22px] font-extrabold tracking-[-0.6px]', className)}>
      ¿jalas<span className="text-primary">?</span>
    </span>
  )
}
