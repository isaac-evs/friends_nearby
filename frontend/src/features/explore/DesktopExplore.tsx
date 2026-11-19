import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, List, Search } from 'lucide-react'
import { Chip } from '@/design'
import { cn } from '@/lib/cn'
import { ExploreDeck, type DeckInfo } from './ExploreDeck'
import { MapLazy } from '../map/MapLazy'
import { MapList } from '../map/MapList'
import { SelectedSheet } from '../map/SelectedSheet'
import { ClusterSheet } from '../map/ClusterSheet'
import { MapSettings } from '../map/MapSettings'
import { PlanTodayHeader } from './PlanTodayHeader'
import { useMapItems, type MapFilter, type MapItem } from '../map/useMapData'
import { ActivePlanCard } from '../plans/ActivePlanCard'

const FILTERS: { v: MapFilter; l: string }[] = [{ v: 'todos', l: 'Todos' }, { v: 'amigos', l: 'Amigos' }, { v: 'planes', l: 'Planes' }, { v: 'eventos', l: 'Eventos' }]

/**
 * Desktop (Desktop.dc.html): mapa + panel derecho de 360 px con la pila de cards.
 * "Ver como lista" abre un cajón lateral que se pliega con animación y deja el mapa visible.
 */
export function DesktopExplore() {
  const [filter, setFilter] = useState<MapFilter>('todos')
  const [query, setQuery] = useState('')
  const [params] = useSearchParams()
  const [sel, setSel] = useState<string | null>(params.get('sel'))
  const [cluster, setCluster] = useState<MapItem[] | null>(null)
  const select = (id: string | null) => { setSel(id); setCluster(null) }
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

  return (
    <div className="flex h-dvh">
      <section aria-label="Mapa de amigos y eventos" className="relative min-w-0 flex-1 overflow-hidden">
        <MapLazy
          items={items}
          selectedId={selected?.id ?? null}
          onSelect={select}
          onCluster={(g) => { setSel(null); setCluster(g) }}
          // El mapa no se mueve al abrir la lista: el cajón flota encima.
          padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
          showZoom
          hideAttribution
          controlsStyle={{ right: 22, bottom: 44 }}
        />

        {/* Barra superior de ancho completo: configuración + búsqueda · filtros · cajón de lista (se pliega, a la izquierda) */}
        <div className="pointer-events-none absolute inset-x-[22px] top-[22px] bottom-[22px] z-20 flex flex-col gap-2.5">
          {/* Igual que en móvil: configuración + búsqueda, y debajo los filtros (con "Ver como lista"). */}
          <div className="pointer-events-auto flex gap-2">
            <MapSettings variant="popover" align="left" />
            <label className="relative block flex-1">
              <span className="sr-only">Buscar amigo o evento</span>
              <Search aria-hidden="true" size={18} className="absolute top-[13px] left-3.5" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar amigo o evento" className="h-11 w-full rounded-md border border-line bg-surface pr-3.5 pl-10 text-base text-ink shadow-md" />
            </label>
          </div>
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Chip key={f.v} selected={filter === f.v} onClick={() => setFilter(f.v)} className={`h-9 shadow-md ${filter === f.v ? '!border-primary !bg-primary !text-white' : ''}`}>{f.l}</Chip>
            ))}
            <Chip selected={listOpen} onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen} aria-controls="map-list-drawer" className={`h-9 shadow-md ${listOpen ? '!border-primary !bg-primary !text-white' : ''}`}><List aria-hidden="true" size={14} />Ver como lista</Chip>
          </div>

          <div
            className={cn(
              'grid min-h-0 transition-[grid-template-rows,opacity,visibility] duration-300 ease-out-soft',
              // `invisible` (visibility) se aplica al terminar la animación: el cajón cerrado sale del árbol de accesibilidad.
              'w-[min(420px,100%)]',
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
                {listMounted && <MapList items={items} selectedId={selected?.id ?? null} onLocate={select} emptyHint="No hay amigos, planes ni eventos con esos filtros." />}
              </div>
            </div>
          </div>

        </div>

        {cluster && <ClusterSheet items={cluster} onPick={select} onClose={() => setCluster(null)} className="absolute right-[84px] bottom-[22px] z-20 w-[360px] max-w-[calc(100%-110px)]" />}
        {selected && <SelectedSheet item={selected} className="absolute right-[84px] bottom-[22px] z-20 w-[360px] max-w-[calc(100%-110px)]" />}
      </section>
      <aside aria-label="Planes cerca" className="w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface p-[22px]">
        <div className="mb-6"><PlanTodayHeader /></div>
        <ActivePlanCard className="mb-4" />
        <p className="mb-2 text-meta text-muted">{info.counter}</p>
        <ExploreDeck compact onInfo={setInfo} />
      </aside>
    </div>
  )
}
