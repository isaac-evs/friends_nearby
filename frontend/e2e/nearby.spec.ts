import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations, signIn } from './helpers'

const tab = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name })
const goMapa = (page: Page) => tab(page, /^(Mapa|Explorar y mapa)$/).click()
const goPerfil = (page: Page) => tab(page, /^(Perfil|Mi perfil)$/).click()
const goAmigos = (page: Page) => tab(page, /^Amigos/).click()
const cerca = (page: Page) => page.getByRole('region', { name: 'Cerca ahora' })
const rows = (page: Page) => cerca(page).locator('a[href^="/u/"]') // las filas de personas (no "Ver en el mapa")
/** El rango es GLOBAL (explorar, mapa y amigos). Se cambia desde el botón "Rango · N km". */
const setRango = async (page: Page, km: string) => {
  await cerca(page).getByRole('button', { name: /^Rango · / }).click()
  await page.getByRole('dialog', { name: 'Rango de búsqueda' }).getByRole('radio', { name: km, exact: true }).click()
}

test.describe('mapa: tocar "Te ven N cercanos" para ver quién te ve', () => {
  test('lista a quienes te ven (solo ubicación aproximada) y lleva a administrarlo desde el perfil', async ({ page }) => {
    await signIn(page)
    await goMapa(page)
    await page.getByRole('button', { name: /^Te ven 3 cercanos/ }).click()
    const dlg = page.getByRole('dialog', { name: 'Quién te ve' })
    await expect(dlg).toContainText('Te ven 3 amigos cercanos')
    const list = dlg.getByRole('list', { name: 'Quién te ve' }).getByRole('listitem')
    await expect(list).toHaveCount(3)
    for (const [i, n] of ['Mau', 'Nico', 'Sofi'].entries()) {
      await expect(list.nth(i)).toContainText(n)
      await expect(list.nth(i)).toContainText('Ubicación aproximada')
    }
    await expectNoAxeViolations(page)
    await dlg.getByRole('link', { name: 'Administrar desde tu perfil' }).click()
    await expect(page.getByRole('heading', { name: 'Alan', level: 1 })).toBeVisible()
  })

  test('si compartes tu ubicación exacta, el aviso lo dice y la lista muestra hasta cuándo', async ({ page }) => {
    await signIn(page)
    await goPerfil(page)
    await page.getByRole('link', { name: /^Amigos cercanos/ }).click()
    await page.getByRole('button', { name: 'Ubicación exacta con Sofi' }).click()
    await page.getByRole('dialog', { name: 'Ubicación exacta · Sofi' }).getByRole('button', { name: '30 min' }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Volver al perfil' }).click()
    await goMapa(page)
    await page.getByRole('button', { name: /^Exacta con 1 amigo/ }).click()
    const dlg = page.getByRole('dialog', { name: 'Quién te ve' })
    await expect(dlg.getByRole('listitem').filter({ hasText: 'Sofi' })).toContainText('Ubicación exacta hasta las')
    await expect(dlg.getByRole('listitem').filter({ hasText: 'Mau' })).toContainText('Ubicación aproximada')
  })

  test('con el modo fantasma nadie te ve y la hoja lo dice', async ({ page }) => {
    await signIn(page)
    await goMapa(page)
    await page.getByRole('button', { name: 'Activar modo fantasma' }).click()
    await page.getByRole('button', { name: /^Modo fantasma: nadie te ve/ }).click()
    const dlg = page.getByRole('dialog', { name: 'Quién te ve' })
    await expect(dlg).toContainText('Modo fantasma: nadie te ve ahora, ni tus cercanos.')
    await expect(dlg.getByRole('list')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(dlg).toHaveCount(0)
  })

  test('el botón cumple un objetivo táctil de 44 px', async ({ page }) => {
    await signIn(page)
    await goMapa(page)
    const h = await page.getByRole('button', { name: /^Te ven 3 cercanos/ }).evaluate((e) => e.getBoundingClientRect().height)
    expect(h).toBeGreaterThanOrEqual(44)
  })
})

test.describe('Cerca ahora: amigos cerca de ti, del más cerca al más lejos, dentro de tu rango', () => {
  test('incluye a los cercanos sin plan, ordena por distancia y respeta el rango', async ({ page }) => {
    await signIn(page)
    await goAmigos(page)
    await expect(cerca(page).getByRole('button', { name: 'Rango · 5 km' })).toBeVisible()
    const names = ['Nico', 'Sofi', 'Dani', 'Regina', 'Mau'] // ~600 m, ~800 m, ~900 m y ~900 m (distancia a su lugar exacto), ~1.5 km
    await expect(rows(page)).toHaveCount(5)
    for (const [i, n] of names.entries()) await expect(rows(page).nth(i)).toContainText(n)
    await expect(rows(page).nth(0)).toContainText('Sin plan') // sin plan: se ve que anda cerca
    await expect(rows(page).nth(1)).toContainText('Café')
    await expect(cerca(page).getByText('~600 m')).toBeVisible()
    await expect(cerca(page).getByText('~1.5 km')).toBeVisible()
    await expect(cerca(page).getByText('Leo', { exact: true })).toHaveCount(0) // ubicación en pausa
    await expect(cerca(page).getByText('Karla', { exact: false })).toHaveCount(0) // amiga de amigos: no es "amiga cerca"
    await expectNoAxeViolations(page)

    await setRango(page, '1 km')
    await expect(cerca(page).getByRole('button', { name: 'Rango · 1 km' })).toBeVisible()
    await expect(rows(page)).toHaveCount(4) // todos menos Mau (~1.5 km)
    await expect(cerca(page).getByText('Mau', { exact: true })).toHaveCount(0)
    await setRango(page, '3 km')
    await expect(rows(page)).toHaveCount(5)
  })

  test('si dejas de tener a Nico como cercano, deja de salir; el botón de rango es de 44 px', async ({ page }) => {
    await signIn(page)
    await goAmigos(page)
    const h = await cerca(page).getByRole('button', { name: /^Rango · / }).evaluate((e) => e.getBoundingClientRect().height)
    expect(h).toBeGreaterThanOrEqual(44)
    await goPerfil(page)
    await page.getByRole('link', { name: /^Amigos cercanos/ }).click()
    await page.getByRole('button', { name: 'Ubicación exacta con Nico' }).click()
    await page.getByRole('dialog', { name: 'Ubicación exacta · Nico' }).getByRole('button', { name: 'Quitar de amigos cercanos' }).click()
    await page.getByRole('button', { name: 'Volver al perfil' }).click()
    await goAmigos(page)
    await expect(rows(page)).toHaveCount(4)
    await expect(cerca(page).getByText('Nico', { exact: true })).toHaveCount(0)
  })
})
