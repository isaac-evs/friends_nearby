import { useEffect, useRef, useState } from 'react'
import { EyeOff, Radio, RadioTower } from 'lucide-react'
import { useApp } from '@/app/store'
import { usePageVisible } from '@/app/hooks'
import { cn } from '@/lib/cn'

/**
 * La web no tiene ubicación en segundo plano: al ocultarse la pestaña (`visibilitychange`) dejamos
 * de compartir en vivo y, al volver, mostramos cuánto tiempo estuvo en pausa.
 */
export function LiveStatus({ className }: { className?: string }) {
  const { state } = useApp()
  const visible = usePageVisible()
  const hiddenAt = useRef<number | null>(null)
  const [pausedFor, setPausedFor] = useState<number | null>(null)

  useEffect(() => {
    if (!visible) { hiddenAt.current = Date.now(); return }
    if (hiddenAt.current) {
      setPausedFor(Math.max(1, Math.round((Date.now() - hiddenAt.current) / 60_000)))
      hiddenAt.current = null
    }
  }, [visible])

  useEffect(() => {
    if (pausedFor === null) return
    const id = window.setTimeout(() => setPausedFor(null), 8000)
    return () => window.clearTimeout(id)
  }, [pausedFor])

  let icon = <Radio aria-hidden="true" size={14} className="text-success" />
  let text = 'Zona en vivo'
  if (state.ghost) { icon = <EyeOff aria-hidden="true" size={14} />; text = 'Modo fantasma: nadie te ve' }
  else if (!visible) { icon = <RadioTower aria-hidden="true" size={14} />; text = 'No compartiendo en vivo' }
  else if (pausedFor !== null) { icon = <RadioTower aria-hidden="true" size={14} />; text = `Pausada hace ${pausedFor} min` }

  return (
    <span role="status" className={cn('inline-flex h-7 items-center gap-1.5 self-start whitespace-nowrap rounded-full border border-line bg-surface px-2.5 text-caption font-bold shadow-sm', className)}>
      {icon}{text}
    </span>
  )
}
