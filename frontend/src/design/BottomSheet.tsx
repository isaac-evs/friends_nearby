import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  open, title, onClose, children, variant = 'sheet',
}: { open: boolean; title: string; onClose: () => void; children: ReactNode; /** `drawer`: en desktop es un panel lateral a la derecha (menús largos); en móvil, una hoja alta. */ variant?: 'sheet' | 'drawer' }) {
  const ref = useRef<HTMLDivElement>(null)
  // El menú lateral se queda montado mientras corre su animación de salida.
  const [mounted, setMounted] = useState(open)
  const closing = variant === 'drawer' && mounted && !open
  useEffect(() => {
    if (open) { setMounted(true); return }
    const t = window.setTimeout(() => setMounted(false), 240)
    return () => window.clearTimeout(t)
  }, [open, variant])
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Esc cierra, Tab se queda dentro del diálogo y el foco vuelve a quien lo abrió.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const items = ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      const active = document.activeElement
      if (!ref.current.contains(active) || (e.shiftKey && active === first)) { e.preventDefault(); (e.shiftKey ? last : first).focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.() }
  }, [open])

  if (!open && !closing) return null
  // Se dibuja en <body>: si no, un contenedor con su propio orden de apilado (z-index) lo dejaría debajo de la tab bar.
  return createPortal(
    <div data-closing={closing || undefined} className={cn('fixed inset-0 z-50 flex items-end justify-center bg-ink/40', variant === 'drawer' ? 'scrim-motion lg:items-stretch lg:justify-end lg:bg-ink/20' : 'lg:items-center')} onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        data-closing={closing || undefined}
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full overflow-y-auto bg-surface shadow-lg',
          variant === 'drawer' ? 'drawer-motion max-h-[92dvh] max-w-[480px] rounded-t-xl p-5 lg:max-h-none lg:max-w-[460px] lg:rounded-none lg:rounded-l-xl lg:p-8' : 'max-h-[80dvh] max-w-[480px] rounded-t-xl p-5 lg:rounded-xl',
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3 font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="h-11 rounded-full px-3 text-sm font-bold text-primary" autoFocus>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  , document.body)
}
