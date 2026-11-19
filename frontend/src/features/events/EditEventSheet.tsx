import { useState } from 'react'
import { Button, Field, ModalSheet, Toggle, useToast } from '@/design'
import { useActions } from '@/app/store'
import type { Event } from '@/api/schemas'

const pad = (n: number) => String(n).padStart(2, '0')
const dateOf = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const timeOf = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

/** Editar tu evento: nombre, descripción, fecha y horas, cupo y quién entra. El cupo no puede quedar por debajo de quienes ya van. */
export function EditEventSheet({ ev, onClose }: { ev: Event | null; onClose: () => void }) {
  return (
    <ModalSheet open={!!ev} title="Editar evento" onClose={onClose}>
      {ev && <Form key={ev.id} ev={ev} onClose={onClose} />}
    </ModalSheet>
  )
}

function Form({ ev, onClose }: { ev: Event; onClose: () => void }) {
  const { updateEvent } = useActions()
  const toast = useToast()
  const [title, setTitle] = useState(ev.title)
  const [description, setDescription] = useState(ev.description ?? '')
  const [date, setDate] = useState(dateOf(ev.startsAt))
  const [time, setTime] = useState(timeOf(ev.startsAt))
  const [endTime, setEndTime] = useState(timeOf(ev.endsAt))
  const [capacity, setCapacity] = useState(ev.capacity)
  const [lateJoin, setLateJoin] = useState(ev.lateJoin)
  const [approve, setApprove] = useState(ev.requiresApproval)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const save = async () => {
    if (title.trim().length < 3) { setError('Ponle un nombre al evento (mínimo 3 letras).'); return }
    if (capacity < Math.max(2, ev.going)) { setError(`El cupo no puede ser menor que quienes ya van (${ev.going}).`); return }
    setError(undefined); setLoading(true)
    const ok = await updateEvent(ev.id, { title, description, date, time, endTime, capacity, lateJoin, requiresApproval: approve, placeName: ev.placeName, center: ev.center })
    setLoading(false)
    if (ok) { toast('Evento actualizado'); onClose() }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Nombre del evento" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ev-desc" className="text-meta font-bold">Descripción</label>
        <textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={4} placeholder="Qué se va a hacer, qué llevar, a quién va dirigido…" className="w-full resize-none rounded-md border border-line-input bg-surface px-4 py-3 text-base leading-snug placeholder:text-placeholder" />
        <span className="text-caption text-muted">{description.length}/1000</span>
      </div>
      <Field label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Empieza" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <Field label="Termina" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} hint="Si es menor, termina al día siguiente." />
      </div>
      <Field label="Cupo" type="number" inputMode="numeric" min={Math.max(2, ev.going)} max={200} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
      <div className="flex min-h-[56px] items-center gap-3"><span className="flex flex-1 flex-col"><span className="text-sm font-bold">Se puede unir ya empezado</span></span><Toggle checked={lateJoin} onChange={setLateJoin} label="Se puede unir ya empezado" /></div>
      <div className="flex min-h-[56px] items-center gap-3"><span className="flex flex-1 flex-col"><span className="text-sm font-bold">Aprobar a cada persona</span></span><Toggle checked={approve} onChange={setApprove} label="Aprobar a cada persona" /></div>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button loading={loading} onClick={save}>Guardar cambios</Button>
      </div>
    </div>
  )
}
