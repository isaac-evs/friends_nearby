import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** Entra con una cuenta mock y elige zona manual (sin pedir ubicación real). */
export async function signIn(page: Page) {
  await page.goto('/entrar')
  await page.getByLabel('Correo').fill('alan@correo.com')
  await page.getByLabel('Contraseña').fill('contraseña1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: /Tus amigos ven tu zona/ })).toBeVisible()
  await page.getByRole('button', { name: /elijo mi zona a mano/ }).click()
  await page.getByRole('button', { name: /^Usar Chapultepec/ }).click()
  await expect(page.getByRole('heading', { name: '¿Quién jala hoy?' })).toBeVisible()
}

export async function expectNoAxeViolations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
}
