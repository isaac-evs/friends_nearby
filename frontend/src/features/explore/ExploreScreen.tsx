import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Bookmark, Flame } from 'lucide-react'
import { IconButton, useToast } from '@/design'
import { useApp, useMe } from '@/app/store'
import { ExploreDeck, type DeckInfo } from './ExploreDeck'
import { useSaved } from '../saved/useSaved'

/** Pantalla 3: Explorar (Mis amigos / Abierto). */
export function ExploreScreen() {
  const me = useMe()
  const { state } = useApp()
  const toast = useToast()
  const saved = useSaved()
  const [info, setInfo] = useState<DeckInfo>({ counter: '', mode: 'amigos' })
  return (
    <div className="flex flex-col gap-3 px-5 pt-9 pb-[104px]">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-h1 font-extrabold">¿Quién jala hoy?</h1>
          <span className="text-meta text-muted">{state.location.zoneName} · {info.counter}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/perfil" aria-label={`Racha de ${me.streakWeeks} semanas`} className="flex h-9 items-center gap-1 rounded-full bg-accent-soft px-3 text-sm font-bold text-accent-text">
            <Flame aria-hidden="true" size={16} strokeWidth={2.2} />{me.streakWeeks}
          </Link>
          <Link to="/guardados" aria-label={saved.count ? `Guardados (${saved.count})` : 'Guardados'} className="relative flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-sm">
            <Bookmark aria-hidden="true" size={20} />
            {saved.count > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption font-bold text-white">{saved.count}</span>}
          </Link>
          <IconButton label="Notificaciones" onClick={() => toast('Sin notificaciones nuevas')}><Bell aria-hidden="true" size={20} /></IconButton>
        </div>
      </header>
      <ExploreDeck onInfo={setInfo} />
    </div>
  )
}
