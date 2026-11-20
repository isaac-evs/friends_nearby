import { parseWall } from '@/lib/tz'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { Button, CardBody, EmptyState, Field, ImageUpload, Toggle, useToast } from '@/design'
import { useActions, useApp, useMe, type EventDraft } from '@/app/store'
import { PlacePicker, type PlaceValue } from './PlacePicker'
import { api } from '@/api/client'
import { CUSTOM_EVENT_COLORS, CUSTOM_EVENT_ICONS, EVENT_TYPES, eventLook, type CustomEventColor, type CustomEventIcon } from '@/lib/category'
import type { EventType } from '@/api/schemas'
import { weekdayLong, dayNumber, monthShortUpper } from '@/lib/format'
import { PublishTabs } from './PublishTabs'
import { PreviewBanner } from './PreviewBanner'
import { InvitePicker } from './InvitePicker'
import { LateJoinRow } from './LateJoinRow'
import { commitmentsOf, findConflict } from '@/lib/commitments'
import { dayStr, eventTimes } from '@/lib/planTime'
import { cn } from '@/lib/cn'

const XP_NOTE = '+60 XP al organizar · +5 XP por cada persona que se una · +5 más si asisten'

/** Pantalla 12: Crear evento con vista previa en vivo. */
export function CreateEventScreen() {
  const { state } = useApp()
  const { publishEvent } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const d = undefined as EventDraft | undefined // sin borradores: cada evento empieza en blanco
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
  const [capacity, setCapacity] = useState('30')
  const [customLabel, setCustomLabel] = useState('')
  const [customIcon, setCustomIcon] = useState<CustomEventIcon>('star')
  const [customColor, setCustomColor] = useState<CustomEventColor>('estudiar')
  const cap = Math.min(200, Math.max(2, Math.round(Number(capacity)) || 0))
  const [approve, setApprove] = useState(d?.requiresApproval ?? true)
  const [description, setDescription] = useState(d?.description ?? '')
  const [chatOn, setChatOn] = useState(d?.chatEnabled ?? false)
  const verification = 'none' as const // sin QR: la llegada se verifica con el check-in por ubicación
  const [errors, setErrors] = useState<{ capacity?: string; title?: string; place?: string; when?: string; end?: string; conflict?: string }>({})

  // Los eventos son públicos: sin modo abierto no hay opción de crearlos (se vuelve a Plan rápido).
  const blocked = !state.openMode.enabled
  const dayMs = parseWall(date, time || '00:00')
  const dayIso = new Date(dayMs ?? Date.now()).toISOString()
  const t = eventLook({ type, typeIcon: customIcon, typeColor: customColor })
  const typeName = type === 'otro' && customLabel.trim() ? customLabel.trim() : t.label

  const draft = (): EventDraft => ({ type, title, date, time, endTime, place: place.name, placeCenter: place.center, lateJoin, inviteIds: invites, alias, photoUrl: photo, capacity: cap, customLabel: customLabel.trim(), customIcon, customColor, requiresApproval: approve, verification, description, chatEnabled: chatOn })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!(Number(capacity) >= 2 && Number(capacity) <= 200)) next.capacity = 'El cupo va de 2 a 200 personas.'
    if (title.trim().length < 3) next.title = 'Ponle un nombre al evento (mínimo 3 letras).'
    if (place.name.trim().length < 3) next.place = 'Escribe cómo se llama el lugar.'
    else if (!place.center) next.place = 'Márcalo en el mapa para que la gente sepa dónde es.'
    const start = parseWall(date, time)
    if (!date || !time || start === null) next.when = 'Elige la fecha y la hora de inicio.'
    else if (start < Date.now()) next.when = 'Elige una fecha y hora que no hayan pasado.'
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

  // Todos los eventos piden el modo abierto: sin él se queda aquí (con el selector) y se ofrece activarlo.
  if (blocked) return (
    <div className="flex flex-1 flex-col gap-4 px-[22px] pt-9 pb-[104px] lg:p-0">
      <PublishTabs />
      <EmptyState icon={<Globe aria-hidden="true" size={30} />} title="Los eventos piden el modo abierto" text="Son públicos y solo para personas adultas. Tú decides qué ven los demás y puedes apagarlo cuando quieras.">
        <Link to="/modo-abierto" className="flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white">Activar modo abierto</Link>
      </EmptyState>
    </div>
  )

  return (
    <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4 px-[22px] pt-9 pb-[104px] lg:grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:content-start lg:items-start lg:gap-x-16 lg:p-0">
      <div className="lg:col-start-1"><PublishTabs /></div>
      <h1 className="text-[30px] font-extrabold tracking-[-0.8px] lg:col-start-1">Crear evento</h1>

      <PreviewBanner
        label="Vista previa del evento" tileClass={t.tile} icon={t.icon({ size: 30, strokeWidth: 1.8 })} photoUrl={photo}
        kicker={`${typeName} · ${weekdayLong(dayIso)} ${dayNumber(dayIso)} ${monthShortUpper(dayIso).toLowerCase()} · ${time}`}
        title={title.trim() || 'Nombre del evento'} meta={`${place.name.trim() || 'Elige el lugar'} · cupo ${cap}`}
      />
      <p className="rounded-lg border border-line bg-cat-comer px-3.5 py-2.5 text-caption leading-snug font-bold text-ink lg:hidden">{XP_NOTE}</p>
      <aside aria-label="Vista previa" className="sticky top-8 hidden flex-col gap-3 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:flex">
        <h2 className="text-h3 font-extrabold">Así lo verá la gente</h2>
        <div aria-hidden="true" className="flex h-[410px] w-[340px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <CardBody
            variant="event" photoUrl={photo} tileClass={t.tile} icon={t.icon({ size: 72, strokeWidth: 1.5 })} category={typeName} xp="+40 XP"
            organizer={alias.trim() ? `${alias.trim()} · por ${me.name}` : `Por ${me.name}`} verified={false} title={title.trim() || 'Nombre del evento'}
            day={dayNumber(dayIso)} month={monthShortUpper(dayIso)} when={`${weekdayLong(dayIso)} · ${time}–${endTime} h`}
            place={place.name.trim() || 'Elige el lugar'} going={1} capacity={cap}
          />
        </div>
        <p className="max-w-[340px] rounded-lg border border-line bg-cat-comer px-3.5 py-2.5 text-caption leading-snug font-bold text-ink">{XP_NOTE}</p>
      </aside>

      <div className="flex flex-col gap-5 lg:col-start-1">
      <fieldset>
        <legend className="mb-2.5 text-sm font-bold">¿Qué tipo de evento es?</legend>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(EVENT_TYPES) as EventType[]).filter((k) => k !== 'correr').map((k) => (
            <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}
              className={cn('flex h-[68px] flex-col items-center justify-center gap-[5px] rounded-lg border bg-surface text-caption font-semibold text-ink', type === k ? 'border-primary ring-2 ring-primary' : 'border-line')}>
              <span aria-hidden="true" className={cn('flex size-[30px] items-center justify-center rounded-sm', EVENT_TYPES[k].tile)}>{EVENT_TYPES[k].icon({ size: 18, strokeWidth: 2 })}</span>
              {EVENT_TYPES[k].label}
            </button>
          ))}
        </div>
        {type === 'otro' && (
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
            <Field label="Nombre del tipo (solo para este evento)" maxLength={20} placeholder="Karaoke" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Ícono</legend>
              <div className="grid grid-cols-8 gap-1.5">
                {(Object.keys(CUSTOM_EVENT_ICONS) as CustomEventIcon[]).map((k) => (
                  <button key={k} type="button" aria-pressed={customIcon === k} aria-label={CUSTOM_EVENT_ICONS[k].label} onClick={() => setCustomIcon(k)}
                    className={cn('flex size-11 items-center justify-center rounded-md border text-ink', t.tile, customIcon === k ? 'border-primary ring-2 ring-primary' : 'border-line')}>
                    {CUSTOM_EVENT_ICONS[k].icon({ size: 20, strokeWidth: 2 })}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Color</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CUSTOM_EVENT_COLORS) as CustomEventColor[]).map((k) => (
                  <button key={k} type="button" aria-pressed={customColor === k} aria-label={CUSTOM_EVENT_COLORS[k].label} onClick={() => setCustomColor(k)}
                    className={cn('size-11 rounded-md border', CUSTOM_EVENT_COLORS[k].tile, customColor === k ? 'border-primary ring-2 ring-primary' : 'border-line')} />
                ))}
              </div>
            </fieldset>
          </div>
        )}
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

      <Field
        label="Cupo" type="number" inputMode="numeric" min={2} max={200} value={capacity} error={errors.capacity}
        onChange={(e) => { setCapacity(e.target.value); setErrors((x) => ({ ...x, capacity: undefined })) }}
        hint="Máximo de personas (de 2 a 200). Escríbelo directo."
      />

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

      <Button type="submit" size="lg" full className="lg:col-start-1">Publicar evento</Button>
    </form>
  )
}
