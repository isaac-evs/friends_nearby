import { useState } from 'react'
import { Radio, RadioTower } from 'lucide-react'
import { useApp } from '@/app/store'
import { useNow, usePageVisible } from '@/app/hooks'
import { cn } from '@/lib/cn'
import { activeShares, locationViewers } from '@/lib/privacy'
import { WhoSeesSheet } from './WhoSeesSheet'

/**
 * No hay pausa: si la app se cierra o la pestaña se oculta simplemente te desconectas, y tus cercanos ven tu última
 * ubicación guardada con "hace cuánto".
 */
export function LiveStatus({ className }: { className?: string }) {
  const { state, connected } = useApp()
  const visible = usePageVisible()
  const now = useNow()
  const [open, setOpen] = useState(false)

  let icon = <Radio aria-hidden="true" size={14} className="text-success" />
  const n = locationViewers(state).length
  const sharing = activeShares(state.exactShares, now).length
  let text = n === 0 ? 'Nadie ve tu ubicación' : `Te ven ${n} ${n === 1 ? 'cercano' : 'cercanos'}`
  // Compartir la ubicación exacta es lo más sensible: siempre se dice en voz alta mientras dura.
  if (sharing > 0) text = `Exacta con ${sharing} ${sharing === 1 ? 'amigo' : 'amigos'}`
  if (!connected || !visible || state.location.status !== 'granted') { icon = <RadioTower aria-hidden="true" size={14} />; text = 'Desconectado · se guarda tu última ubicación' }

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
