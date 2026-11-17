import { useEffect, useState } from 'react'
import { ChevronLeft, EyeOff, List, Search } from 'lucide-react'
import { Chip, IconButton } from '@/design'
import { useActions, useApp } from '@/app/store'
import { cn } from '@/lib/cn'
import { ExploreDeck, type DeckInfo } from './ExploreDeck'
import { MapLazy } from '../map/MapLazy'
import { MapList } from '../map/MapList'
import { MapLegend } from '../map/MapLegend'
import { SelectedSheet } from '../map/SelectedSheet'
import { LiveStatus } from '../map/LiveStatus'
import { useMapItems, type MapFilter } from '../map/useMapData'

const FILTERS: { v: MapFilter; l: string }[] = [{ v: 'todos', l: 'Todos' }, { v: 'amigos', l: 'Amigos' }, { v: 'eventos', l: 'Eventos' }]

/**
 * Desktop (Desktop.dc.html): mapa + panel derecho de 360 px con la pila de cards.
 * "Ver como lista" abre un cajón lateral que se pliega con animación y deja el mapa visible.
 */
export function DesktopExplore() {
  const { state } = useApp()
  const { toggleGhost } = useActions()
  const [filter, setFilter] = useState<MapFilter>('todos')
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  // El contenido de la lista solo existe mientras está abierta (+ lo que dura la animación de cierre).
  const [listMounted, setListMounted] = useState(false)
  useEffect(() => {
    if (listOpen) { setListMounted(true); return }
    const t = window.setTimeout(() => setListMounted(false), 320)
    return () => window.clearTimeout(t)
  }, [listOpen])
  const [info, setInfo] = useState<DeckInfo>({ counter: '', mode: 'amigos' })
  const items = useMapItems(filter, query)
  const selected = items.find((i) => i.id === sel) ?? null
  const friends = items.filter((i) => i.kind === 'friend').length
  const events = items.filter((i) => i.kind === 'event').length

  return (
    <div className="flex h-dvh">
      <section aria-label="Mapa de amigos y eventos" className="relative min-w-0 flex-1 overflow-hidden">
        <MapLazy
          items={items}
          selectedId={selected?.id ?? null}
          onSelect={setSel}
          // El centro visual se corre a la derecha cuando el cajón de lista está abierto.
          padding={{ top: 0, right: 0, bottom: 0, left: listOpen ? 400 : 0 }}
          showZoom
          controlsStyle={{ right: 22, bottom: 44 }}
        />

        {/* Columna izquierda: cabecera · cajón de lista (se pliega) · leyenda */}
        <div className="pointer-events-none absolute top-[22px] bottom-[22px] left-[22px] z-20 flex w-[min(380px,calc(100%-44px))] flex-col gap-3">
          <div className="pointer-events-auto flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface px-4 py-3 shadow-md">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-[26px] font-extrabold tracking-[-0.6px]">¿Quién jala hoy?</h1>
              <span className="text-meta text-muted">{state.location.zoneName}, Guadalajara · {friends} amigos · {events} eventos</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => <Chip key={f.v} selected={filter === f.v} onClick={() => setFilter(f.v)}>{f.l}</Chip>)}
              <Chip selected={listOpen} onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen} aria-controls="map-list-drawer"><List aria-hidden="true" size={14} />Ver como lista</Chip>
            </div>
            <LiveStatus />
          </div>

          <div
            className={cn(
              'grid min-h-0 transition-[grid-template-rows,opacity,visibility] duration-300 ease-out-soft',
              // `invisible` (visibility) se aplica al terminar la animación: el cajón cerrado sale del árbol de accesibilidad.
              listOpen ? 'visible flex-1 grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0',
            )}
          >
            <div id="map-list-drawer" inert={!listOpen} className="pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-bg shadow-lg">
              <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-2">
                <h2 className="text-h3 font-extrabold">En lista · {items.length}</h2>
                <button type="button" onClick={() => setListOpen(false)} aria-label="Ocultar lista" className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-muted">
                  <ChevronLeft aria-hidden="true" size={20} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {listMounted && <MapList items={items} selectedId={selected?.id ?? null} onLocate={setSel} emptyHint="No hay amigos ni eventos con esos filtros." />}
              </div>
            </div>
          </div>

          <div className="mt-auto hidden xl:block"><MapLegend /></div>
        </div>

        <div className="pointer-events-none absolute top-[22px] right-[22px] z-20 flex gap-2">
          <label className="pointer-events-auto relative block w-[260px] max-w-full">
            <span className="sr-only">Buscar amigo o evento</span>
            <Search aria-hidden="true" size={18} className="absolute top-3.5 left-3.5" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar amigo o evento" className="h-11 w-full rounded-md border border-line bg-surface pr-3.5 pl-10 text-[15px] shadow-md" />
          </label>
          <IconButton label={state.ghost ? 'Desactivar modo fantasma' : 'Activar modo fantasma'} aria-pressed={state.ghost} onClick={toggleGhost} className="pointer-events-auto !rounded-md shadow-md">
            <EyeOff aria-hidden="true" size={20} />
          </IconButton>
        </div>

        {selected && <SelectedSheet item={selected} className="absolute right-[84px] bottom-[22px] z-20 w-[360px] max-w-[calc(100%-110px)]" />}
      </section>
      <aside aria-label="Planes cerca" className="w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface p-[22px]">
        <p className="mb-2 text-meta text-muted">{info.counter}</p>
        <ExploreDeck compact onInfo={setInfo} />
      </aside>
    </div>
  )
}
