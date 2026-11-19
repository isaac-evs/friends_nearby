import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations, signIn } from './helpers'

// Navegación del lado del cliente: el estado del mock vive en memoria (un goto lo reinicia).
const tab = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name })
const goAmigos = (page: Page) => tab(page, /^Amigos/).click()
const goMapa = (page: Page) => tab(page, /^(Mapa|Explorar y mapa)$/).click()
const goInicio = (page: Page) => tab(page, /^Explorar/).click()
const ranking = (page: Page) => page.getByRole('region', { name: 'Ranking semanal' })
const goRanking = async (page: Page) => {
  await page.getByRole('tab', { name: 'Ranking' }).click()
  // Sin modo abierto solo existe el ranking de amigos (no hay selector de alcance).
  const amigos = page.getByRole('group', { name: 'Alcance del ranking' }).getByRole('button', { name: 'Amigos', exact: true })
  if (await amigos.count()) await amigos.click()
}
const cerca = (page: Page) => page.getByRole('region', { name: 'Cerca ahora' })
// En móvil la pantalla de perfil ajeno no tiene tab bar: se vuelve con "Volver".
const back = (page: Page) => page.getByRole('button', { name: 'Volver' }).click()

test.describe('bloque B · eliminar amigo (sin saludos)', () => {
  test('no existe la función de saludar', async ({ page }) => {
    await signIn(page)
    await goAmigos(page)
    await expect(page.getByRole('heading', { name: /Saludos/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Saludar/ })).toHaveCount(0)
    for (const [handle, name] of [['@dani', 'Dani'], ['@karla', 'Karla Ruiz']] as const) {
      await page.getByPlaceholder('Busca por @usuario').fill(handle)
      await page.getByRole('region', { name: 'Resultados de búsqueda' }).getByRole('link', { name }).click()
      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
      await expect(page.getByRole('button', { name: /Saludar/ })).toHaveCount(0)
      await back(page)
    }
  })

  test('eliminar amigo: confirmación, sin avisar, y desaparece de cercanos, mapa y ranking', async ({ page }) => {
    await signIn(page)
    // Antes: Sofi aparece en explorar, mapa, ranking y cercanos.
    await expect(page.getByText('Por un café en Providencia, ¿alguien?').first()).toBeVisible()
    await goMapa(page)
    await expect(page.getByRole('button', { name: /Sofi: plan en Café Ámbar/ })).toBeVisible()
    await goAmigos(page)
    await goRanking(page)
    await expect(ranking(page).getByText('Sofi')).toBeVisible()
    await page.getByRole('tab', { name: 'Amigos' }).click()
    await expect(cerca(page).getByRole('link', { name: /Sofi/ })).toBeVisible()
    await cerca(page).getByRole('link', { name: /Sofi/ }).click()
    await expect(page.getByRole('heading', { name: 'Sofi', level: 1 })).toBeVisible()
    await expect(page.getByText('Ya son amigos')).toBeVisible()

    // Confirmación: Esc y "Mantener" no eliminan; el foco se queda dentro del diálogo.
    await page.getByRole('button', { name: 'Más opciones' }).click()
    await page.getByRole('menuitem', { name: 'Eliminar a Sofi de amigos' }).click()
    const dialog = page.getByRole('dialog', { name: 'Eliminar a Sofi' })
    await expect(dialog).toContainText('No le avisamos')
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true)
    }
    await expectNoAxeViolations(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: 'Más opciones' }).click()
    await page.getByRole('menuitem', { name: 'Eliminar a Sofi de amigos' }).click()
    await page.getByRole('button', { name: 'Mantener' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Ya son amigos')).toBeVisible()

    await page.getByRole('button', { name: 'Más opciones' }).click()
    await page.getByRole('menuitem', { name: 'Eliminar a Sofi de amigos' }).click()
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(page.getByText('Eliminaste a Sofi de tus amigos')).toBeVisible()
    await expect(page.getByText('Ya son amigos')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Agregar amigo' })).toBeVisible()
        await expect(page.getByRole('menuitem', { name: /Eliminar a Sofi/ })).toHaveCount(0)

    // Después: ya no está en ninguna parte.
    await back(page)
    await expect(cerca(page).getByRole('link', { name: /Sofi/ })).toHaveCount(0)
    await expect(cerca(page).getByRole('link', { name: /Dani/ })).toBeVisible()
    await goRanking(page)
    await expect(ranking(page).getByText('Mau')).toBeVisible()
    await expect(ranking(page).getByText('Sofi')).toHaveCount(0)
    await goMapa(page)
    await expect(page.getByRole('button', { name: /Dani: plan en Tortas ahogadas/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sofi: plan en Café Ámbar/ })).toHaveCount(0)
    await goInicio(page)
    await expect(page.getByText('Por un café en Providencia, ¿alguien?')).toHaveCount(0)
  })
})
