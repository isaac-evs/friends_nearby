import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, DateBadge, Field, ImageUpload, Pill, Toggle, useToast } from '@/design'
import { useActions, useApp, useMe, type EventDraft } from '@/app/store'
import { PlacePicker, type PlaceValue } from './PlacePicker'
import { api } from '@/api/client'
import { EVENT_TYPES } from '@/lib/category'
import type { EventType } from '@/api/schemas'
import { weekdayLong, dayNumber, monthShortUpper } from '@/lib/format'
import { InvitePicker } from './InvitePicker'
import { LateJoinRow } from './LateJoinRow'
import { commitmentsOf, findConflict } from '@/lib/commitments'
import { dayStr, eventTimes } from '@/lib/planTime'
import { cn } from '@/lib/cn'

/** Pantalla 12: Crear evento con vista previa en vivo. */
export function CreateEventScreen() {
  const { state } = useApp()
  const { publishEvent, saveDraft } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const d = state.eventDraft
  const [type, setType] = useState<EventType>(d?.type ?? 'juegos')
  const [title, setTitle] = useState(d?.title ?? '')
  const [date, setDate] = useState(d?.date ?? dayStr(2))
  const [time, setTime] = useState(d?.time ?? '17:00')
  const [endTime, setEndTime] = useState(d?.endTime ?? '19:00')
  const [lateJoin, setLateJoin] = useState(d?.lateJoin ?? true)
  const [invites, setInvites] = useState<string[]>(d?.inviteIds ?? [])
  const [place, setPlace] = useState<PlaceValue>({ name: d?.place ?? '', center: d?.placeCenter })
  const [alias, setAlias] = useState(d?.alias ?? '')
  const [photo, setPhoto] = useState<string | undefined>(d?.photoUrl)
  const me = useMe()
  const [capacity, setCapacity] = useState(d?.capacity ?? 30)
  const [approve, setApprove] = useState(d?.requiresApproval ?? true)
  const [description, setDescription] = useState(d?.description ?? '')
  const [chatOn, setChatOn] = useState(d?.chatEnabled ?? false)
  const verification = 'none' as const // sin QR: la llegada se verifica con el check-in por ubicación
  const [errors, setErrors] = useState<{ title?: string; place?: string; when?: string; end?: string; conflict?: string }>({})

  // Los eventos son públicos: sin modo abierto no hay opción de crearlos (se vuelve a Plan rápido).
  const blocked = !state.openMode.enabled
  const dayIso = new Date(`${date}T${time || '00:00'}:00`).toISOString()
  const t = EVENT_TYPES[type]

  const draft = (): EventDraft => ({ type, title, date, time, endTime, place: place.name, placeCenter: place.center, lateJoin, inviteIds: invites, alias, photoUrl: photo, capacity, requiresApproval: approve, verification, description, chatEnabled: chatOn })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (title.trim().length < 3) next.title = 'Ponle un nombre al evento (mínimo 3 letras).'
    if (place.name.trim().length < 3) next.place = 'Escribe cómo se llama el lugar.'
    else if (!place.center) next.place = 'Márcalo en el mapa para que la gente sepa dónde es.'
    const start = new Date(`${date}T${time}:00`)
    if (!date || !time || Number.isNaN(start.getTime())) next.when = 'Elige la fecha y la hora de inicio.'
    else if (start.getTime() < Date.now()) next.when = 'Elige una fecha y hora que no hayan pasado.'
    if (!endTime) next.end = 'Elige a qué hora termina.'
    if (!next.when && !next.end) {
      const times = eventTimes(date, time, endTime)
      const c = times && findConflict(commitmentsOf(state), times)
      if (c) next.conflict = `Ya tienes "${c.title}" a esa hora. Solo puedes tener un plan o evento a la vez: cambia la fecha o las horas.`
    }
    setErrors(next)
    if (Object.keys(next).length || blocked) return
    const ev = await publishEvent(draft())
    if (!ev) { setErrors({ conflict: 'No pudimos publicar el evento. Revisa la fecha y la hora.' }); return }
    toast(invites.length ? `Evento publicado · invitaste a ${invites.length}` : 'Evento publicado')
    nav(`/evento/${ev.id}`)
  }

  // Todos los eventos piden el modo abierto: sin él te llevamos a activarlo primero.
  if (blocked) return <Navigate to="/modo-abierto" replace />

  return (
    <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-5 px-5 pt-[34px] lg:grid lg:grid-cols-[minmax(0,620px)_360px] lg:content-start lg:items-start lg:gap-x-16 lg:p-0">
      <div className="flex items-center gap-3 lg:col-span-2">
        <Link to="/publicar" aria-label="Volver" className="flex size-11 flex-none items-center justify-center rounded-full"><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></Link>
        <h1 className="flex-1 text-2xl font-extrabold tracking-[-0.6px]">Crear evento</h1>
        <Pill tone="accent" className="py-[5px]">+60 XP al organizar</Pill>
      </div>

      <section aria-label="Vista previa" className="overflow-hidden rounded-xl border border-line bg-surface shadow-lg lg:sticky lg:top-8 lg:col-start-2 lg:row-start-2 lg:row-span-1">
        <div className={cn('relative flex h-[110px] items-center justify-center', t.tile)}>
          <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-caption font-bold">{t.label} · Público</span>
          <DateBadge small day={dayNumber(dayIso)} month={monthShortUpper(dayIso)} className="absolute bottom-3 left-3" />
          <span className="rounded-full bg-white/70 px-2.5 py-1 text-caption font-semibold text-text">Así se verá en Abierto</span>
        </div>
        <div className="flex flex-col gap-1 px-3.5 pt-3 pb-3.5">
          <span className="text-h3 font-extrabold">{title.trim() || 'Nombre del evento'}</span>
          <span className="text-caption font-medium text-muted">{weekdayLong(dayIso)} · {time}–{endTime} h · {place.name.trim() || 'Lugar'} · cupo {capacity}</span>
          <span className="text-caption font-semibold text-text">{alias.trim() ? `${alias.trim()} · por ${me.name}` : `Por ${me.name}`}</span>
        </div>
      </section>

      <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-2">
      <fieldset>
        <legend className="mb-2.5 text-sm font-bold">¿Qué tipo de evento es?</legend>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(EVENT_TYPES) as EventType[]).map((k) => (
            <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}
              className={cn('flex h-[68px] flex-col items-center justify-center gap-[5px] rounded-lg border bg-surface text-caption font-semibold text-ink', type === k ? 'border-primary ring-2 ring-primary' : 'border-line')}>
              <span aria-hidden="true" className={cn('flex size-[30px] items-center justify-center rounded-sm', EVENT_TYPES[k].tile)}>{EVENT_TYPES[k].icon({ size: 18, strokeWidth: 2 })}</span>
              {EVENT_TYPES[k].label}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Nombre del evento" maxLength={50} placeholder="Picnic y juegos de mesa" value={title} onChange={(e) => { setTitle(e.target.value); setErrors((x) => ({ ...x, title: undefined })) }} error={errors.title} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ev-desc" className="text-sm font-bold">Descripción <span className="font-medium text-muted">(opcional)</span></label>
        <textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={3} placeholder="Qué se va a hacer, qué llevar, a quién va dirigido…" className="w-full resize-none rounded-md border border-line-input bg-surface px-4 py-3 text-base leading-snug placeholder:text-placeholder" />
        <span className="text-caption text-muted">{description.length}/1000</span>
      </div>

      <fieldset>
        <legend className="mb-2.5 text-sm font-bold">¿Cuándo?</legend>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Fecha" type="date" value={date} min={dayStr(0)} max={dayStr(365)} onChange={(e) => { setDate(e.target.value); setErrors((x) => ({ ...x, when: undefined, conflict: undefined })) }} />
          <Field label="Hora de inicio" type="time" value={time} onChange={(e) => { setTime(e.target.value); setErrors((x) => ({ ...x, when: undefined, conflict: undefined })) }} />
        </div>
        {errors.when && <p role="alert" className="mt-1.5 text-caption font-medium text-danger">{errors.when}</p>}
      </fieldset>

      <Field
        label="Hora de fin" type="time" value={endTime} error={errors.end}
        onChange={(e) => { setEndTime(e.target.value); setErrors((x) => ({ ...x, end: undefined, conflict: undefined })) }}
        hint="Si es antes de la hora de inicio, el evento termina al día siguiente."
      />

      <PlacePicker
        label="¿Dónde?" placeholder="Parque Metropolitano" value={place} error={errors.place}
        onChange={(v) => { setPlace(v); setErrors((x) => ({ ...x, place: undefined })) }}
        hint="Escribe el nombre del lugar y márcalo en el mapa. Es el punto exacto que verá la gente."
      />

      <Field
        label="Alias del organizador (opcional)" maxLength={40} placeholder="Club de corredores" value={alias} onChange={(e) => setAlias(e.target.value)}
        hint={`Así se presenta el evento (por ejemplo, tu club). Tu nombre real, ${me.name}, siempre se muestra.`}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Foto del evento (opcional)</span>
        <ImageUpload
          kind="plan" label="Foto del evento" noun="foto" hintId="evt-photo-hint" value={photo} userId={me.id} name={me.name}
          upload={(b) => api.profile.uploadMedia('plan', b)} onChange={setPhoto} onRemove={() => setPhoto(undefined)}
        />
        <p id="evt-photo-hint" className="text-caption font-medium text-muted">JPG, PNG o WebP · hasta 5 MB. Quitamos los datos ocultos de la foto, como su ubicación.</p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface py-2.5 pr-2.5 pl-4">
        <span className="flex flex-col"><span className="text-sm font-bold">Cupo</span><span className="text-caption font-medium text-muted">Máximo de personas</span></span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Menos cupo" onClick={() => setCapacity((c) => Math.max(2, c - 2))} className="size-11 rounded-[12px] border border-line bg-bg text-xl font-bold">−</button>
          <span aria-live="polite" className="w-11 text-center text-lg font-extrabold">{capacity}</span>
          <button type="button" aria-label="Más cupo" onClick={() => setCapacity((c) => Math.min(200, c + 2))} className="size-11 rounded-[12px] border border-line bg-bg text-xl font-bold">+</button>
        </div>
      </div>

      <LateJoinRow noun="evento" value={lateJoin} onChange={setLateJoin} />

      <InvitePicker value={invites} onChange={setInvites} />

      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface py-1.5 pr-2.5 pl-4">
        <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Aprobar a cada persona</span><span className="text-caption font-medium text-muted">Tú decides quién entra antes de compartir detalles</span></span>
        <Toggle checked={approve} onChange={setApprove} label="Aprobar a cada persona" />
      </div>
      <div className="flex min-h-[56px] items-center gap-3">
        <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Chat del evento</span><span className="text-caption font-medium text-muted">Quienes van pueden escribir; tú puedes borrar mensajes y apagarlo cuando quieras.</span></span>
        <Toggle checked={chatOn} onChange={setChatOn} label="Chat del evento" />
      </div>

      {errors.conflict && <p role="alert" className="text-sm font-semibold text-danger">{errors.conflict}</p>}

      </div>

      <div className="sticky bottom-0 z-30 -mx-5 mt-auto grid grid-cols-[1fr_1.6fr] gap-2.5 border-t border-line bg-surface px-5 pt-3.5 pb-6 lg:col-span-2 lg:mx-0 lg:mt-4 lg:max-w-[620px] lg:rounded-xl lg:border lg:px-4 lg:pb-3.5 lg:shadow-lg">
        <Button variant="secondary" pill size="md" onClick={async () => { if (!await saveDraft(draft())) return; toast('Borrador guardado') }}>Guardar borrador</Button>
        <Button type="submit" pill size="md" className="shadow-primary">Publicar evento</Button>
      </div>
    </form>
  )
}
