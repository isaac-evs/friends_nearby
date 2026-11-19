import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CalendarClock, ChevronRight, Clock, Radio, X } from 'lucide-react'
import { useClock } from '@/app/hooks'
import { countdownLabel, minutesUntilStart } from '@/lib/planTime'
import { cn } from '@/lib/cn'
import { useMyPlans } from './useMyPlans'

/**
 * Estado de tu plan o evento, dentro de la app (no es push; eso está fuera del MVP, [PROPUESTA] recordatorios reales con un
 * scheduler en el backend). Solo puedes tener UNO a la vez:
 *   · si hay uno EN CURSO, se muestra primero ("En curso: …") con un botón para verlo;
 *   · si no, y alguno empieza en menos de 1 h, el aviso de que se acerca.
 * En móvil va en el flujo de la página (no tapa nada); en desktop, en la barra lateral (`compact`). Se puede ocultar.
 */
export function UpcomingBanner({ compact, className }: { compact?: boolean; className?: string }) {
  const now = useClock(30_000)
  const { pathname } = useLocation()
  const mine = useMyPlans(now)
  const [hidden, setHidden] = useState<string[]>([])
  // En el mapa, en Mis planes, en el match y dentro de un plan (ahí ya estás viendo el plan) ya está todo dicho.
  if (pathname === '/mapa' || pathname === '/planes' || pathname.startsWith('/match/') || pathname.startsWith('/plan/')) return null

  const live = mine.find((p) => p.phase === 'live' && !hidden.includes(`live:${p.key}`))
  const soon = live ? undefined : mine.find((p) => p.phase === 'upcoming' && minutesUntilStart(p, now) <= 60 && !hidden.includes(p.key))
  const p = live ?? soon
  if (!p) return null
  const urgent = !live && minutesUntilStart(p, now) <= 15
  const left = countdownLabel(p, now).replace(/^en curso · /, '')

  return (
    <Card compact={compact} className={className} tone={live ? 'live' : urgent ? 'urgent' : 'soon'} href={p.href} onHide={() => setHidden((h) => [...h, live ? `live:${p.key}` : p.key])}
      kicker={live ? 'En curso' : urgent ? 'Va a empezar' : 'Próximo'} title={p.title} meta={live ? left : `${left} · ${p.placeName}`} />
  )
}

/** Aviso compacto y tocable (lleva directo al plan): ícono, estado, título y una línea de contexto. */
function Card({ compact, className, tone, href, onHide, kicker, title, meta }: { compact?: boolean; className?: string; tone: 'live' | 'urgent' | 'soon'; href: string; onHide: () => void; kicker: string; title: string; meta: string }) {
  const Icon = tone === 'live' ? Radio : tone === 'urgent' ? Clock : CalendarClock
  return (
    <div role="status" className={cn('relative flex items-center overflow-hidden rounded-xl border border-line shadow-none', tone === 'live' ? 'bg-cat-musica' : tone === 'urgent' ? 'bg-accent-soft' : 'bg-surface', className)}>
      <Link to={href} aria-label={`${kicker}: ${title}. ${meta}`} className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 pl-3">
        <span aria-hidden="true" className={cn('relative flex flex-none items-center justify-center', tone === 'live' ? 'text-success-text' : tone === 'urgent' ? 'text-accent-text' : 'text-primary')}>
          <Icon size={19} strokeWidth={2.4} />
          {tone === 'live' && <span className="absolute -top-1 -right-1 size-3 animate-pulse rounded-full border-2 border-cat-musica bg-success motion-reduce:animate-none" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('text-caption font-extrabold tracking-[0.6px] uppercase', tone === 'live' ? 'text-success-text' : tone === 'urgent' ? 'text-accent-text' : 'text-muted')}>{kicker}</span>
          <span className={cn('truncate font-extrabold', compact ? 'text-sm' : 'text-[15px]')}>{title}</span>
          <span className="truncate text-caption font-semibold text-text">{meta}</span>
        </span>
        <ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />
      </Link>
      <button type="button" aria-label="Ocultar aviso" onClick={onHide} className="flex size-11 flex-none items-center justify-center text-muted"><X aria-hidden="true" size={16} /></button>
    </div>
  )
}
