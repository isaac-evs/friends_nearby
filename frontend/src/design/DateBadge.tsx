import { cn } from '@/lib/cn'

/** 54×58, `surface`, radio 14, `shadow-sm`. Día 22/800 y mes en overline `accent-text`. */
export function DateBadge({ day, month, small, className }: { day: string; month: string; small?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('flex flex-col items-center justify-center rounded-md bg-surface shadow-sm', small ? 'h-[52px] w-12' : 'h-[58px] w-[54px]', className)}
    >
      <span className={cn('leading-none font-extrabold tracking-[-0.5px]', small ? 'text-[19px]' : 'text-h2')}>{day}</span>
      <span className="mt-[3px] text-[10px] font-bold tracking-[1.2px] text-accent-text uppercase">{month}</span>
    </div>
  )
}
