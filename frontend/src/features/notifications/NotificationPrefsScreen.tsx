import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { IconButton, Toggle } from '@/design'
import { PREF_GROUPS } from '@/lib/notifications'
import { useNotifications } from './useNotifications'

/**
 * `/notificaciones/preferencias`: por tipo. Dentro de la app siempre te llegan; el aviso con la app cerrada (push) es opcional.
 * [PROPUESTA] Web Push (VAPID): hoy solo se guarda la preferencia; en iOS requiere instalar la app.
 */
export function NotificationPrefsScreen() {
  const nav = useNavigate()
  const { prefs, setPref } = useNotifications()
  return (
    <div className="flex flex-col gap-4 px-[22px] pt-8 pb-[104px] lg:max-w-[640px] lg:p-0">
      <header className="flex items-center gap-3">
        <IconButton label="Volver" onClick={() => nav(-1)}><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></IconButton>
        <h1 className="text-h1 font-extrabold">Preferencias</h1>
      </header>
      <p className="text-meta text-muted">Dentro de la app siempre ves tus notificaciones. Aquí eliges cuáles te avisan también con la app cerrada. Los avisos nunca dicen dónde estás.</p>
      <ul className="flex flex-col rounded-lg border border-line bg-surface px-3">
        {PREF_GROUPS.map((g, i) => (
          <li key={g.key} className={`flex min-h-[64px] items-center gap-3 py-2 ${i < PREF_GROUPS.length - 1 ? 'border-b border-surface-sunken' : ''}`}>
            <span className="flex flex-1 flex-col"><span className="text-sm font-bold">{g.title}</span><span className="text-caption font-medium text-muted">{g.hint}</span></span>
            <Toggle checked={prefs[g.key]} onChange={(v) => setPref(g.key, v)} label={`Avisarme de ${g.title.toLowerCase()} con la app cerrada`} />
          </li>
        ))}
      </ul>
    </div>
  )
}
