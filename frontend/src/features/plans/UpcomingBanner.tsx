import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, Navigation, Radio, X } from 'lucide-react'
import { buttonClass } from '@/design'
import { useClock } from '@/app/hooks'
import { countdownLabel, minutesUntilStart } from '@/lib/planTime'
import { cn } from '@/lib/cn'
import { directionsHref, useMyPlans, type MyPlan } from './useMyPlans'

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
  // En el mapa, en Mis planes y en el match ya está todo dicho.
  if (pathname === '/mapa' || pathname === '/planes' || pathname.startsWith('/match/')) return null

  const live = mine.find((p) => p.phase === 'live' && !hidden.includes(`live:${p.key}`))
  const soon = live ? undefined : mine.find((p) => p.phase === 'upcoming' && minutesUntilStart(p, now) <= 60 && !hidden.includes(p.key))
  const p = live ?? soon
  if (!p) return null
  const urgent = !live && minutesUntilStart(p, now) <= 15

  return (
    <Card compact={compact} className={className} tone={live ? 'live' : urgent ? 'urgent' : 'soon'} onHide={() => setHidden((h) => [...h, live ? `live:${p.key}` : p.key])}>
      {live ? <>En curso: «{p.title}» · {countdownLabel(p, now).replace('en curso · ', '')}.</> : <>Tu plan «{p.title}» {countdownLabel(p, now)}.</>}
      <Actions p={p} live={!!live} compact={compact} />
    </Card>
  )
}

function Card({ compact, className, tone, onHide, children }: { compact?: boolean; className?: string; tone: 'live' | 'urgent' | 'soon'; onHide: () => void; children: ReactNode[] | ReactNode }) {
  const [text, actions] = Array.isArray(children) ? children : [children, null]
  const Icon = tone === 'live' ? Radio : Bell
  return (
    <div role="status" className={cn('flex flex-col gap-2 rounded-xl border border-line p-3 shadow-sm', tone === 'live' ? 'bg-cat-musica' : tone === 'urgent' ? 'bg-accent-soft' : 'bg-surface', className)}>
      <div className="flex items-start gap-2.5">
        <Icon aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
        <p className={cn('flex-1 font-bold', compact ? 'text-caption' : 'text-sm')}>{text}</p>
        <button type="button" aria-label="Ocultar aviso" onClick={onHide} className="-m-2 flex size-11 shrink-0 items-center justify-center"><X aria-hidden="true" size={18} /></button>
      </div>
      {actions}
    </div>
  )
}

function Actions({ p, live, compact }: { p: MyPlan; live: boolean; compact?: boolean }) {
  const way = directionsHref(p)
  const cls = (v: 'primary' | 'secondary') => buttonClass(v, 'md', false, 'h-11 flex-1 rounded-md px-3 text-sm')
  const see = live ? p.href : '/planes'
  return (
    <div className={cn('flex gap-2', compact && 'flex-col')}>
      {way.external
        ? <a href={way.href} target="_blank" rel="noopener noreferrer" className={cls(live ? 'secondary' : 'primary')}><Navigation aria-hidden="true" size={16} />Cómo llegar<span className="sr-only"> (abre tu app de mapas en otra pestaña)</span></a>
        : <Link to={way.href} className={cls(live ? 'secondary' : 'primary')}><Navigation aria-hidden="true" size={16} />Cómo llegar</Link>}
      <Link to={see} className={cls(live ? 'primary' : 'secondary')}>{live ? 'Ver' : 'Mis planes'}</Link>
    </div>
  )
}
