import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Bookmark, Check, X } from 'lucide-react'
import { MeMarker, PersonMarker, PlanMarker } from '@/design'
import { PLAN_CATEGORIES } from '@/lib/category'
import { SHOWCASE as S } from './showcaseContent'
import { avatarColor, initials } from '@/lib/avatar'
import { cn } from '@/lib/cn'

/** Imagen que, si no carga, cae a un color (y a iniciales cuando se le da `name`). */
function Pic({ src, name, className, alt = '' }: { src: string; name?: string; className?: string; alt?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span aria-hidden="true" className={cn('flex items-center justify-center font-bold text-ink', className)} style={{ background: avatarColor(name ?? src) }}>{name ? initials(name) : null}</span>
  return <img src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn('object-cover', className)} />
}

/** Mapa siempre dibujado (calles, parques y un río), muy suave. */
function DrawnMap() {
  return (
    <svg aria-hidden="true" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
      <rect width="800" height="900" className="fill-surface-sunken" />
      <path d="M-20 640 C 180 560, 300 700, 480 620 S 760 520, 840 580 L 840 700 C 740 640, 560 740, 480 720 S 200 660, -20 760 Z" className="fill-cat-estudiar/50" />
      <rect x="520" y="90" width="210" height="150" rx="26" className="fill-cat-musica/60" />
      <rect x="60" y="300" width="150" height="120" rx="22" className="fill-cat-musica/60" />
      <g className="stroke-surface" strokeWidth="14" strokeLinecap="round" fill="none">
        <path d="M-10 150 H 810" /><path d="M-10 330 H 810" /><path d="M-10 500 H 810" /><path d="M-10 810 H 810" />
        <path d="M120 -10 V 910" /><path d="M300 -10 V 910" /><path d="M500 -10 V 910" /><path d="M690 -10 V 910" />
        <path d="M-10 60 L 810 420" strokeWidth="9" /><path d="M810 220 L 200 910" strokeWidth="9" />
      </g>
      <g className="stroke-surface" strokeWidth="5" fill="none"><path d="M-10 240 H 810" /><path d="M-10 420 H 810" /><path d="M210 -10 V 910" /><path d="M400 -10 V 910" /><path d="M600 -10 V 910" /></g>
    </svg>
  )
}

/** Marcador anclado por porcentaje al mapa de la vista previa (centrado en su punto) con un vaivén suave y propio. */
function At({ x, y, delay = '0s', children }: { x: string; y: string; delay?: string; children: React.ReactNode }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}>
      <div className="hero-float-motion" style={{ animationDelay: delay }}>{children}</div>
    </div>
  )
}

/** Marcadores con los MISMOS componentes que el mapa real (amigos cercanos solo con foto, plan con su ícono, y "tú"). Decorativos. */
function MapMarkers() {
  const cat = PLAN_CATEGORIES.cafe
  const noop = () => {}
  const [mau, dani] = S.joined
  const ro = S.nearby[0]
  return (
    <div aria-hidden="true" inert className="absolute inset-0">
      <At x="16%" y="24%" delay="0s"><PersonMarker person={{ id: 'mau', name: mau.name }} src={mau.photo} noPlan description="" onSelect={noop} /></At>
      <At x="86%" y="72%" delay="-1.5s"><PersonMarker person={{ id: 'dani', name: dani.name }} src={dani.photo} description="" onSelect={noop} /></At>
      <At x="84%" y="22%" delay="-3s"><PersonMarker person={{ id: 'ro', name: ro.name }} src={ro.photo} description="" onSelect={noop} /></At>
      <At x="18%" y="70%" delay="-2.2s"><PlanMarker icon={cat.icon({ size: 22, strokeWidth: 2.2 })} tileClass={cat.tile} label="7:00 pm" description="" onSelect={noop} /></At>
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: '30%', top: '48%' }}>
        <span className="hero-ping-motion absolute inset-1 rounded-full bg-primary/30" />
        <MeMarker />
      </div>
    </div>
  )
}

type Dir = 'right' | 'left' | 'up'
const THRESHOLD = 90
/** Segundos que se ve el resultado antes de que vuelva la card. */
const RESULT_MS = 3000
const RESULTS: Record<Dir, { label: string; tone: string; icon: typeof Check }> = {
  right: { label: '¡Jalo!', tone: 'text-success', icon: Check },
  left: { label: 'Paso', tone: 'text-danger', icon: X },
  up: { label: 'Guardado', tone: 'text-primary', icon: Bookmark },
}
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Vista previa interactiva de la app para desktop (mitad derecha de la pantalla de entrada): un mapa suave detrás y la card
 * de un plan que se puede probar: arrástrala (→ jalo, ← paso, ↑ guardar), usa los botones o las flechas del teclado. Al
 * decidir, la card se encoge, aparece el resultado y a los 3 s vuelve.
 */
export function Showcase({ className }: { className?: string }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const [result, setResult] = useState<Dir | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const decide = (dir: Dir) => {
    if (result) return
    start.current = null
    setDrag({ x: 0, y: 0, active: false })
    setResult(dir)
    timer.current = window.setTimeout(() => setResult(null), RESULT_MS)
  }
  const onDown = (e: PointerEvent<HTMLElement>) => { if (result) return; start.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); setDrag({ x: 0, y: 0, active: true }) }
  const onMove = (e: PointerEvent<HTMLElement>) => { if (start.current) setDrag({ x: e.clientX - start.current.x, y: Math.min(0, e.clientY - start.current.y), active: true }) }
  const onUp = () => {
    if (!start.current) return
    start.current = null
    if (drag.x > THRESHOLD) decide('right'); else if (drag.x < -THRESHOLD) decide('left'); else if (drag.y < -THRESHOLD) decide('up')
    else setDrag({ x: 0, y: 0, active: false })
  }
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const dir = ({ ArrowRight: 'right', ArrowLeft: 'left', ArrowDown: 'up' } as Record<string, Dir>)[e.key]
    if (dir) { e.preventDefault(); decide(dir) }
  }

  const intent: Dir | null = drag.x > 40 ? 'right' : drag.x < -40 ? 'left' : drag.y < -40 ? 'up' : null
  const R = result ? RESULTS[result] : null
  const quick = typeof window !== 'undefined' && reduced()
  const cardStyle = result
    ? { transform: `translate(${result === 'right' ? 60 : result === 'left' ? -60 : 0}px, ${result === 'up' ? -50 : 0}px) scale(0.2)`, opacity: 0, transition: quick ? 'none' : 'transform 450ms var(--ease-out-soft), opacity 350ms ease-out' }
    : { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 40}deg)`, opacity: 1, transition: drag.active ? 'none' : quick ? 'none' : 'transform 320ms var(--ease-out-soft), opacity 300ms ease-out', touchAction: 'none' as const }

  return (
    <aside aria-label="Vista previa de la app" className={cn('relative isolate overflow-hidden bg-primary-soft', className)}>
      <div aria-hidden="true" className="map-pan-motion absolute -inset-[8%]">
        <DrawnMap />
        <MapMarkers />
      </div>
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-l from-bg via-bg/30 to-transparent" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-10">
        <div className="relative w-full max-w-[340px]">
          <div className={result ? '' : 'hero-float-motion'}>
            <figure
              role="group" aria-roledescription="card" aria-label={`Plan de ${S.author.name}: ${S.title}`} tabIndex={0}
              onKeyDown={onKey} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={cardStyle}
              className="relative w-full cursor-grab touch-none overflow-hidden rounded-card border border-line bg-surface shadow-card select-none active:cursor-grabbing"
            >
              <div className="relative h-[190px] bg-cat-cafe">
                <Pic src={S.photo} className="size-full" />
                <span className="absolute top-3.5 left-3.5 rounded-full bg-surface/95 px-3 py-1 text-caption font-bold shadow-sm">{S.category}</span>
                <span className="absolute right-3.5 bottom-3.5 rounded-full bg-ink/80 px-3 py-1 text-caption font-bold text-white">{S.when}</span>
              </div>
              <div className="flex flex-col gap-3.5 p-4">
                <div className="flex items-center gap-3">
                  <Pic src={S.author.photo} name={S.author.name} className="size-10 rounded-full border border-line text-meta" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-bold">{S.author.name}</span>
                    <span className="text-caption text-muted">{S.place} · {S.distance}</span>
                  </div>
                </div>
                <figcaption className="text-[20px] leading-tight font-extrabold tracking-[-0.4px]">{S.title}</figcaption>
                <div className="flex items-center gap-2">
                  <span className="flex -space-x-2">
                    {S.joined.map((j) => <Pic key={j.name} src={j.photo} name={j.name} className="size-7 rounded-full border-2 border-surface text-[10px]" />)}
                  </span>
                  <span className="text-caption font-semibold text-muted">{S.joined.length} ya jalaron</span>
                </div>
              </div>
              {intent && (
                <span aria-hidden="true" className={cn('pointer-events-none absolute top-5 rounded-full border-2 bg-white px-3 py-1 text-sm font-extrabold tracking-wide uppercase',
                  intent === 'right' && 'right-5 border-success text-success', intent === 'left' && 'left-5 border-danger text-danger', intent === 'up' && 'left-1/2 -translate-x-1/2 border-primary text-primary')}>
                  {RESULTS[intent].label.replace('¡', '').replace('!', '')}
                </span>
              )}
            </figure>
          </div>
          {R && (
            <div role="status" className={cn('pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 animate-[alert-in_300ms_var(--ease-out-soft)_both]', R.tone)}>
              <span className="flex size-20 items-center justify-center rounded-full border-4 border-current bg-surface shadow-lg"><R.icon aria-hidden="true" size={40} strokeWidth={3} /></span>
              <span className="text-[30px] font-extrabold tracking-[-0.6px]">{R.label}</span>
            </div>
          )}
        </div>
        <p className="sr-only">Con teclado: flecha derecha para jalar, izquierda para pasar y abajo para guardar.</p>
      </div>
    </aside>
  )
}
