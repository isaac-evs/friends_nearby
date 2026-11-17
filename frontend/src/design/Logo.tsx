import { cn } from '@/lib/cn'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('text-[22px] font-extrabold tracking-[-0.6px]', className)}>
      ¿jalas<span className="text-primary">?</span>
    </span>
  )
}
