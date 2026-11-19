import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export const API = 'http://localhost:8080'
export async function account(page: Page, prefix = 'e2e') {
  const username = `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20)
  const email = `${username}@example.com`
  const res = await page.request.post(`${API}/auth/register`, { data: { email, username, password: 'password123', display_name: username } })
  expect(res.status()).toBe(201)
  const { token, user } = await res.json()
  return { token: token as string, userId: user.user_id as string, username, email }
}
export async function apiAction(page: Page, token: string, data: Record<string, unknown>) {
  const res = await page.request.post(`${API}/app/actions`, { headers: { Authorization: `Bearer ${token}` }, data })
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()).result
}
export async function signIn(page: Page) {
  const a = await account(page)
  await page.goto('/entrar')
  await page.getByLabel('Correo').fill(a.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Tus amigos ven tu zona/ })).toBeVisible()
  await page.getByRole('button', { name: /elijo mi zona a mano/ }).click()
  await page.getByRole('button', { name: /^Usar Chapultepec/ }).click()
  await expect(page.getByRole('heading', { name: '¿Quién jala hoy?' })).toBeVisible()
  return a
}
export async function authenticate(page: Page, token: string) {
  await page.goto('/entrar')
  await page.evaluate(t => sessionStorage.setItem('friends-nearby.token', t), token)
  await page.goto('/amigos')
  await expect(page.getByRole('heading', { name: 'Tu banda' })).toBeVisible()
}
export async function expectNoAxeViolations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(r.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`)).toEqual([])
}
