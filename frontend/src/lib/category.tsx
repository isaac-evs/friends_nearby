import type { ReactNode } from 'react'
import {
  BookOpen, Coffee, Dices, Dumbbell, Activity, Music, Palette, Plus, Sofa, Utensils, Moon, Volleyball,
  Star, Heart, Camera, Gamepad2, Bike, Mountain, Pizza, Mic, Tent, Film, PawPrint, Sparkles,
} from 'lucide-react'
import type { EventType, PlanCategory } from '@/api/schemas'

/** Clase de Tailwind (token) del tile de cada categoría. */
export type TileClass =
  | 'bg-cat-cafe' | 'bg-cat-correr' | 'bg-cat-deporte' | 'bg-cat-estudiar'
  | 'bg-cat-comer' | 'bg-cat-musica' | 'bg-cat-clase' | 'bg-cat-otro'

interface CatDef { label: string; tile: TileClass; icon: (p: { size: number; strokeWidth?: number }) => ReactNode }

const ic = (C: typeof Coffee) => (p: { size: number; strokeWidth?: number }) => <C aria-hidden="true" {...p} />

export const PLAN_CATEGORIES: Record<PlanCategory, CatDef> = {
  cafe: { label: 'Café', tile: 'bg-cat-cafe', icon: ic(Coffee) },
  comer: { label: 'Comer', tile: 'bg-cat-comer', icon: ic(Utensils) },
  correr: { label: 'Correr', tile: 'bg-cat-correr', icon: ic(Activity) },
  estudiar: { label: 'Estudiar', tile: 'bg-cat-estudiar', icon: ic(BookOpen) },
  gym: { label: 'Gym', tile: 'bg-cat-deporte', icon: ic(Dumbbell) },
  chill: { label: 'Chill', tile: 'bg-cat-clase', icon: ic(Sofa) },
  fiesta: { label: 'Fiesta', tile: 'bg-cat-estudiar', icon: ic(Moon) },
  juegos: { label: 'Juegos', tile: 'bg-cat-musica', icon: ic(Dices) },
}

export const EVENT_TYPES: Record<EventType, CatDef & { group: EventGroup }> = {
  correr: { label: 'Correr', tile: 'bg-cat-correr', icon: ic(Activity), group: 'Deporte' },
  deporte: { label: 'Deporte', tile: 'bg-cat-deporte', icon: ic(Volleyball), group: 'Deporte' },
  juegos: { label: 'Juegos', tile: 'bg-cat-estudiar', icon: ic(Dices), group: 'Social' },
  comida: { label: 'Comida', tile: 'bg-cat-comer', icon: ic(Utensils), group: 'Comida' },
  clase: { label: 'Clase', tile: 'bg-cat-clase', icon: ic(BookOpen), group: 'Aprender' },
  musica: { label: 'Música', tile: 'bg-cat-musica', icon: ic(Music), group: 'Social' },
  arte: { label: 'Arte', tile: 'bg-cat-cafe', icon: ic(Palette), group: 'Aprender' },
  otro: { label: 'Otro', tile: 'bg-cat-otro', icon: ic(Plus), group: 'Social' },
}

export type EventGroup = 'Deporte' | 'Social' | 'Comida' | 'Aprender'
export const EVENT_GROUPS: EventGroup[] = ['Deporte', 'Social', 'Comida', 'Aprender']

/** Íconos que se pueden elegir para un evento de tipo "Otro" (solo para ese evento). La clave viaja al servidor. */
export const CUSTOM_EVENT_ICONS = {
  star: { label: 'Estrella', icon: ic(Star) },
  heart: { label: 'Corazón', icon: ic(Heart) },
  camera: { label: 'Cámara', icon: ic(Camera) },
  gamepad: { label: 'Videojuegos', icon: ic(Gamepad2) },
  bike: { label: 'Bici', icon: ic(Bike) },
  mountain: { label: 'Montaña', icon: ic(Mountain) },
  coffee: { label: 'Café', icon: ic(Coffee) },
  pizza: { label: 'Pizza', icon: ic(Pizza) },
  palette: { label: 'Arte', icon: ic(Palette) },
  mic: { label: 'Micrófono', icon: ic(Mic) },
  dumbbell: { label: 'Pesas', icon: ic(Dumbbell) },
  tent: { label: 'Campamento', icon: ic(Tent) },
  film: { label: 'Cine', icon: ic(Film) },
  book: { label: 'Libro', icon: ic(BookOpen) },
  paw: { label: 'Mascotas', icon: ic(PawPrint) },
  sparkles: { label: 'Brillos', icon: ic(Sparkles) },
} as const
export type CustomEventIcon = keyof typeof CUSTOM_EVENT_ICONS

/** Cómo se ve un evento: su tipo, con el ícono propio si es un "Otro" que eligió uno. */
export const CUSTOM_EVENT_COLORS = {
  cafe: { label: 'Durazno', tile: 'bg-cat-cafe' }, correr: { label: 'Coral', tile: 'bg-cat-correr' },
  deporte: { label: 'Azul', tile: 'bg-cat-deporte' }, estudiar: { label: 'Lila', tile: 'bg-cat-estudiar' },
  comer: { label: 'Amarillo', tile: 'bg-cat-comer' }, musica: { label: 'Menta', tile: 'bg-cat-musica' },
  clase: { label: 'Rosa', tile: 'bg-cat-clase' }, otro: { label: 'Gris', tile: 'bg-cat-otro' },
} as const satisfies Record<string, { label: string; tile: TileClass }>
export type CustomEventColor = keyof typeof CUSTOM_EVENT_COLORS

export function eventLook(e: { type: EventType; typeIcon?: string; typeColor?: string }) {
  const t = EVENT_TYPES[e.type]
  const custom = e.type === 'otro' && e.typeIcon ? CUSTOM_EVENT_ICONS[e.typeIcon as CustomEventIcon] : undefined
  const color = e.type === 'otro' && e.typeColor ? CUSTOM_EVENT_COLORS[e.typeColor as CustomEventColor] : undefined
  return { ...t, ...(custom && { icon: custom.icon }), ...(color && { tile: color.tile }) }
}
