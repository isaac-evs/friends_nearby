import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Banner de vista previa que baja contigo en móvil (plan y evento comparten el mismo tamaño: 72 px de alto).
 * El marco con fondo tapa lo que pasa por detrás para que no se encime con el contenido.
 */
export function PreviewBanner({ label, tileClass, icon, photoUrl, kicker, title, meta }: {
  label: string; tileClass: string; icon: ReactNode; photoUrl?: string; kicker: string; title: string; meta: string
}) {
  return (
    <div className="sticky top-0 z-20 -mx-[22px] bg-bg px-[22px] py-2 lg:hidden">
      <section aria-label={label} className="flex h-[72px] items-center gap-3 overflow-hidden rounded-xl border border-line bg-surface pr-3 shadow-lg">
        <div className={cn('relative flex size-[72px] flex-none items-center justify-center', tileClass)}>
          {photoUrl ? <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" /> : <span className="text-ink">{icon}</span>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-caption font-bold text-muted">{kicker}</span>
          <span className="truncate text-[15px] font-extrabold">{title}</span>
          <span className="truncate text-caption font-medium text-muted">{meta}</span>
        </div>
      </section>
    </div>
  )
}
