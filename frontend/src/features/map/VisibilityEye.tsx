import { Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { cn } from '@/lib/cn'

/**
 * El ojito: "En vivo" (verde, con punto) cuando tus amigos cercanos te ven; "No te ven" (gris, ojo tachado) en modo fantasma.
 * Tocarlo lo cambia. Tú siempre ves tu propio punto; en fantasma el tuyo se ve gris.
 */
export function VisibilityEye({ compact, className }: { compact?: boolean; className?: string }) {
  const { state } = useApp()
  const { toggleGhost } = useActions()
  const toast = useToast()
  const live = !state.ghost
  return (
    <button
      type="button" aria-pressed={live}
      onClick={() => { toggleGhost(); toast(live ? 'Modo fantasma: nadie te ve y solo ves qué hay' : 'En vivo: tus amigos cercanos te ven') }}
      className={cn(
        'pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 text-meta font-bold shadow-md', compact ? 'h-9' : 'h-11',
        live ? 'border-success bg-cat-musica text-ink' : 'border-line bg-surface-sunken text-muted',
        className,
      )}
    >
      {live
        ? <><span aria-hidden="true" className="animate-chill motion-reduce:animate-none size-2.5 rounded-full bg-success" /><Eye aria-hidden="true" size={16} />En vivo</>
        : <><EyeOff aria-hidden="true" size={16} />No te ven</>}
      <span className="sr-only">{live ? '. Toca para activar el modo fantasma' : '. Toca para volver a estar en vivo'}</span>
    </button>
  )
}
