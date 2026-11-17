/** Leyenda del mapa (desktop). */
export function MapLegend() {
  return (
    <div className="pointer-events-auto grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-line bg-surface px-3.5 py-2.5 text-caption font-bold shadow-md">
      <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-full border-2 border-white bg-primary shadow-xs" />Tú</span>
      <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3.5 rounded-full border-2 border-dashed border-primary bg-zone-fill" />Zona aproximada</span>
      <span className="flex items-center gap-1.5"><span aria-hidden="true" className="rounded-full bg-primary px-1.5 text-[10px] text-white">match</span>Exacta temporal</span>
      <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3.5 rounded-sm border border-line bg-accent" />Evento público</span>
    </div>
  )
}
