import { Search, X } from 'lucide-react'

/** ¿El nombre coincide con lo escrito? Sin acentos ni mayúsculas ("jose" encuentra "José"). */
export function matchesName(name: string, q: string): boolean {
  const n = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return n(name).includes(n(q))
}

/** Buscador de personas dentro de una lista larga (quiénes van a un plan o evento). 44 px de alto, con botón para borrar. */
export function SearchField({ value, onChange, label = 'Buscar persona', className }: { value: string; onChange: (v: string) => void; label?: string; className?: string }) {
  return (
    <label className={`relative flex items-center ${className ?? ''}`}>
      <span className="sr-only">{label}</span>
      <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 text-muted" />
      <input
        type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} autoComplete="off"
        className="h-11 w-full rounded-full border border-line-input bg-surface pr-10 pl-10 text-base placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden"
      />
      {value && <button type="button" aria-label="Borrar búsqueda" onClick={() => onChange('')} className="absolute right-1 flex size-9 items-center justify-center rounded-full text-muted"><X aria-hidden="true" size={16} /></button>}
    </label>
  )
}
