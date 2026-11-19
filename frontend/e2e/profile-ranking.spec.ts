import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations, signIn } from './helpers'

const tab = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name })
const goPerfil = (page: Page) => tab(page, /^(Perfil|Mi perfil)$/).click()
const goAmigos = (page: Page) => tab(page, /^Amigos/).click()
const ranking = (page: Page) => page.getByRole('region', { name: 'Ranking semanal' })
const items = (page: Page) => ranking(page).getByRole('listitem')
const scopeGroup = (page: Page) => page.getByRole('group', { name: 'Alcance del ranking' })
const scope = (page: Page, name: 'Global' | 'Amigos') => scopeGroup(page).getByRole('button', { name, exact: true })
const goRanking = async (page: Page) => { await goAmigos(page); await page.getByRole('tab', { name: 'Ranking' }).click() }

/** El ranking global existe solo si activas el modo abierto (persistido: sobrevive al goto). */
async function enableOpenMode(page: Page) {
  await page.goto('/modo-abierto')
  await page.getByLabel('Confirmo que tengo 18 años o más').check()
  await page.getByRole('button', { name: 'Activar modo abierto' }).click()
  await expect(page.getByText('Modo abierto activado')).toBeVisible()
}

test.describe('ranking de siempre: obligatorio; el global solo con modo abierto', () => {
  test('sin modo abierto: solo el ranking de amigos, sin selector de alcance, y no está en el perfil', async ({ page }) => {
    await signIn(page)
    await goPerfil(page)
    await expect(page.getByRole('switch', { name: /ranking/i })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Ranking semanal' })).toHaveCount(0)
    await goRanking(page)
    await expect(scopeGroup(page)).toHaveCount(0)
    await expect(page.getByText('El ranking global aparece cuando activas el modo abierto')).toBeVisible()
    await expect(page.getByRole('link', { name: 'tu perfil' })).toHaveAttribute('href', '/perfil')
    await expect(page.getByText('XP total · tus amigos')).toBeVisible()
    await expect(items(page)).toHaveCount(7) // tú (obligatorio) + 6 amigos
    const names = ['Nico', 'Mau', 'Tú', 'Sofi', 'Dani', 'Regina', 'Leo']
    for (const [i, n] of names.entries()) await expect(items(page).nth(i)).toContainText(n)
    await expect(items(page).nth(2)).toHaveAttribute('aria-current', 'true')
    await expect(ranking(page).getByText('Ximena')).toHaveCount(0) // gente que no es tu amiga no sale
    await expectNoAxeViolations(page)
  })

  test('con modo abierto aparece el global (por defecto): top 10 de siempre y tu lugar abajo si quedas fuera', async ({ page }) => {
    await signIn(page)
    await enableOpenMode(page)
    await goRanking(page)
    await expect(scope(page, 'Global')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('XP total · toda la gente')).toBeVisible()
    await expect(items(page)).toHaveCount(11) // 10 + tu fila
    await expect(items(page).nth(0)).toContainText('Ximena Torres') // alguien que NO es tu amiga
    await expect(items(page).nth(0)).toContainText('Nivel 21')
    await expect(items(page).nth(0)).toContainText('10,350 XP') // XP total, no semanal
    await expect(items(page).nth(8)).toContainText('Nico')
    await expect(items(page).nth(9)).toContainText('Mau')
    const mine = items(page).nth(10)
    await expect(mine).toContainText('Tú')
    await expect(mine).toContainText('lugar 12')
    await expect(mine).toContainText('3,340 XP')
    await expect(mine).toHaveAttribute('aria-current', 'true')
    await expect(ranking(page).getByText('Sofi')).toHaveCount(0) // fuera del top 10
    await expect(page.getByText('quien tiene el modo abierto activo')).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('el alcance Amigos sigue ahí cuando el modo abierto está activo', async ({ page }) => {
    await signIn(page)
    await enableOpenMode(page)
    await goRanking(page)
    await scope(page, 'Amigos').click()
    await expect(scope(page, 'Amigos')).toHaveAttribute('aria-pressed', 'true')
    await expect(items(page)).toHaveCount(7)
    await expect(items(page).nth(0)).toContainText('Nico')
    await expect(ranking(page).getByText('Ximena')).toHaveCount(0)
  })

  test('se puede tocar a una persona del ranking para ver su perfil (y a ti para ir al tuyo)', async ({ page }) => {
    await signIn(page)
    await enableOpenMode(page)
    await goRanking(page)
    await items(page).nth(0).getByRole('link').click()
    await expect(page.getByRole('heading', { name: 'Ximena Torres', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Agregar amigo' })).toBeVisible() // no es tu amiga: solo se ve su perfil básico
    await page.getByRole('button', { name: 'Volver' }).click()
    await page.getByRole('tab', { name: 'Ranking' }).click()
    await items(page).nth(10).getByRole('link').click()
    await expect(page.getByRole('heading', { name: 'Alan', level: 1 })).toBeVisible()
  })

  test('al apagar el modo abierto desaparece el global', async ({ page }) => {
    await signIn(page)
    await enableOpenMode(page)
    await goRanking(page)
    await expect(scopeGroup(page)).toBeVisible()
    await goPerfil(page)
    await page.getByRole('link', { name: /^Modo abierto/ }).click()
    await page.getByRole('button', { name: 'Apagar modo abierto' }).click()
    await goRanking(page)
    await expect(scopeGroup(page)).toHaveCount(0)
    await expect(items(page)).toHaveCount(7)
  })

  test('tu XP total sube al confirmar un plan', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Jalo', exact: true }).click()
    await page.getByRole('button', { name: 'Ya nos vimos' }).click()
    await expect(page.getByText(/Los dos confirmaron/)).toBeVisible({ timeout: 6000 })
    await page.goBack()
    await goRanking(page)
    await expect(items(page).nth(2)).toContainText('3,360 XP') // 3,340 + 20
  })

  test('quien bloqueas desaparece del ranking global', async ({ page }) => {
    await signIn(page)
    await enableOpenMode(page)
    await goAmigos(page)
    await page.getByPlaceholder('Busca por @usuario').fill('@xime')
    await page.getByRole('region', { name: 'Resultados de búsqueda' }).getByRole('link', { name: 'Ximena Torres' }).click()
    await page.getByRole('button', { name: 'Más opciones' }).click()
    await page.getByRole('menuitem', { name: /Bloquear a Ximena/ }).click()
    await page.getByRole('tab', { name: 'Ranking' }).click()
    await expect(ranking(page).getByText('Ximena')).toHaveCount(0)
    await expect(items(page).nth(0)).toContainText('Rodri Peña')
    await expect(items(page).nth(9)).toContainText('Ale Campos')
    await expect(items(page).nth(10)).toContainText('lugar 11') // al salir uno, subes un lugar
  })
})
