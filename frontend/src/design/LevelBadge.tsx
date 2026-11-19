import { Crown } from 'lucide-react'
import { levelInfo, TIER_SIZE, type BadgeShape } from '@/lib/levels'
import tokens from '../../docs/design/tokens.json'

const C = 50
/** Polígono regular o estrella/burst. `inner` = radio interior relativo (0–1) para estrellas y bursts. */
function poly(n: number, r: number, rot: number, inner?: number): string {
  const pts: string[] = []
  const total = inner ? n * 2 : n
  for (let i = 0; i < total; i++) {
    const rad = inner && i % 2 === 1 ? r * inner : r
    const a = ((rot + (360 / total) * i) * Math.PI) / 180
    pts.push(`${(C + rad * Math.cos(a)).toFixed(2)},${(C + rad * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

const SHIELD = 'M50 12 L77 21 V48 C77 66 65 78 50 86 C35 78 23 66 23 48 V21 Z'

/** La forma del tramo. Todas caben en un radio ~36 de un lienzo de 100. */
function Shape({ shape, fill, stroke, dashed }: { shape: BadgeShape; fill: string; stroke: string; dashed?: boolean }) {
  const common = { fill, stroke, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeDasharray: dashed ? '5 4' : undefined }
  switch (shape) {
    case 'circle': return <circle cx={C} cy={C} r={34} {...common} />
    case 'square': return <rect x={17} y={17} width={66} height={66} rx={16} {...common} />
    case 'hexagon': return <polygon points={poly(6, 38, -90)} {...common} />
    case 'shield': return <path d={SHIELD} {...common} />
    case 'diamond': return <polygon points={poly(4, 40, -90)} {...common} />
    case 'octagon': return <polygon points={poly(8, 37, -67.5)} {...common} />
    case 'burst8': return <polygon points={poly(8, 39, -90, 0.72)} {...common} />
    case 'star5': return <polygon points={poly(5, 41, -90, 0.52)} {...common} />
    case 'scallop': return <polygon points={poly(12, 38, -90, 0.86)} {...common} />
    case 'burst16': return <polygon points={poly(16, 40, -90, 0.8)} {...common} />
  }
}

/**
 * Insignia de un nivel (1–100). Forma = tramo; color = nivel; corona de 10 puntos = posición en el tramo
 * (los encendidos son los alcanzados). El nivel 100 lleva corona. `locked` = aún no alcanzado.
 * Es decorativa (`aria-hidden`): el nombre y el número van siempre como texto al lado.
 */
export function LevelBadge({ level, size = 64, locked, className }: { level: number; size?: number; locked?: boolean; className?: string }) {
  const info = levelInfo(level)
  const fill = locked ? tokens.color['surface-sunken'] : info.fill
  const ink = locked ? tokens.color.muted : info.ink
  const stroke = locked ? tokens.color['border-dashed'] : tokens.color.surface
  const pips = Array.from({ length: TIER_SIZE }, (_, i) => {
    const a = ((-90 + (360 / TIER_SIZE) * i) * Math.PI) / 180
    return { x: C + 45 * Math.cos(a), y: C + 45 * Math.sin(a), on: i < info.rank }
  })
  const digits = String(info.level).length
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false" className={className}>
      {pips.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.2} fill={locked ? tokens.color['border-dashed'] : info.fill} opacity={p.on ? 1 : 0.28} />
      ))}
      <Shape shape={info.shape} fill={fill} stroke={stroke} dashed={locked} />
      <text x={C} y={C + (digits === 3 ? 6 : 8)} textAnchor="middle" fontSize={digits === 3 ? 22 : 28} fontWeight={800} fill={ink} fontFamily="inherit">{info.level}</text>
      {info.isMax && !locked && <g transform="translate(38 17)"><Crown size={24} strokeWidth={2.4} color={ink} fill="none" /></g>}
    </svg>
  )
}
