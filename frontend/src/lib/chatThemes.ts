/** Temas del chat de un plan: los elige quien organiza (mismo valor en `chatThemes` del backend). Solo tokens del design system. */
export interface ChatTheme { key: string; label: string; mine: string; wall: string; swatch: string; name: string }
export const CHAT_THEMES: ChatTheme[] = [
  { key: 'indigo', label: 'Índigo', mine: 'bg-primary text-white', wall: 'bg-primary-soft', swatch: 'bg-primary', name: 'text-primary' },
  { key: 'naranja', label: 'Naranja', mine: 'bg-accent-text text-white', wall: 'bg-accent-soft', swatch: 'bg-accent-text', name: 'text-accent-text' },
  { key: 'verde', label: 'Verde', mine: 'bg-success-text text-white', wall: 'bg-cat-musica', swatch: 'bg-success-text', name: 'text-success-text' },
  { key: 'oscuro', label: 'Oscuro', mine: 'bg-ink text-white', wall: 'bg-surface-sunken', swatch: 'bg-ink', name: 'text-ink' },
  { key: 'rojo', label: 'Rojo', mine: 'bg-danger text-white', wall: 'bg-cat-clase', swatch: 'bg-danger', name: 'text-danger' },
]
export const chatTheme = (key?: string): ChatTheme => CHAT_THEMES.find((t) => t.key === key) ?? CHAT_THEMES[0]!

/** "Hoy", "Ayer" o "mié 19 nov" para separar días en el chat. */
export function dayLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso); const n = new Date(now)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(n) - start(d)) / 86_400_000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
}
