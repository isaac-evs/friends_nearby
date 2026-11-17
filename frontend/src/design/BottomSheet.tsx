import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** `surface`, radio `xl`, `shadow-lg`. En el mapa flota sobre la tab bar. */
export function BottomSheet({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={cn('flex flex-col gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-lg', className)}>
      {children}
    </section>
  )
}

/** Hoja modal con scrim para flujos como "Ver quién más va". */
export function ModalSheet({
  open, title, onClose, children,
}: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="max-h-[80dvh] w-full max-w-[480px] overflow-y-auto rounded-t-xl bg-surface p-5 shadow-lg lg:rounded-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3 font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="h-11 rounded-full px-3 text-sm font-bold text-primary" autoFocus>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  )
}
