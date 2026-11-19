import { useApp } from '@/app/store'
import { locationLineText } from '@/lib/privacy'

/** Lo que esa persona ve de ti. */
export function useLocationLine(userId: string): string {
  const { state } = useApp()
  return locationLineText(state, userId)
}
