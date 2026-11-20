import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, CardBody, Field, ImageUpload, Notice, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { PLAN_CATEGORIES } from '@/lib/category'
import type { JoinPolicy, PlanCategory } from '@/api/schemas'
import { cn } from '@/lib/cn'
import { useMe } from '@/app/store'
import { PublishTabs } from './PublishTabs'
import { PreviewBanner } from './PreviewBanner'
import { PlacePicker, type PlaceValue } from './PlacePicker'
import { InvitePicker } from './InvitePicker'
import { LateJoinRow } from './LateJoinRow'
import { commitmentsOf, findConflict } from '@/lib/commitments'
import { dayStr, dayTimeIso, durationText, timeTodayIso } from '@/lib/planTime'
import { api } from '@/api/client'

const DURATIONS = [{ l: '30 min', min: 30 }, { l: '1 h', min: 60 }, { l: '2 h', min: 120 }, { l: '3 h', min: 180 }, { l: 'Otra', min: 0 }]
const STARTS = [{ l: 'Ahora', after: 0 }, { l: 'En 30 min', after: 30 }, { l: 'En 1 h', after: 60 }, { l: 'Otra hora', after: -1 }, { l: 'Otro día', after: -2 }]
const JOIN_POLICIES: { v: JoinPolicy; l: string }[] = [{ v: 'friends', l: 'Tus amigos' }, { v: 'friends_and_guests', l: 'Amigos e invitados' }]

/** Pantalla 6: Publicar plan (tipo, línea, hora, duración, lugar exacto obligatorio, foto, límite, quién se puede unir). */
export function PublishScreen() {
  const { state } = useApp()
  const { publishPlan } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const [cat, setCat] = useState<PlanCategory>('cafe')
  const [line, setLine] = useState('')
  const [start, setStart] = useState('Ahora')
  const [customTime, setCustomTime] = useState('')
  const [customDate, setCustomDate] = useState(() => dayStr(1))
  const [dur, setDur] = useState('1 h')
  const [customDur, setCustomDur] = useState('90')
  const [place, setPlace] = useState<PlaceValue>({ name: '' })
  const [photo, setPhoto] = useState<string>()
  const [policy, setPolicy] = useState<JoinPolicy>('friends')
  const [capacity, setCapacity] = useState('')
  const [lateJoin, setLateJoin] = useState(true)
  // Desde la tarjeta de un amigo en el mapa: "Invitar a un plan" llega con esa persona ya elegida.
  const [params] = useSearchParams()
  const [invites, setInvites] = useState<string[]>(() => { const id = params.get('invitar'); return id && state.users[id] ? [id] : [] })
  const [errors, setErrors] = useState<{ line?: string; time?: string; dur?: string; place?: string; capacity?: string; conflict?: string }>({})
  const me = useMe()
  const catDef = PLAN_CATEGORIES[cat]

  const durationMin = dur === 'Otra' ? Number(customDur) : DURATIONS.find((x) => x.l === dur)!.min
  const durLabel = dur === 'Otra' ? durationText(Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 0) : dur

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (line.trim().length < 3) next.line = 'Cuéntales qué andas haciendo (mínimo 3 letras).'
    let startsAt = new Date().toISOString()
    const s = STARTS.find((x) => x.l === start)!
    if (s.after > 0) startsAt = new Date(Date.now() + s.after * 60_000).toISOString()
    if (s.after === -2) {
      const iso = dayTimeIso(customDate, customTime)
      if (!iso) next.time = 'Elige un día y una hora que no hayan pasado.'
      else startsAt = iso
    } else if (s.after < 0) {
      const iso = timeTodayIso(customTime)
      if (!iso) next.time = 'Elige una hora de hoy que no haya pasado.'
      else startsAt = iso
    }
    if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 480) next.dur = 'La duración va de 15 minutos a 8 horas.'
    if (!place.name.trim()) next.place = 'Escribe cómo se llama el lugar.'
    else if (!place.center) next.place = 'Márcalo en el mapa para que tus amigos sepan dónde es.'
    const cap = capacity.trim() === '' ? undefined : Number(capacity)
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 2 || cap > 100)) next.capacity = 'El límite va de 2 a 100 personas, o déjalo vacío.'
    // Solo un plan o evento a la vez.
    if (!next.time && !next.dur) {
      const c = findConflict(commitmentsOf(state), { startsAt, durationMin })
      if (c) next.conflict = `Ya tienes "${c.title}" a esa hora. Solo puedes tener un plan a la vez: cambia la hora o la duración.`
    }
    setErrors(next)
    if (Object.keys(next).length) return
    const made = await publishPlan({
      category: cat, line: line.trim(), startsAt, durationMin, joinPolicy: policy, capacity: cap, photoUrl: photo, lateJoin, inviteIds: invites,
      place: { name: place.name.trim(), address: place.address, center: place.center! },
    })
    if (!made) { setErrors({ conflict: 'No pudimos publicar el plan. Revisa la hora y el lugar.' }); return }
    toast(invites.length ? `Plan publicado · invitaste a ${invites.length}` : 'Plan publicado')
    nav('/')
  }

  const startsPreview = start === 'Ahora' ? `quedan ${durLabel}` : start === 'Otra hora' ? `hoy ${customTime || '—'}` : start === 'Otro día' ? `${customDate} ${customTime || '—'}` : start.toLowerCase()

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start lg:gap-16">
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 px-[22px] pt-9 pb-[104px] lg:p-0">
      <PublishTabs />
      {/* Vista previa que baja contigo mientras llenas el plan (en escritorio está a un lado). */}
      <PreviewBanner
        label="Vista previa del plan" tileClass={catDef.tile} icon={catDef.icon({ size: 30, strokeWidth: 1.8 })} photoUrl={photo}
        kicker={`${catDef.label} · ${startsPreview}`} title={line.trim() || '¿Qué andas haciendo?'} meta={`${place.name.trim() || 'Elige el lugar'} · por ${me.name}`}
      />
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[30px] font-extrabold tracking-[-0.8px]">¿Qué andas haciendo?</h1>
          <Link to="/planes" className="flex min-h-11 flex-none items-center text-sm font-bold text-primary">Mis planes</Link>
        </div>
        <p className="text-sm text-muted">Se verá como card y en el mapa.</p>
      </header>

      <fieldset>
        <legend className="mb-2 text-meta font-bold">Plan</legend>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(PLAN_CATEGORIES) as PlanCategory[]).map((k) => (
            <button
              key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}
              className={cn('h-11 rounded-md border border-line text-meta font-bold text-ink', cat === k ? `${PLAN_CATEGORIES[k].tile} shadow-md ring-2 ring-primary` : 'bg-surface')}
            >
              {PLAN_CATEGORIES[k].label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-meta font-bold">
        Cuéntales en una línea
        <input
          type="text" maxLength={60} value={line} placeholder="Por un café en Providencia, ¿alguien?" onChange={(e) => { setLine(e.target.value); setErrors((x) => ({ ...x, line: undefined })) }}
          aria-invalid={errors.line ? true : undefined} aria-describedby={errors.line ? 'line-error' : undefined}
          className={cn('h-[50px] rounded-md border bg-surface px-4 text-base font-semibold text-ink', errors.line ? 'border-danger' : 'border-line-input')}
        />
        {errors.line && <span id="line-error" role="alert" className="text-caption font-medium text-danger">{errors.line}</span>}
      </label>

      <fieldset>
        <legend className="mb-2 text-meta font-bold">¿Cuándo empieza?</legend>
        <div className="grid grid-cols-5 gap-1 rounded-lg border border-line bg-surface p-1">
          {STARTS.map((x) => (
            <button key={x.l} type="button" aria-pressed={start === x.l} onClick={() => { setStart(x.l); setErrors((e) => ({ ...e, time: undefined })) }}
              className={cn('h-11 rounded-[12px] px-0.5 text-[12px] leading-tight font-bold', start === x.l ? 'bg-primary text-white' : 'text-ink')}>
              {x.l}
            </button>
          ))}
        </div>
        {start === 'Otro día' && (
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            <Field label="Día" type="date" value={customDate} min={dayStr(0)} max={dayStr(365)} onChange={(e) => { setCustomDate(e.target.value); setErrors((x) => ({ ...x, time: undefined, conflict: undefined })) }} />
            <Field label="Hora de inicio" type="time" value={customTime} onChange={(e) => { setCustomTime(e.target.value); setErrors((x) => ({ ...x, time: undefined, conflict: undefined })) }} error={errors.time} />
          </div>
        )}
        {start === 'Otra hora' && (
          <Field className="mt-2" label="Hora de inicio (hoy)" type="time" value={customTime} onChange={(e) => { setCustomTime(e.target.value); setErrors((x) => ({ ...x, time: undefined })) }} error={errors.time} />
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-meta font-bold">¿Por cuánto tiempo?</legend>
        <div className="grid grid-cols-5 gap-1 rounded-lg border border-line bg-surface p-1">
          {DURATIONS.map((d) => (
            <button key={d.l} type="button" aria-pressed={dur === d.l} onClick={() => { setDur(d.l); setErrors((x) => ({ ...x, dur: undefined })) }}
              className={cn('h-11 rounded-[12px] text-[13px] font-bold', dur === d.l ? 'bg-primary text-white' : 'text-ink')}>
              {d.l}
            </button>
          ))}
        </div>
        {dur === 'Otra' && (
          <Field className="mt-2" label="Duración en minutos" type="number" inputMode="numeric" min={15} max={480} value={customDur} onChange={(e) => { setCustomDur(e.target.value); setErrors((x) => ({ ...x, dur: undefined })) }} error={errors.dur} />
        )}
        <p className="mt-1.5 text-caption text-muted">Puedes unirte a un plan mientras está en curso, hasta que termina.</p>
      </fieldset>

      <PlacePicker
        label="¿Dónde es?" placeholder="Café Ámbar" value={place} error={errors.place}
        onChange={(v) => { setPlace(v); setErrors((x) => ({ ...x, place: undefined })) }}
        hint="Escribe el nombre del lugar y márcalo en el mapa. Es el punto de encuentro exacto del plan."
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-meta font-bold">Foto del plan (opcional)</span>
        <ImageUpload
          kind="plan" label="Foto del plan" noun="foto" hintId="plan-photo-hint" value={photo} userId={me.id} name={me.name}
          upload={(b) => api.profile.uploadMedia('plan', b)} onChange={setPhoto} onRemove={() => setPhoto(undefined)}
        />
        <p id="plan-photo-hint" className="text-caption font-medium text-muted">JPG, PNG o WebP · hasta 5 MB. Quitamos los datos ocultos de la foto, como su ubicación.</p>
      </div>

      <Field
        label="Límite de personas (opcional)" type="number" inputMode="numeric" min={2} max={100} placeholder="Sin límite" value={capacity}
        onChange={(e) => { setCapacity(e.target.value); setErrors((x) => ({ ...x, capacity: undefined })) }} error={errors.capacity}
        hint="Cuando se llena, ya nadie más se puede unir."
      />

      <LateJoinRow noun="plan" value={lateJoin} onChange={setLateJoin} />

      <InvitePicker value={invites} onChange={setInvites} />

      <fieldset>
        <legend className="mb-2 text-meta font-bold">¿Quién se puede unir?</legend>
        <div className="grid grid-cols-2 gap-2">
          {JOIN_POLICIES.map((a) => (
            <button key={a.v} type="button" aria-pressed={policy === a.v} onClick={() => setPolicy(a.v)}
              className={cn('h-11 rounded-md border border-line text-meta font-bold text-ink', policy === a.v ? 'bg-cat-estudiar shadow-md' : 'bg-surface')}>
              {a.l}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-caption text-muted">
          {policy === 'friends'
            ? 'Solo tus amigos ven el plan y se pueden unir.'
            : 'Solo tus amigos ven el plan. Quienes van pueden invitar a sus propios amigos; ellos entran por la invitación y no salen en el mapa.'}
        </p>
      </fieldset>

      <Notice tone="privacy" icon="eye" title="El plan se ve en su lugar exacto">
        Es el punto de encuentro. Tu ubicación sigue aproximada.
      </Notice>
      {errors.conflict && <p role="alert" className="text-sm font-semibold text-danger">{errors.conflict}</p>}

      <Button type="submit" size="lg" full>Publicar plan · {durLabel}</Button>
    </form>

    <aside aria-label="Vista previa" className="sticky top-8 hidden flex-col gap-3 lg:flex">
      <h2 className="text-h3 font-extrabold">Así lo verán tus amigos</h2>
      <div aria-hidden="true" className="flex h-[410px] w-[340px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <CardBody
          variant="friend" photoUrl={photo} tileClass={catDef.tile} icon={catDef.icon({ size: 72, strokeWidth: 1.5 })} category={catDef.label}
          time={startsPreview} xp="+20 XP" person={{ id: me.id, name: me.name, avatarUrl: me.avatarUrl }}
          where={place.name.trim() ? place.name.trim() : 'Elige el lugar'} title={line.trim() || '¿Qué andas haciendo?'} chip="0 ya jalaron"
        />
      </div>
      <p className="max-w-[340px] text-meta text-muted">Se verá el lugar exacto del plan. Tu ubicación sigue siendo aproximada.</p>
    </aside>
    </div>
  )
}
