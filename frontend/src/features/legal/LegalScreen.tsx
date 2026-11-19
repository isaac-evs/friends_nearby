import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { IconButton } from '@/design'
import { LEGAL_SECTIONS, LEGAL_UPDATED } from './legalContent'

/** `/legal`: aviso de privacidad, uso de la ubicación, derechos y términos. Se llega desde el menú del perfil. */
export function LegalScreen() {
  const nav = useNavigate()
  return (
    <div className="flex flex-col gap-4 px-[22px] pt-8 pb-[104px] lg:max-w-[640px] lg:p-0">
      <header className="flex items-center gap-3">
        <IconButton label="Volver" onClick={() => nav(-1)}><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></IconButton>
        <h1 className="text-h1 font-extrabold">Privacidad y legal</h1>
      </header>
      <p className="text-meta text-muted">Aviso de privacidad y términos de ¿Jalas? · actualizado el {LEGAL_UPDATED}.</p>
      <nav aria-label="Secciones" className="flex flex-wrap gap-2">
        {LEGAL_SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-3.5 text-sm font-bold">{s.title.split(':')[0]}</a>)}
      </nav>
      {LEGAL_SECTIONS.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="flex scroll-mt-4 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
          <h2 id={`${s.id}-h`} className="text-base font-extrabold">{s.title}</h2>
          <ul className="flex flex-col gap-2 text-sm leading-normal text-text">
            {s.items.map((t) => <li key={t} className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1.5 flex-none rounded-full bg-primary" /><span>{t}</span></li>)}
          </ul>
        </section>
      ))}
    </div>
  )
}
