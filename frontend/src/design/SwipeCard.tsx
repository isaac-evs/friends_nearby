import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { BadgeCheck, Clock, MapPin, Users } from 'lucide-react'
import { Avatar } from './Avatar'
import { DateBadge } from './DateBadge'
import { cn } from '@/lib/cn'

export type SwipeDir = 'right' | 'left' | 'up'

/* ---------- Cuerpo de la card (presentacional) ---------- */

interface TileProps { tileClass: string; icon: ReactNode; category: string; xp: string }

export interface FriendCardProps extends TileProps {
  variant: 'friend'
  time: string
  person: { id: string; name: string }
  where: string
  title: string
  chip: string
}
export interface EventCardProps extends TileProps {
  variant: 'event'
  organizer: string
  verified: boolean
  title: string
  day: string
  month: string
  when: string
  place: string
  going: number
  capacity: number
}
export type CardProps = FriendCardProps | EventCardProps

export function CardBody(p: CardProps) {
  const isFriend = p.variant === 'friend'
  return (
    <>
      <div className={cn('relative flex flex-none items-center justify-center', isFriend ? 'h-[170px]' : 'h-[150px]', p.tileClass)}>
        <span className="absolute top-3.5 left-3.5 rounded-full bg-white/90 px-[11px] py-[5px] text-caption font-bold">{p.category}</span>
        {isFriend && <span className="absolute top-3.5 right-3.5 rounded-full bg-white/90 px-[11px] py-[5px] text-caption font-semibold">{p.time}</span>}
        {!isFriend && <DateBadge day={p.day} month={p.month} className="absolute bottom-3.5 left-3.5" />}
        <span className="text-ink">{p.icon}</span>
        <span className="absolute right-3.5 bottom-3.5 rounded-full bg-white px-2.5 py-[5px] text-caption font-bold text-accent-text shadow-sm">{p.xp}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
        {isFriend ? (
          <div className="flex items-center gap-3">
            <Avatar userId={p.person.id} name={p.person.name} size={44} />
            <div className="flex flex-col gap-px">
              <span className="text-[15px] font-bold">{p.person.name}</span>
              <span className="text-meta text-muted">{p.where}</span>
            </div>
          </div>
        ) : (
          <span className="flex items-center gap-1.5 text-caption font-medium text-muted">
            {p.verified && <BadgeCheck aria-hidden="true" size={14} className="text-primary" />}
            {p.organizer}{p.verified ? ' · verificado' : ''}
          </span>
        )}
        <h2 className="text-h2 font-extrabold">{p.title}</h2>
        {isFriend ? (
          <span className="mt-auto self-start rounded-full bg-surface-muted px-[11px] py-1.5 text-caption font-semibold text-text">{p.chip}</span>
        ) : (
          <div className="flex flex-col gap-[7px] text-meta text-text">
            <span className="flex items-center gap-2"><Clock aria-hidden="true" size={16} className="text-muted" />{p.when}</span>
            <span className="flex items-center gap-2"><MapPin aria-hidden="true" size={16} className="text-muted" />{p.place}</span>
            <span className="flex items-center gap-2">
              <Users aria-hidden="true" size={16} className="text-muted" />
              <span className="shrink-0">{p.going} van · cupo {p.capacity}</span>
              <span aria-hidden="true" className="block h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <span className="block h-full rounded-full bg-success" style={{ width: `${Math.round((p.going / p.capacity) * 100)}%` }} />
              </span>
            </span>
          </div>
        )}
      </div>
    </>
  )
}

/* ---------- Pila con gestos ---------- */

const THRESHOLD = 110
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Pila de cards: la de arriba se arrastra. → jalar, ← pasar (no notifica), ↑ guardar.
 * Teclado: ← → y ↓ (guardar). Respeta `prefers-reduced-motion`.
 */
export function SwipeStack({
  children, onSwipe, ariaLabel, className,
}: { children: ReactNode; onSwipe: (dir: SwipeDir) => void; ariaLabel: string; className?: string }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const [leaving, setLeaving] = useState<SwipeDir | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const finish = (dir: SwipeDir) => {
    if (reducedMotion()) {
      setDrag({ x: 0, y: 0, active: false })
      onSwipe(dir)
      return
    }
    setLeaving(dir)
    window.setTimeout(() => {
      setLeaving(null)
      setDrag({ x: 0, y: 0, active: false })
      onSwipe(dir)
    }, 260)
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (leaving) return
    start.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ x: 0, y: 0, active: true })
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    setDrag({ x: e.clientX - start.current.x, y: Math.min(0, e.clientY - start.current.y), active: true })
  }
  const onUp = () => {
    if (!start.current) return
    start.current = null
    if (drag.x > THRESHOLD) finish('right')
    else if (drag.x < -THRESHOLD) finish('left')
    else if (drag.y < -THRESHOLD) finish('up')
    else setDrag({ x: 0, y: 0, active: false })
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (leaving) return
    const map: Record<string, SwipeDir> = { ArrowRight: 'right', ArrowLeft: 'left', ArrowDown: 'up' }
    const dir = map[e.key]
    if (dir) { e.preventDefault(); finish(dir) }
  }

  const exit = leaving === 'right' ? { x: 520, y: 0 } : leaving === 'left' ? { x: -520, y: 0 } : leaving === 'up' ? { x: 0, y: -700 } : null
  const x = exit ? exit.x : drag.x
  const y = exit ? exit.y : drag.y
  const intent: SwipeDir | null = x > 40 ? 'right' : x < -40 ? 'left' : y < -40 ? 'up' : null

  return (
    <div className={cn('relative h-[424px]', className)}>
      <div aria-hidden="true" className="absolute inset-x-5 top-3.5 h-[410px] rounded-card bg-stack-2" />
      <div aria-hidden="true" className="absolute inset-x-2.5 top-[7px] h-[410px] rounded-card bg-stack-1" />
      <div
        role="group"
        aria-roledescription="card"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          transform: `translate(${x}px, ${y}px) rotate(${x / 40}deg)`,
          transition: drag.active && !exit ? 'none' : 'transform 260ms var(--ease-out-soft)',
          touchAction: 'none',
        }}
        className="absolute inset-x-0 top-0 flex h-[410px] cursor-grab flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card active:cursor-grabbing"
      >
        {children}
        {intent && (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute top-5 rounded-full border-2 px-3 py-1 text-sm font-extrabold tracking-wide uppercase',
              intent === 'right' && 'right-5 border-primary bg-white text-primary',
              intent === 'left' && 'left-5 border-danger bg-white text-danger',
              intent === 'up' && 'left-1/2 -translate-x-1/2 border-ink bg-white text-ink',
            )}
          >
            {intent === 'right' ? 'Jalo' : intent === 'left' ? 'Paso' : 'Luego'}
          </span>
        )}
      </div>
    </div>
  )
}
