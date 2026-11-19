import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** Entra con una cuenta mock y elige su ubicación aproximada en el mapa (sin pedir ubicación real). */
export async function signIn(page: Page) {
  await page.goto('/entrar')
  await page.getByLabel('Correo').fill('alan@correo.com')
  await page.getByLabel('Contraseña').fill('contraseña1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: /Tus amigos cercanos ven dónde andas/ })).toBeVisible()
  await page.getByRole('button', { name: /la elijo en el mapa/ }).click()
  await page.getByRole('button', { name: 'Elegir en el mapa' }).click()
  await page.getByRole('button', { name: 'Usar este lugar' }).click()
  await expect(page.getByRole('heading', { name: '¿Quién jala hoy?' })).toBeVisible()
}

export async function expectNoAxeViolations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
}

/** Escribe el nombre de un lugar y lo marca en el mapa (el lugar de un plan o evento es obligatorio). */
export async function fillPlace(page: Page, label: string | RegExp, name: string) {
  await page.getByLabel(label).fill(name)
  await page.getByRole('button', { name: /^(Elegir|Cambiar) en el mapa$/ }).click()
  await page.getByRole('button', { name: 'Usar este lugar' }).click()
}
