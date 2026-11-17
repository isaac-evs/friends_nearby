import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, CardBody, Notice, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { PLAN_CATEGORIES } from '@/lib/category'
import type { Audience, PlanCategory } from '@/api/schemas'
import { cn } from '@/lib/cn'
import { useMe } from '@/app/store'
import { PublishTabs } from './PublishTabs'

const DURATIONS = [{ l: '30 min', min: 30 }, { l: '1 h', min: 60 }, { l: '2 h', min: 120 }, { l: 'Hoy', min: 0 }]
const AUDIENCES: { v: Audience; l: string }[] = [{ v: 'amigos', l: 'Amigos' }, { v: 'roomies', l: 'Roomies' }, { v: 'abierto', l: 'Abierto' }]

function minutesUntilMidnight() {
  const end = new Date()
  end.setHours(23, 59, 0, 0)
  return Math.max(30, Math.round((end.getTime() - Date.now()) / 60_000))
}

/** Pantalla 6: Publicar plan rápido (categoría, línea, duración, audiencia). */
export function PublishScreen() {
  const { state } = useApp()
  const { publishPlan } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const [cat, setCat] = useState<PlanCategory>('cafe')
  const [line, setLine] = useState('')
  const [dur, setDur] = useState('1 h')
  const [aud, setAud] = useState<Audience>('amigos')
  const [error, setError] = useState<string | null>(null)
  const open = aud === 'abierto'
  const blocked = open && !state.openMode.enabled
  const me = useMe()
  const catDef = PLAN_CATEGORIES[cat]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (line.trim().length < 3) { setError('Cuéntales qué andas haciendo (mínimo 3 letras).'); return }
    if (blocked) return
    const d = DURATIONS.find((x) => x.l === dur)!
    publishPlan({ category: cat, line: line.trim(), durationMin: d.min || minutesUntilMidnight(), audience: aud })
    toast('Plan publicado')
    nav('/')
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start lg:gap-16">
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 px-[22px] pt-9 pb-[104px] lg:p-0">
      <PublishTabs />
      <header className="flex flex-col gap-1">
        <h1 className="text-[30px] font-extrabold tracking-[-0.8px]">¿Qué andas haciendo?</h1>
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
          type="text" maxLength={60} value={line} placeholder="Por un café en Providencia, ¿alguien?" onChange={(e) => { setLine(e.target.value); setError(null) }}
          aria-invalid={error ? true : undefined} aria-describedby={error ? 'line-error' : undefined}
          className={cn('h-[50px] rounded-md border bg-surface px-4 text-base font-semibold text-ink', error ? 'border-danger' : 'border-line-input')}
        />
        {error && <span id="line-error" role="alert" className="text-caption font-medium text-danger">{error}</span>}
      </label>

      <fieldset>
        <legend className="mb-2 text-meta font-bold">¿Por cuánto tiempo?</legend>
        <div className="grid grid-cols-4 gap-1 rounded-lg border border-line bg-surface p-1">
          {DURATIONS.map((d) => (
            <button key={d.l} type="button" aria-pressed={dur === d.l} onClick={() => setDur(d.l)}
              className={cn('h-[38px] rounded-[12px] text-sm font-bold', dur === d.l ? 'bg-primary text-white' : 'text-ink')}>
              {d.l}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-meta font-bold">¿Quién lo ve?</legend>
        <div className="grid grid-cols-3 gap-2">
          {AUDIENCES.map((a) => (
            <button key={a.v} type="button" aria-pressed={aud === a.v} onClick={() => setAud(a.v)}
              className={cn('h-11 rounded-md border border-line text-meta font-bold text-ink', aud === a.v ? `${a.v === 'abierto' ? 'bg-accent' : 'bg-cat-estudiar'} shadow-md` : 'bg-surface')}>
              {a.l}
            </button>
          ))}
        </div>
      </fieldset>

      {open ? (
        <Notice tone="safety" icon="shield">
          Evento abierto: solo en lugar público. Gente nueva ve tu nombre, nunca tu ubicación, y tú apruebas quién entra.
        </Notice>
      ) : (
        <Notice tone="privacy" icon="eye">Se verá como a ~800 m · {state.location.zoneName}. Tu punto exacto solo al hacer match.</Notice>
      )}
      {blocked && (
        <p role="alert" className="text-sm font-semibold text-danger">
          El modo abierto está apagado. <Link to="/modo-abierto" className="underline">Actívalo aquí</Link> para publicar con gente nueva.
        </p>
      )}

      <Button type="submit" size="lg" full disabled={blocked}>Publicar plan · {dur}</Button>
    </form>

    <aside aria-label="Vista previa" className="sticky top-8 hidden flex-col gap-3 lg:flex">
      <h2 className="text-h3 font-extrabold">Así lo verán tus amigos</h2>
      <div aria-hidden="true" className="flex h-[410px] w-[340px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <CardBody
          variant="friend" tileClass={catDef.tile} icon={catDef.icon({ size: 72, strokeWidth: 1.5 })} category={catDef.label}
          time={dur === 'Hoy' ? 'quedan hoy' : `quedan ${dur}`} xp="+20 XP" person={{ id: me.id, name: me.name }}
          where={`a ~800 m · ${state.location.zoneName}`} title={line.trim() || '¿Qué andas haciendo?'} chip="0 ya jalaron"
        />
      </div>
      <p className="max-w-[340px] text-meta text-muted">Tu punto exacto no se muestra: solo tu zona aproximada, hasta que haya match.</p>
    </aside>
    </div>
  )
}
