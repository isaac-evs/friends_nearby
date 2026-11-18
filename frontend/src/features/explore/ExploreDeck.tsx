import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, ShieldCheck, Plus } from 'lucide-react'
import {
  Button, ButtonLink, CardBody, Chip, ChipLink, EmptyState, Notice, SegmentedControl, SwipeActions, SwipeStack, type SwipeDir,
} from '@/design'
import { useActions, useApp } from '@/app/store'
import { EVENT_GROUPS } from '@/lib/category'
import { eventToCard, planToCard } from './cards'
import { useDeck, type Mode, type TypeFilter } from './useDeck'
import { useNow } from '@/app/hooks'
import { useToast } from '@/design'

export interface DeckInfo { counter: string; mode: Mode }

/** Selector de modo + chips + pila de cards + acciones. Se usa en móvil y en el panel de desktop. */
export function ExploreDeck({ onInfo, compact }: { onInfo?: (i: DeckInfo) => void; compact?: boolean }) {
  const { state } = useApp()
  const { swipe, jalo, resetSwipes, setOpenMode } = useActions()
  const nav = useNavigate()
  const now = useNow()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('amigos')
  const [type, setType] = useState<TypeFilter>('Todos')
  const deck = useDeck(mode, type)
  const current = deck.remaining[0]
  const open = mode === 'abierto'

  const seen = deck.total - deck.remaining.length
  const counter = deck.gated
    ? 'modo abierto apagado'
    : current
      ? `${seen + 1} de ${deck.total} ${open ? 'eventos' : 'planes'}`
      : open ? 'sin eventos nuevos' : 'sin planes nuevos'
  useEffect(() => { onInfo?.({ counter, mode }) }, [counter, mode, onInfo])

  const doSwipe = (dir: SwipeDir) => {
    if (!current) return
    if (current.kind === 'plan') {
      if (dir === 'right') { const id = jalo(current.plan.id); if (id) nav(`/match/${id}`) }
      else { swipe('plan', current.plan.id, dir === 'left' ? 'pass' : 'later'); if (dir === 'up') toast('Guardado en tu lista') }
    } else if (dir === 'right') nav(`/evento/${current.event.id}`)
    else { swipe('event', current.event.id, dir === 'left' ? 'pass' : 'later'); if (dir === 'up') toast('Guardado en tu lista') }
  }

  const myPlan = state.plans.find((p) => p.authorId === 'me')
  const { removePlan } = useActions()

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl<Mode>
        label="Qué ver" value={mode} onChange={(m) => { setMode(m); setType('Todos') }}
        options={[
          { value: 'amigos', label: 'Mis amigos' },
          { value: 'abierto', label: <>{compact ? 'Abierto · eventos' : 'Abierto'}<span aria-hidden="true" className="size-1.5 rounded-full bg-accent" /></> },
        ]}
      />

      {myPlan && !open && (
        <Notice tone="accent" icon="eye" role="status">
          <span className="flex items-center justify-between gap-2">
            <span>Tu plan está activo: “{myPlan.line}”</span>
            <button type="button" onClick={() => removePlan(myPlan.id)} className="min-h-11 shrink-0 px-1 font-bold text-primary underline">Quitar</button>
          </span>
        </Notice>
      )}

      {open && !deck.gated && (
        <div role="group" aria-label="Tipo de evento" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
          <ChipLink to="/publicar/evento"><Plus aria-hidden="true" size={14} strokeWidth={2.8} />Crear</ChipLink>
          {(['Todos', ...EVENT_GROUPS] as TypeFilter[]).map((t) => (
            <Chip key={t} selected={type === t} onClick={() => setType(t)}>{t}</Chip>
          ))}
        </div>
      )}

      {deck.gated ? (
        <EmptyState
          className="min-h-[420px]" icon={<ShieldCheck aria-hidden="true" size={30} />}
          title="El modo abierto está apagado"
          text="Sirve para unirte a eventos con gente nueva. Gente nueva solo ve tu nombre, nunca tu ubicación."
        >
          <ButtonLink to="/modo-abierto" variant="dark" pill>Ver cómo funciona</ButtonLink>
          {state.openMode.adult && <Button variant="ghost" onClick={() => setOpenMode({ enabled: true })}>Activar de nuevo</Button>}
        </EmptyState>
      ) : current ? (
        <>
          <SwipeStack
            key={current.kind === 'plan' ? current.plan.id : current.event.id}
            onSwipe={doSwipe}
            ariaLabel={current.kind === 'plan' ? `Plan de ${state.users[current.plan.authorId]?.name ?? 'tu amigo'}` : `Evento ${current.event.title}`}
          >
            <CardBody {...(current.kind === 'plan' ? planToCard(current.plan, state.users[current.plan.authorId]!, now) : eventToCard(current.event))} />
          </SwipeStack>
          <SwipeActions
            joinLabel={current.kind === 'plan' ? 'Jalo' : 'Me uno'}
            onPass={() => doSwipe('left')}
            onLater={() => doSwipe('up')}
            onJoin={() => doSwipe('right')}
          />
          <p className="text-center text-caption leading-snug font-medium text-muted">
            {open ? 'Gente nueva solo ve tu nombre, nunca tu ubicación.' : 'Desliza → para jalar · ← para pasar (no le avisamos)'}
          </p>
          <p className="sr-only">Con teclado: flecha derecha para jalar, izquierda para pasar y abajo para guardar.</p>
        </>
      ) : (
        <EmptyState
          className="min-h-[420px]" icon={<Layers aria-hidden="true" size={30} />}
          title={open ? 'No hay más eventos así' : 'Ya viste todo lo de cerca'}
          text={open ? 'Arma el tuyo: elige el tipo, el lugar público y el cupo.' : 'Publica qué andas haciendo y deja que tus amigos jalen contigo.'}
        >
          <ButtonLink to={open ? '/publicar/evento' : '/publicar'} variant="dark" pill>{open ? 'Crear evento' : 'Publicar mi plan'}</ButtonLink>
          <Button variant="ghost" onClick={() => resetSwipes(open ? 'event' : 'plan')}>Volver a ver</Button>
        </EmptyState>
      )}
    </div>
  )
}
