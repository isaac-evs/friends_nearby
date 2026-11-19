import type { ReactNode } from 'react'
import {
  BookOpen, Coffee, Dices, Dumbbell, Activity, Music, Palette, Plus, Sofa, Utensils, Moon, Volleyball,
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
