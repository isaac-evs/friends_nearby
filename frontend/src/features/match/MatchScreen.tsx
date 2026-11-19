import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Check, Lock, MapPin, Navigation } from 'lucide-react'
import { Avatar, AvatarStack, Button, ButtonLink, Notice, buttonClass, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { PLAN_CATEGORIES } from '@/lib/category'
import { formatApproxDistance } from '@/lib/format'
import { planDistanceM } from '@/lib/reach'
import { countdownLabel, durationText, startLabel, verifyWindow, VERIFY_LEAD_MIN, planStart } from '@/lib/planTime'
import { useClock } from '@/app/hooks'
import { cn } from '@/lib/cn'

const QUICK = ['Voy en 10', 'Ya llegué', 'Se me complicó']

/** Pantalla 5: ¡Se armó! Punto de encuentro, mensajes rápidos y "Ya nos vimos". */
export function MatchScreen() {
  const { id } = useParams()
  const { state } = useApp()
  const { setQuickMessage, confirmMeet, verifyTogether } = useActions()
  const [checking, setChecking] = useState(false)
  const toast = useToast()
  const now = useClock(15_000)
  const match = state.matches.find((m) => m.id === id)
  const plan = match && state.plans.find((p) => p.id === match.planId)
  const friend = match && state.users[match.friendId]
  const me = state.users.me!

  const waiting = !!match && match.myConfirmed && !match.theirConfirmed

  if (!match || !plan || !friend) return <Navigate to="/" replace />
  const verify = async () => { setChecking(true); try { await verifyTogether(match.id) } finally { setChecking(false) } }
  const cat = PLAN_CATEGORIES[plan.category]
  const both = match.myConfirmed && match.theirConfirmed
  const win = verifyWindow(plan, now)
  const verifyAt = startLabel(new Date(planStart(plan) - VERIFY_LEAD_MIN * 60_000).toISOString(), now)
  const others = Math.max(0, plan.joinedCount - 1) // además de ti
  // Cómo llegar: si el plan tiene lugar exacto (público) se abre en la app de mapas; si no, el mapa de la app.
  const dest = plan.place ? `https://www.google.com/maps/dir/?api=1&destination=${plan.place.center.lat},${plan.place.center.lng}` : null

  return (
    <div className="flex min-h-dvh flex-col gap-[18px] px-[22px] pt-10 pb-6 lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-start lg:gap-x-16 lg:gap-y-5 lg:p-0 lg:pt-6">
      <div className="flex flex-col items-center gap-3 text-center lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:justify-center lg:rounded-card lg:bg-primary-soft lg:py-16">
        <div aria-hidden="true" className="flex items-center">
          <Avatar userId="me" name="Tú" size={90} self text="TÚ" />
          <Avatar userId={friend.id} name={friend.name} size={90} className="-ml-5" />
        </div>
        <h1 className="text-[52px] leading-none font-extrabold tracking-[-1.5px]">¡Se armó!</h1>
        <p className="mt-1 text-base font-semibold text-text">{friend.name} aceptó tu jale para {cat.label === 'Café' ? 'el café' : `${cat.label.toLowerCase()}`}.</p>
      </div>

      <section aria-label="Punto de encuentro" className="lg:col-start-2 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-md">
        <div className="flex items-center gap-3">
          <span className={cn('flex size-11 flex-none items-center justify-center rounded-md border border-line', cat.tile)}><MapPin aria-hidden="true" size={22} /></span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold tracking-[0.8px] text-muted uppercase">Punto de encuentro</span>
            <span className="text-base font-extrabold">{match.meetPoint}</span>
            <span className="text-meta font-semibold text-text">{startLabel(plan.startsAt, now)} · dura {durationText(plan.durationMin)}</span>
            <span className="text-meta font-semibold text-text">{countdownLabel(plan, now)} · a {formatApproxDistance(planDistanceM(plan, state.location.center))}</span>
          </div>
        </div>
        {plan.photoUrl && <img src={plan.photoUrl} alt="Foto del plan" className="h-36 w-full rounded-md border border-line object-cover" />}
        {match.togetherAt ? (
          <Notice tone="safety" icon="shield" role="status" className="!rounded-[12px] !py-2">Verificado: llegaste al punto de encuentro.</Notice>
        ) : (
          <>
            <Notice tone="privacy" icon="lock" className="!rounded-[12px] !py-2">
              Tu ubicación solo la usa el sistema, una vez, para comprobar que llegaste. Ni {friend.name} ni nadie la ve.
            </Notice>
            {win === 'open' ? (
              <Button variant="secondary" loading={checking} onClick={verify}>Verificar que estoy aquí</Button>
            ) : (
              <>
                {/* aria-disabled (no disabled) para que el motivo sea alcanzable con teclado y lector de pantalla. */}
                <Button variant="secondary" aria-disabled="true" aria-describedby="verify-why" onClick={() => toast(win === 'early' ? `Se activa 30 min antes del inicio (${verifyAt})` : 'El plan ya terminó')}>Verificar que estoy aquí</Button>
                <p id="verify-why" className="text-caption font-medium text-muted">{win === 'early' ? `Se activa 30 min antes del inicio (${verifyAt}).` : 'El plan ya terminó: ya no se puede verificar.'}</p>
              </>
            )}
          </>
        )}
        <Link to={`/mapa?sel=${plan.id}`} className="flex min-h-11 items-center justify-center text-sm font-bold text-primary">Ver dónde es en el mapa</Link>
        {dest ? (
          <a href={dest} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'md')}>
            <Navigation aria-hidden="true" size={18} strokeWidth={2.4} />Cómo llegar<span className="sr-only"> (abre tu app de mapas en otra pestaña)</span>
          </a>
        ) : (
          <ButtonLink to="/mapa" size="md" icon={<Navigation aria-hidden="true" size={18} strokeWidth={2.4} />}>Cómo llegar</ButtonLink>
        )}
      </section>

      <section aria-label="Quiénes van" className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 lg:col-start-2">
        <AvatarStack people={[{ id: 'me', name: me.name, avatarUrl: me.avatarUrl }, { id: friend.id, name: friend.name, avatarUrl: friend.avatarUrl }]} size={40} />
        <span className="text-sm font-bold">Van: tú y {friend.name}{others > 0 ? ` y ${others} más` : ''}</span>
      </section>

      <section aria-label="Mensajes rápidos" className="flex flex-col gap-2.5 lg:col-start-2">
        <h2 className="text-sm font-bold">Avísale rápido</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q} type="button" aria-pressed={match.quickMessage === q} onClick={() => setQuickMessage(match.id, q)}
              className={cn('h-11 rounded-full border border-line px-4 text-sm font-bold', match.quickMessage === q ? 'bg-primary text-white' : 'bg-surface text-ink')}
            >
              {q}
            </button>
          ))}
        </div>
        {match.receivedMessage && <p role="status" className="text-meta">{friend.name}: {match.receivedMessage}</p>}
        {match.quickMessage && <span role="status" className="text-meta font-bold text-text">Enviado a {friend.name}: “{match.quickMessage}”</span>}
      </section>

      <section aria-label="Recompensa" className="mt-auto lg:mt-0 lg:col-start-2 flex flex-col gap-2.5 rounded-xl border border-line bg-cat-comer px-4 py-3.5">
        {!match.myConfirmed && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-meta leading-snug">Cuando se vean, los dos toquen el botón. Validamos que estén cerca.</span>
              <span className="flex-none rounded-[12px] border border-line bg-surface px-2 py-1 text-center text-meta font-bold">+20 XP<br />+1 racha</span>
            </div>
            <button type="button" onClick={() => confirmMeet(match.id, 'me')} className="h-12 rounded-md border border-line bg-surface text-[15px] font-bold shadow-md">Ya nos vimos</button>
          </>
        )}
        {waiting && (
          <div role="status" className="flex items-center gap-3">
            <span className="flex size-12 flex-none items-center justify-center rounded-full border border-line bg-surface"><Lock aria-hidden="true" size={22} /></span>
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-extrabold">Esperando a que {friend.name} confirme…</span>
              <span className="text-meta font-semibold">Cuando los dos confirmen: +20 XP y +1 racha.</span>
            </div>
          </div>
        )}
        {both && (
          <div role="status" className="flex items-center gap-3">
            <span className="flex size-12 flex-none items-center justify-center rounded-full border border-line bg-cat-musica"><Check aria-hidden="true" size={24} strokeWidth={2.8} /></span>
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-extrabold">+20 XP · racha de {state.users.me!.streakWeeks} semanas</span>
              <span className="text-meta font-semibold">Los dos confirmaron. ¡Buen jale!</span>
            </div>
          </div>
        )}
      </section>

      <Link to="/" className="flex h-11 items-center justify-center text-[15px] font-bold text-primary lg:col-start-2">Seguir explorando</Link>
    </div>
  )
}
