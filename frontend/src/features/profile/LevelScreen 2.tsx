import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Crown } from 'lucide-react'
import { Button, IconButton, LevelBadge, ProgressBar, Tabs, panelId, tabId } from '@/design'
import { useApp } from '@/app/store'
import { levelInfo, MAX_LEVEL, TIER_SIZE, TIERS } from '@/lib/levels'
import { byRecent } from '@/lib/history'
import { HistoryRow } from './HistoryRow'
import { cn } from '@/lib/cn'

type Tab = 'progreso' | 'niveles' | 'historial'
const TABS: { value: Tab; label: string }[] = [{ value: 'progreso', label: 'Progreso' }, { value: 'niveles', label: 'Niveles' }, { value: 'historial', label: 'Historial' }]

/** `/perfil/nivel`: tu nivel, tu progreso, los 100 niveles y el historial de tus planes (la racha se ve al tocarla en el perfil). */
export function LevelScreen() {
  const { state } = useApp()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab: Tab = (TABS.find((t) => t.value === params.get('tab'))?.value) ?? 'progreso'
  const setTab = (t: Tab) => setParams(t === 'progreso' ? {} : { tab: t }, { replace: true })
  const me = state.users.me!
  const lv = levelInfo(me.level)

  return (
    <div className="flex flex-col gap-4 px-[22px] pt-8 pb-10 lg:max-w-[940px] lg:p-0">
      <header className="flex items-center gap-3">
        <IconButton label="Volver al perfil" onClick={() => nav('/perfil')}><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></IconButton>
        <h1 className="text-h1 font-extrabold">Nivel {lv.level}</h1>
      </header>

      <div className="flex items-center gap-4 rounded-lg border border-line p-3.5" style={{ background: lv.soft }}>
        <LevelBadge level={lv.level} size={88} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-caption font-bold text-text">{lv.tierName} · {lv.level} de {MAX_LEVEL}</span>
          <h2 className="text-h3 font-extrabold text-ink">{lv.name}</h2>
          <p className="text-caption leading-snug text-text">{lv.blurb}</p>
        </div>
      </div>

      <Tabs<Tab> base="nivel" label="Tu nivel" value={tab} onChange={setTab} tabs={TABS} />

      <div role="tabpanel" id={panelId('nivel', tab)} aria-labelledby={tabId('nivel', tab)}>
        {tab === 'progreso' && <Progress onHistory={() => setTab('historial')} />}
        {tab === 'niveles' && <AllLevels mine={me.level} />}
        {tab === 'historial' && <History />}
      </div>
    </div>
  )
}

function Progress({ onHistory }: { onHistory: () => void }) {
  const { state } = useApp()
  const me = state.users.me!
  const lv = levelInfo(me.level)
  const next = lv.isMax ? null : levelInfo(me.level + 1)
  const jalesLeft = Math.ceil((state.xpGoal - state.xp) / 20)
  const latest = byRecent(state.history).slice(0, 3)
  return (
    <div className="flex flex-col gap-3.5">
      <section aria-label="Progreso" className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3.5">
        {next ? (
          <>
            <div className="flex items-center gap-3">
              <LevelBadge level={next.level} size={52} locked />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-caption font-bold text-muted">Siguiente nivel</span>
                <span className="text-[15px] font-extrabold">Nivel {next.level} · {next.name}</span>
              </div>
            </div>
            <div className="flex justify-between gap-2 text-caption font-bold"><span>{state.xp} / {state.xpGoal} XP</span><span className="text-muted">{jalesLeft} jales más</span></div>
            <ProgressBar value={(state.xp / state.xpGoal) * 100} label={`Progreso al nivel ${next.level}`} />
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm font-bold"><Crown aria-hidden="true" size={18} />Nivel máximo alcanzado. ¡Llegaste a lo más alto!</p>
        )}
      </section>

      <ul aria-label="Tu actividad" className="grid grid-cols-2 gap-2">
        {[['Jales', String(me.hangouts)], ['Eventos', String(me.eventsCount)]].map(([label, value]) => (
          <li key={label} className="flex flex-col rounded-lg border border-line bg-surface px-3 py-2.5">
            <span className="text-h2 font-extrabold">{value}</span>
            <span className="text-caption font-bold text-muted">{label}</span>
          </li>
        ))}
      </ul>

      <section aria-label="Últimos planes" className="flex flex-col gap-2">
        <h2 className="text-meta font-bold">Últimos planes</h2>
        {latest.length === 0 ? <EmptyHistory /> : (
          <ul className="flex flex-col gap-2">{latest.map((h) => <HistoryRow key={h.id} item={h} />)}</ul>
        )}
        {state.history.length > latest.length && <Button variant="secondary" full onClick={onHistory}>Ver historial ({state.history.length})</Button>}
      </section>
    </div>
  )
}

function AllLevels({ mine }: { mine: number }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-normal text-text">Cada nivel tiene su nombre, su color y su insignia. El nivel {MAX_LEVEL} es el máximo.</p>
      {TIERS.map((t, ti) => {
        const from = ti * TIER_SIZE + 1
        const id = `tier-${ti}`
        return (
          <section key={t.name} aria-labelledby={id} className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <h2 id={id} className="text-h3 font-extrabold">{t.name} · niveles {from}–{from + TIER_SIZE - 1}</h2>
              <p className="text-caption text-muted">{t.blurb}</p>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: TIER_SIZE }, (_, i) => from + i).map((n) => {
                const status = n === mine ? 'tu nivel' : n < mine ? 'alcanzado' : 'por alcanzar'
                return (
                  <li
                    key={n} aria-current={n === mine ? 'true' : undefined}
                    className={cn('flex items-center gap-2.5 rounded-lg border bg-surface p-2.5', n === mine ? 'border-2 border-primary shadow-md' : n > mine ? 'border-dashed border-line-dashed' : 'border-line')}
                  >
                    <LevelBadge level={n} size={52} locked={n > mine} />
                    <div className="flex min-w-0 flex-col">
                      <span className={cn('text-meta font-extrabold', n > mine && 'text-muted')}>Nivel {n}{n === MAX_LEVEL ? ' · máximo' : ''}</span>
                      <span className={cn('text-caption font-semibold', n > mine ? 'text-muted' : 'text-text')}>{levelInfo(n).name}</span>
                      <span className="sr-only">({status})</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function EmptyHistory() {
  return (
    <p className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-3 text-sm text-muted">
      Aún no has ido a ningún plan. Cuando tú y un amigo confirmen "Ya nos vimos", aparece aquí. <Link to="/" className="font-bold text-primary">Buscar un plan</Link>
    </p>
  )
}

/** Historial privado de tus planes y eventos: solo tú lo ves. */
function History() {
  const { state } = useApp()
  const list = byRecent(state.history)
  if (list.length === 0) return <EmptyHistory />
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold">{list.length} {list.length === 1 ? 'plan' : 'planes'} en tu historial</p>
      <ul aria-label="Historial de planes" className="flex flex-col gap-2">{list.map((h) => <HistoryRow key={h.id} item={h} />)}</ul>
      <p className="text-caption text-muted">Solo tú ves este historial.</p>
    </div>
  )
}
