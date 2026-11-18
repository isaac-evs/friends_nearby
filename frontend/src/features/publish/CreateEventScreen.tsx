import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { Button, DateBadge, Field, Notice, Pill, SegmentedControl, Toggle, useToast } from '@/design'
import { useActions, useApp, type EventDraft } from '@/app/store'
import { EVENT_TYPES } from '@/lib/category'
import type { EventAudience, EventType } from '@/api/schemas'
import { weekdayLong, weekdayShort, dayNumber, monthShortUpper } from '@/lib/format'
import { cn } from '@/lib/cn'

const TIMES = ['9:00 am', '1:00 pm', '5:00 pm', '8:00 pm']
const AUD_LABEL: Record<EventAudience, string> = { amigos: 'Amigos', 'amigos+': 'Amigos +', abierto: 'Abierto' }

/** Pantalla 12: Crear evento con vista previa en vivo. */
export function CreateEventScreen() {
  const { state } = useApp()
  const { publishEvent, saveDraft } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const d = state.eventDraft
  const [type, setType] = useState<EventType>(d?.type ?? 'juegos')
  const [title, setTitle] = useState(d?.title ?? '')
  const [dayOffset, setDayOffset] = useState(d?.dayOffset ?? 2)
  const [time, setTime] = useState(d?.time ?? '5:00 pm')
  const [place, setPlace] = useState(d?.place ?? '')
  const [capacity, setCapacity] = useState(d?.capacity ?? 30)
  const [aud, setAud] = useState<EventAudience>(d?.audience ?? (state.openMode.enabled ? 'abierto' : 'amigos'))
  const [approve, setApprove] = useState(d?.requiresApproval ?? true)
  const [errors, setErrors] = useState<{ title?: string; place?: string }>({})

  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    const dt = new Date(); dt.setDate(dt.getDate() + i + 1)
    return { offset: i + 1, iso: dt.toISOString() }
  }), [])
  const dayIso = days.find((x) => x.offset === dayOffset)?.iso ?? days[0]!.iso
  const t = EVENT_TYPES[type]
  const blocked = aud === 'abierto' && !state.openMode.enabled

  const draft = (): EventDraft => ({ type, title, dayOffset, time, place, capacity, audience: aud, requiresApproval: approve })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (title.trim().length < 3) next.title = 'Ponle un nombre al evento (mínimo 3 letras).'
    if (place.trim().length < 3) next.place = 'Dinos el lugar público (parque, plaza, café, cancha).'
    setErrors(next)
    if (Object.keys(next).length || blocked) return
    const ev = publishEvent(draft())
    toast('Evento publicado')
    nav(`/evento/${ev.id}`)
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-5 px-5 pt-[34px] lg:grid lg:grid-cols-[minmax(0,620px)_360px] lg:content-start lg:items-start lg:gap-x-16 lg:p-0">
      <div className="flex items-center gap-3 lg:col-span-2">
        <Link to="/publicar" aria-label="Volver" className="flex size-11 flex-none items-center justify-center rounded-full border border-line bg-surface shadow-sm"><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></Link>
        <h1 className="flex-1 text-2xl font-extrabold tracking-[-0.6px]">Crear evento</h1>
        <Pill tone="accent" className="py-[5px]">+60 XP al organizar</Pill>
      </div>

      <section aria-label="Vista previa" className="overflow-hidden rounded-xl border border-line bg-surface shadow-lg lg:sticky lg:top-8 lg:col-start-2 lg:row-start-2 lg:row-span-1">
        <div className={cn('relative flex h-[110px] items-center justify-center', t.tile)}>
          <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-caption font-bold">{t.label} · {AUD_LABEL[aud]}</span>
          <DateBadge small day={dayNumber(dayIso)} month={monthShortUpper(dayIso)} className="absolute bottom-3 left-3" />
          <span className="rounded-full bg-white/70 px-2.5 py-1 text-caption font-semibold text-text">{aud === 'abierto' ? 'Así se verá en Abierto' : 'Así lo verán tus amigos'}</span>
        </div>
        <div className="flex flex-col gap-1 px-3.5 pt-3 pb-3.5">
          <span className="text-h3 font-extrabold">{title.trim() || 'Nombre del evento'}</span>
          <span className="text-caption font-medium text-muted">{weekdayLong(dayIso)} · {time} · {place.trim() || 'Lugar público'} · cupo {capacity}</span>
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

      <fieldset>
        <legend className="mb-2.5 text-sm font-bold">¿Cuándo?</legend>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {days.map((x) => (
            <button key={x.offset} type="button" aria-pressed={dayOffset === x.offset} onClick={() => setDayOffset(x.offset)}
              className={cn('flex h-[66px] w-[58px] flex-none flex-col items-center justify-center gap-0.5 rounded-lg border', dayOffset === x.offset ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink')}>
              <span className="text-[11px] font-semibold">{weekdayShort(x.iso)}</span>
              <span className="text-xl font-extrabold">{dayNumber(x.iso)}</span>
            </button>
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-2">
          {TIMES.map((h) => (
            <button key={h} type="button" aria-pressed={time === h} onClick={() => setTime(h)}
              className={cn('h-11 rounded-[12px] border text-meta font-semibold', time === h ? 'border-primary bg-primary-soft text-primary-hover' : 'border-line bg-surface text-text')}>
              {h}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="¿Dónde?" icon={<MapPin aria-hidden="true" size={18} />} placeholder="Parque Metropolitano" value={place} onChange={(e) => { setPlace(e.target.value); setErrors((x) => ({ ...x, place: undefined })) }}
        hint="Solo lugares públicos: parques, plazas, cafés, canchas." error={errors.place} />

      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface py-2.5 pr-2.5 pl-4">
        <span className="flex flex-col"><span className="text-sm font-bold">Cupo</span><span className="text-caption font-medium text-muted">Máximo de personas</span></span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Menos cupo" onClick={() => setCapacity((c) => Math.max(2, c - 2))} className="size-11 rounded-[12px] border border-line bg-bg text-xl font-bold">−</button>
          <span aria-live="polite" className="w-11 text-center text-lg font-extrabold">{capacity}</span>
          <button type="button" aria-label="Más cupo" onClick={() => setCapacity((c) => Math.min(200, c + 2))} className="size-11 rounded-[12px] border border-line bg-bg text-xl font-bold">+</button>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2.5 text-sm font-bold">¿Quién puede unirse?</legend>
        <SegmentedControl<EventAudience> label="Quién puede unirse" value={aud} onChange={setAud}
          options={(Object.keys(AUD_LABEL) as EventAudience[]).map((v) => ({ value: v, label: AUD_LABEL[v] }))} />
      </fieldset>

      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface py-1.5 pr-2.5 pl-4">
        <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Aprobar a cada persona</span><span className="text-caption font-medium text-muted">Tú decides quién entra antes de compartir detalles</span></span>
        <Toggle checked={approve} onChange={setApprove} label="Aprobar a cada persona" />
      </div>

      {blocked && <Notice tone="warning" icon="lock" role="alert">Para publicar un evento abierto primero activa el <Link to="/modo-abierto" className="underline">modo abierto</Link>.</Notice>}

      </div>

      <div className="sticky bottom-0 z-30 -mx-5 mt-auto grid grid-cols-[1fr_1.6fr] gap-2.5 border-t border-line bg-surface px-5 pt-3.5 pb-6 lg:col-span-2 lg:mx-0 lg:mt-4 lg:max-w-[620px] lg:rounded-xl lg:border lg:px-4 lg:pb-3.5 lg:shadow-lg">
        <Button variant="secondary" pill size="md" onClick={() => { saveDraft(draft()); toast('Borrador guardado') }}>Guardar borrador</Button>
        <Button type="submit" pill size="md" disabled={blocked} className="shadow-primary">Publicar evento</Button>
      </div>
    </form>
  )
}
