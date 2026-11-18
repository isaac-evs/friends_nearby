import { useState } from 'react'
import { EyeOff, Search } from 'lucide-react'
import { Chip, IconButton, SegmentedControl } from '@/design'
import { useActions, useApp } from '@/app/store'
import { MapLazy } from './MapLazy'
import { MapList } from './MapList'
import { SelectedSheet } from './SelectedSheet'
import { LiveStatus } from './LiveStatus'
import { useMapItems, type MapFilter } from './useMapData'

const FILTERS: { v: MapFilter; l: string }[] = [{ v: 'todos', l: 'Todos' }, { v: 'amigos', l: 'Amigos' }, { v: 'eventos', l: 'Eventos' }]

/** Pantalla 4 (móvil): mapa de amigos y eventos, con vista de lista equivalente. */
export function MapScreen() {
  const { state } = useApp()
  const { toggleGhost } = useActions()
  const [filter, setFilter] = useState<MapFilter>('todos')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'mapa' | 'lista'>('mapa')
  const items = useMapItems(filter, query)
  const [sel, setSel] = useState<string | null>(null)
  const selected = items.find((i) => i.id === sel) ?? items[0] ?? null

  const emptyHint =
    filter === 'eventos' && !state.openMode.enabled
      ? 'Los eventos con gente nueva están en el modo abierto. Actívalo desde tu perfil.'
      : 'No hay amigos ni eventos con esos filtros ahora mismo.'

  return (
    <div className={`relative flex h-dvh flex-col overflow-hidden ${view === 'lista' ? 'bg-bg' : ''}`}>
      {view === 'mapa' && (
        <MapLazy
          items={items}
          selectedId={selected?.id ?? null}
          onSelect={setSel}
          // El mapa se centra en la franja libre entre los filtros (arriba) y el bottom sheet (abajo).
          padding={{ top: 150, right: 0, bottom: 340, left: 0 }}
          controlsStyle={{ right: 14, bottom: 344 }}
          attribution="bottom-left"
          attributionStyle={{ marginBottom: 340 }}
        />
      )}

      {/* Mapa: el encabezado flota sobre el mapa. Lista: es una franja fija y solo la lista hace scroll. */}
      <div className={view === 'mapa'
        ? 'pointer-events-none absolute inset-x-3.5 top-[38px] z-20 flex flex-col gap-2.5'
        : 'relative z-20 flex shrink-0 flex-col gap-2.5 border-b border-line bg-bg px-3.5 pt-[38px] pb-3'}>
        <div className="pointer-events-auto flex gap-2">
          <label className="relative block flex-1">
            <span className="sr-only">Buscar amigo o evento</span>
            <Search aria-hidden="true" size={18} className="absolute top-[13px] left-3.5" />
            <input
              type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar amigo o evento"
              className="h-11 w-full rounded-md border border-line bg-surface pr-3.5 pl-10 text-base text-ink shadow-md"
            />
          </label>
          <IconButton label={state.ghost ? 'Desactivar modo fantasma' : 'Activar modo fantasma'} aria-pressed={state.ghost} onClick={toggleGhost} className={`!rounded-md shadow-md ${state.ghost ? '!bg-ink !text-white' : ''}`}>
            <EyeOff aria-hidden="true" size={20} />
          </IconButton>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {FILTERS.map((f) => (
            <Chip key={f.v} selected={filter === f.v} onClick={() => setFilter(f.v)} className={`h-9 shadow-md ${filter === f.v ? '!border-primary !bg-primary !text-white' : ''}`}>{f.l}</Chip>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <LiveStatus />
          <SegmentedControl label="Vista" value={view} onChange={setView} className="w-[168px] shadow-md" options={[{ value: 'mapa', label: 'Mapa' }, { value: 'lista', label: 'Lista' }]} />
        </div>
      </div>

      {view === 'lista' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-28">
          <MapList items={items} emptyHint={emptyHint} />
        </div>
      )}

      {view === 'mapa' && selected && <SelectedSheet item={selected} className="absolute inset-x-3 bottom-[92px] z-20" />}
      {view === 'mapa' && !selected && (
        <p role="status" className="absolute inset-x-6 bottom-[104px] z-20 rounded-lg border border-line bg-surface px-4 py-3 text-center text-sm text-muted shadow-lg">{emptyHint}</p>
      )}
    </div>
  )
}
