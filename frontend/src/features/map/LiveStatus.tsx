import { useEffect, useRef, useState } from 'react'
import { EyeOff, Radio, RadioTower } from 'lucide-react'
import { useApp } from '@/app/store'
import { useNow, usePageVisible } from '@/app/hooks'
import { cn } from '@/lib/cn'
import { activeShares, locationViewers } from '@/lib/privacy'
import { WhoSeesSheet } from './WhoSeesSheet'

/**
 * La web no tiene ubicación en segundo plano: al ocultarse la pestaña (`visibilitychange`) dejamos
 * de compartir en vivo y, al volver, mostramos cuánto tiempo estuvo en pausa.
 */
export function LiveStatus({ className }: { className?: string }) {
  const { state } = useApp()
  const visible = usePageVisible()
  const now = useNow()
  const hiddenAt = useRef<number | null>(null)
  const [pausedFor, setPausedFor] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

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
  const n = locationViewers(state).length
  const sharing = activeShares(state.exactShares, now).length
  let text = n === 0 ? 'Nadie ve tu ubicación' : `Te ven ${n} ${n === 1 ? 'cercano' : 'cercanos'}`
  // Compartir la ubicación exacta es lo más sensible: siempre se dice en voz alta mientras dura.
  if (sharing > 0) text = `Exacta con ${sharing} ${sharing === 1 ? 'amigo' : 'amigos'}`
  if (state.ghost) { icon = <EyeOff aria-hidden="true" size={14} />; text = 'Modo fantasma: nadie te ve' }
  else if (!visible) { icon = <RadioTower aria-hidden="true" size={14} />; text = 'No compartiendo en vivo' }
  else if (pausedFor !== null) { icon = <RadioTower aria-hidden="true" size={14} />; text = `Pausada hace ${pausedFor} min` }

  return (
    <>
      {/* Toca para ver quién te ve. Objetivo de 44 px; la píldora visual es más chica. */}
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={cn('inline-flex min-h-11 items-center self-start', className)}>
        <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-2.5 text-caption font-bold shadow-sm">{icon}{text}</span>
      </button>
      <WhoSeesSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
