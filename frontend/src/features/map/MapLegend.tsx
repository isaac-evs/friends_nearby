import { cn } from '@/lib/cn'

/** Qué significa cada marcador y los créditos del mapa (para la configuración del mapa). */
export function MapLegendList({ className }: { className?: string }) {
  const row = 'flex items-center gap-2.5 text-sm font-semibold'
  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      <li className={row}><span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border-2 border-white bg-primary shadow-xs" />Tú</li>
      <li className={row}><span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border-2 border-dashed border-primary bg-approx-fill" />Ubicación aproximada de un amigo cercano</li>
      <li className={row}><span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border-2 border-white bg-ink shadow-xs" />Amigo cercano (solo su foto)</li>
      <li className={row}><span aria-hidden="true" className="size-3.5 shrink-0 rounded-[5px] border border-line bg-cat-cafe" />Plan, en su lugar exacto</li>
      <li className={row}><span aria-hidden="true" className="size-3.5 shrink-0 rounded-sm border border-line bg-accent" />Evento (si hay amigos ahí, sus fotos van en su esquina)</li>
      <li className={row}><span aria-hidden="true" className="animate-chill motion-reduce:animate-none size-3.5 shrink-0 rounded-full border-2 border-success bg-cat-musica" />Sin plan, o plan en curso</li>
      <li className={row}><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-success" /><span aria-hidden="true" className="-ml-1.5 size-2.5 shrink-0 rounded-full bg-danger" />Disponible · ocupado</li>
      <li className="text-caption text-muted">Mapa © colaboradores de OpenStreetMap · © CARTO</li>
    </ul>
  )
}
