import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Palette, Send, Trash2 } from 'lucide-react'
import { Avatar } from '@/design'
import { useApp } from '@/app/store'
import { useIsDesktop } from '@/app/hooks'
import { ME_ID } from '@/api/me'
import { CHAT_MAX, QUICK_MESSAGES } from '@/lib/lifecycle'
import { CHAT_THEMES, chatTheme, dayLabel } from '@/lib/chatThemes'
import { clockLabel } from '@/lib/planTime'
import { cn } from '@/lib/cn'

/**
 * Chat del plan: a pantalla completa en móvil y tablet; en desktop (≥ 1024 px) un panel que entra por la derecha (estilo mensajería). Se ve quién mandó cada cosa.
 * Quien organiza controla cómo se ve (tema) y puede borrar mensajes. En un plan que ya terminó es de solo lectura.
 */
/** Lo que el chat necesita de un plan o de un evento. `onTheme` solo existe si quien organiza puede cambiar el tema. */
export interface ChatSource { id: string; title: string; ownerId: string; memberIds?: string[]; timeline?: { id?: string; userId: string; text: string; at: string }[]; theme?: string }

export function ChatPanel({ chat: plan, onSend, onDelete, onTheme, onClose: onClosed, readOnly }: { chat: ChatSource; onSend: (text: string) => Promise<boolean>; onDelete?: (messageId: string) => void; onTheme?: (key: string) => void; onClose: () => void; readOnly: boolean }) {
  const { state } = useApp()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [styling, setStyling] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const desktop = useIsDesktop()
  // En desktop el chat entra por la derecha (se anima al abrir); en móvil y tablet ocupa toda la pantalla.
  const [shown, setShown] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id) }, [])
  // Cierre suave: primero se anima la salida y luego se desmonta.
  const closing = useRef(false)
  const onClose = () => {
    if (closing.current) return
    closing.current = true
    setShown(false)
    window.setTimeout(onClosed, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280)
  }
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const organizer = plan.ownerId === ME_ID
  const theme = chatTheme(plan.theme)
  const timeline = plan.timeline ?? []
  const people = [...new Set([plan.ownerId, ...(plan.memberIds ?? [])])]

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [timeline.length])
  useEffect(() => { if (!readOnly) input.current?.focus() }, [readOnly])
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', on)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', on); document.body.style.overflow = prev }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async (raw: string) => {
    const m = raw.trim()
    if (!m || busy || readOnly) return
    setBusy(true)
    const ok = await onSend(m)
    setBusy(false)
    if (ok) { setText(''); input.current?.focus() }
  }

  return (
    <div className={cn('fixed inset-0 z-50 flex transition-colors duration-300 motion-reduce:transition-none', desktop ? cn('justify-end', shown ? 'bg-ink/30' : 'bg-ink/0') : 'bg-surface')} onMouseDown={(e) => { if (desktop && e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Chat del plan" className={cn('flex h-dvh flex-col overflow-hidden bg-surface', desktop ? 'w-1/2 min-w-[420px] border-l border-line shadow-lg transition-transform duration-300 ease-out motion-reduce:transition-none' : 'w-full transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none', !shown && (desktop ? 'translate-x-full' : 'translate-y-6 opacity-0'))}>
        <header className="flex items-center gap-2 border-b border-line bg-surface px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
          <button type="button" aria-label="Cerrar chat" onClick={onClose} className="flex size-11 flex-none items-center justify-center rounded-full"><ArrowLeft aria-hidden="true" size={22} strokeWidth={2.4} /></button>
          <span className="flex flex-none items-center">
            {people.slice(0, 3).map((id, i) => <span key={id} className={cn('rounded-full ring-2 ring-surface', i > 0 && '-ml-3')}><Avatar userId={id} name={state.users[id]?.name ?? '?'} size={34} src={state.users[id]?.avatarUrl} /></span>)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col pl-1">
            <span className="truncate text-base font-extrabold">{plan.title}</span>
            <span className="truncate text-caption text-muted">{people.map((id) => (id === ME_ID ? 'Tú' : state.users[id]?.name ?? 'Alguien')).join(', ')}</span>
          </span>
          {organizer && !readOnly && onTheme && (
            <button type="button" aria-label="Cambiar cómo se ve el chat" aria-pressed={styling} onClick={() => setStyling((v) => !v)} className={cn('flex size-11 flex-none items-center justify-center rounded-full', styling && 'bg-primary-soft text-primary')}><Palette aria-hidden="true" size={20} /></button>
          )}
        </header>

        {styling && (
          <div role="radiogroup" aria-label="Tema del chat" className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
            <span className="text-caption font-bold text-muted">Tema</span>
            {CHAT_THEMES.map((t) => (
              <button key={t.key} type="button" role="radio" aria-checked={theme.key === t.key} aria-label={t.label} onClick={() => onTheme?.(t.key)} className="flex size-11 items-center justify-center">
                <span className={cn('flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface', t.swatch, theme.key === t.key && 'ring-2 ring-ink')} />
              </button>
            ))}
            <span className="ml-auto text-caption text-muted">Lo ve todo el plan</span>
          </div>
        )}

        <ul aria-label="Mensajes" aria-live="polite" className={cn('flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3', theme.wall)}>
          {timeline.length === 0 && <li className="m-auto rounded-full bg-surface px-4 py-2 text-center text-caption font-semibold text-muted shadow-sm">{readOnly ? 'No hubo mensajes en este plan.' : 'Aún no hay mensajes. Escribe el primero.'}</li>}
          {timeline.map((m, i) => {
            const mine = m.userId === ME_ID
            const prev = timeline[i - 1]
            const first = !prev || prev.userId !== m.userId || dayLabel(prev.at) !== dayLabel(m.at)
            const newDay = !prev || dayLabel(prev.at) !== dayLabel(m.at)
            const u = state.users[m.userId]
            const key = m.id ?? `${m.at}-${i}`
            const selected = picked === key
            const body = (
              <>
                {first && !mine && <span className={cn('text-caption font-extrabold', theme.name)}>{u?.name ?? 'Alguien'}{m.userId === plan.ownerId ? ' · organiza' : ''}</span>}
                <span className="text-[15px] leading-snug break-words whitespace-pre-wrap">{m.text}</span>
                <span className={cn('self-end text-[11px] leading-none', mine ? 'text-white/85' : 'text-muted')}>{clockLabel(m.at)}</span>
              </>
            )
            const bubble = cn('flex min-w-0 flex-col gap-0.5 px-3 py-1.5 text-left shadow-xs', mine ? cn(theme.mine, first ? 'rounded-lg rounded-tr-sm' : 'rounded-lg') : cn('bg-surface text-ink', first ? 'rounded-lg rounded-tl-sm' : 'rounded-lg'))
            return (
              <li key={key} className="flex flex-col">
                {newDay && <span className="mx-auto my-2 rounded-full bg-surface px-3 py-1 text-caption font-bold text-muted shadow-xs">{dayLabel(m.at)}</span>}
                <div className={cn('flex max-w-[84%] items-end gap-2 ', mine ? 'self-end' : 'self-start', first && 'mt-1.5')}>
                  {!mine && (first ? <Avatar userId={m.userId} name={u?.name ?? '?'} size={28} src={u?.avatarUrl} /> : <span aria-hidden="true" className="size-7 flex-none" />)}
                  {(organizer || mine) && !readOnly && onDelete && m.id
                    ? <button type="button" aria-label={`Mensaje de ${mine ? 'ti' : u?.name ?? 'alguien'}: ${m.text}. Toca para ver opciones`} aria-expanded={selected} onClick={() => setPicked(selected ? null : key)} className={bubble}>{body}</button>
                    : <div className={bubble}>{body}</div>}
                </div>
                {selected && m.id && (
                  <button type="button" onClick={() => { onDelete?.(m.id!); setPicked(null) }} className={cn('mt-1 flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-bold text-danger shadow-sm', mine ? 'self-end' : 'ml-9 self-start')}><Trash2 aria-hidden="true" size={16} />Borrar mensaje</button>
                )}
              </li>
            )
          })}
          <div ref={end} />
        </ul>

        {readOnly ? (
          <p className="border-t border-line bg-surface px-4 py-3 text-center text-sm font-semibold text-muted">El plan ya terminó: el chat queda solo para leer.</p>
        ) : (
          <div className="flex flex-col gap-2 border-t border-line bg-surface px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div role="group" aria-label="Atajos" className="-mx-1 flex gap-2 overflow-x-auto px-1">
              {QUICK_MESSAGES.map((q) => <button key={q} type="button" disabled={busy} onClick={() => send(q)} className="min-h-11 shrink-0 rounded-full border border-line bg-surface-muted px-3.5 text-sm font-bold disabled:opacity-50">{q}</button>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void send(text) }} className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1">
                <span className="sr-only">Escribe un mensaje</span>
                <textarea ref={input} value={text} onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX))} rows={1} maxLength={CHAT_MAX} placeholder="Mensaje"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text) } }}
                  className="max-h-32 min-h-12 w-full resize-none rounded-[24px] border border-line-input bg-surface px-4 py-2.5 text-base leading-snug placeholder:text-placeholder" />
              </label>
              <button type="submit" aria-label="Enviar mensaje" disabled={!text.trim() || busy} className={cn('flex size-12 flex-none items-center justify-center rounded-full disabled:bg-surface-sunken disabled:text-muted', theme.mine)}><Send aria-hidden="true" size={20} className="-ml-0.5" /></button>
            </form>
            {text.length > CHAT_MAX - 40 && <p className="text-caption text-muted" aria-live="polite">{CHAT_MAX - text.length} caracteres restantes</p>}
          </div>
        )}
      </div>
    </div>
  )
}
