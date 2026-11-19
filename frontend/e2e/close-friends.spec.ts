import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations, signIn } from './helpers'

// Navegación del lado del cliente: el estado del mock vive en memoria (un goto lo reinicia).
const tab = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name })
const goPerfil = (page: Page) => tab(page, /^(Perfil|Mi perfil)$/).click()
const goAmigos = (page: Page) => tab(page, /^Amigos/).click()
const goMapa = (page: Page) => tab(page, /^(Mapa|Explorar y mapa)$/).click()
const goInicio = (page: Page) => tab(page, /^Explorar/).click()
const backToProfile = (page: Page) => page.getByRole('button', { name: 'Volver al perfil' }).click()
const cercanos = (page: Page) => page.getByRole('list', { name: 'Amigos cercanos' }).getByRole('listitem')
const invitar = (page: Page) => page.getByRole('list', { name: 'Invitar a ser cercano' }).getByRole('listitem')
const exactBtn = (page: Page, name: string) => page.getByRole('button', { name: `Ubicación exacta con ${name}` })
const sheet = (page: Page, first: string) => page.getByRole('dialog', { name: `Ubicación exacta · ${first}` })

async function openHub(page: Page) {
  await signIn(page)
  await goPerfil(page)
  await page.getByRole('link', { name: /^Amigos cercanos/ }).click()
  await expect(page.getByRole('heading', { name: 'Amigos cercanos', level: 1 })).toBeVisible()
}

test.describe('amigos cercanos: solicitud mutua', () => {
  test('estado inicial: cercanos, una solicitud recibida y a quién invitar', async ({ page }) => {
    await openHub(page)
    await expect(page.getByText('Tu ubicación aproximada la ven 3 personas: Mau, Nico, Sofi.')).toBeVisible()
    await expect(page.getByText('Amigo cercano es de dos vías: los dos tienen que aceptar.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Solicitudes (1)' })).toBeVisible()
    await expect(page.getByText('quiere ser tu amigo cercano')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cercanos (3)' })).toBeVisible()
    await expect(cercanos(page)).toHaveCount(3)
    await expect(page.getByText('Ve tu ubicación aproximada')).toHaveCount(3)
    await expect(page.getByRole('heading', { name: 'Invitar a ser cercano (2)' })).toBeVisible() // Regina y Leo
    await expect(invitar(page)).toHaveCount(2)
    // Quien no es amigo no está; no hay niveles intermedios.
    await expect(page.getByRole('link', { name: /Karla/ })).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('Conocido')
    await expectNoAxeViolations(page)
  })

  test('invitar: queda pendiente (sin ver tu ubicación) y se puede cancelar; si la otra persona acepta pasa a cercanos', async ({ page }) => {
    await openHub(page)
    await page.getByRole('button', { name: 'Invitar a Regina a ser amigo cercano' }).click()
    await expect(page.getByText('Invitación enviada a Regina')).toBeVisible()
    await expect(invitar(page).filter({ hasText: 'Regina' })).toContainText('Esperando a que acepte…')
    // En el mock Regina nunca contesta: sigue pendiente y NO ve tu ubicación.
    await page.waitForTimeout(3600)
    await expect(invitar(page).filter({ hasText: 'Regina' })).toContainText('Esperando a que acepte…')
    await expect(page.getByText('Tu ubicación aproximada la ven 3 personas: Mau, Nico, Sofi.')).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar solicitud a Regina' }).click()
    await expect(page.getByRole('button', { name: 'Invitar a Regina a ser amigo cercano' })).toBeVisible()
    // Leo sí acepta a los pocos segundos.
    await page.getByRole('button', { name: 'Invitar a Leo a ser amigo cercano' }).click()
    await expect(cercanos(page)).toHaveCount(4, { timeout: 8000 })
    await expect(page.getByRole('heading', { name: 'Cercanos (4)' })).toBeVisible()
    await expect(page.getByText('Tu ubicación aproximada la ven 4 personas: Leo, Mau, Nico, Sofi.')).toBeVisible()
    await expect(invitar(page)).toHaveCount(1)
  })

  test('responder una solicitud recibida: aceptar o "Ahora no"', async ({ page }) => {
    await openHub(page)
    await page.getByRole('button', { name: 'Aceptar a Dani como amigo cercano' }).click()
    await expect(page.getByText('Dani ya es amigo cercano')).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Solicitudes/ })).toHaveCount(0)
    await expect(cercanos(page)).toHaveCount(4)
    await expect(page.getByText('Tu ubicación aproximada la ven 4 personas: Dani, Mau, Nico, Sofi.')).toBeVisible()
  })

  test('"Ahora no" deja a la persona como amigo normal (se puede invitar después)', async ({ page }) => {
    await openHub(page)
    await page.getByRole('button', { name: 'Ahora no: Dani' }).click()
    await expect(page.getByRole('heading', { name: /^Solicitudes/ })).toHaveCount(0)
    await expect(cercanos(page)).toHaveCount(3)
    await expect(invitar(page).filter({ hasText: 'Dani' })).toBeVisible()
  })

  test('la solicitud también llega a la pestaña Amigos (solo para responder; ahí no se invita ni se edita)', async ({ page }) => {
    await signIn(page)
    await goAmigos(page)
    await expect(page.getByRole('link', { name: /Amigos cercanos/ })).toHaveCount(0)
    const reg = page.getByRole('region', { name: 'Solicitudes de amigo cercano' })
    await expect(reg).toContainText('Dani')
    await expect(reg).toContainText('quiere ser tu amigo cercano')
    await reg.getByRole('button', { name: 'Aceptar a Dani como amigo cercano' }).click()
    await expect(page.getByRole('region', { name: 'Solicitudes de amigo cercano' })).toHaveCount(0)
    await goPerfil(page)
    await expect(page.getByRole('link', { name: /^Amigos cercanos/ })).toContainText('4 cercanos')
  })

  test('en el perfil de un amigo no hay nada de amigo cercano', async ({ page }) => {
    await signIn(page)
    await goAmigos(page)
    await page.getByPlaceholder('Busca por @usuario').fill('@sofi')
    await page.getByRole('region', { name: 'Resultados de búsqueda' }).getByRole('link', { name: 'Sofi' }).click()
    await expect(page.getByRole('heading', { name: 'Sofi', level: 1 })).toBeVisible()
    await expect(page.getByText(/cercano/i)).toHaveCount(0)
    await expect(page.getByRole('switch')).toHaveCount(0)
  })
})

test.describe('amigos cercanos: privacidad de la ubicación', () => {
  test('al quitar a todos los cercanos, nadie ve tu ubicación', async ({ page }) => {
    await openHub(page)
    for (const [first, name] of [['Sofi', 'Sofi'], ['Mau', 'Mau'], ['Nico', 'Nico']]) {
      await exactBtn(page, name).click()
      await sheet(page, first).getByRole('button', { name: 'Quitar de amigos cercanos' }).click()
      await expect(page.getByText(`${first} ya no es amigo cercano`)).toBeVisible()
    }
    await expect(page.getByText('Nadie ve tu ubicación aproximada ahora. Invita a un amigo a ser cercano para compartirla.')).toBeVisible()
    // Dani (solicitud pendiente de ti) tampoco la ve.
    await expect(page.getByRole('heading', { name: 'Cercanos (0)' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('modo fantasma: nadie la ve (ni cercanos), conserva la relación y corta lo que compartías', async ({ page }) => {
    await openHub(page)
    await exactBtn(page, 'Sofi').click()
    await sheet(page, 'Sofi').getByRole('button', { name: '1 h' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('Compartes tu ubicación exacta con Sofi.')).toBeVisible()

    await page.getByRole('switch', { name: 'Modo fantasma' }).click()
    await expect(page.getByText('Modo fantasma: nadie ve tu ubicación ahora, ni tus cercanos.')).toBeVisible()
    await expect(page.getByText('No te ve: modo fantasma')).toHaveCount(3)
    await expect(page.getByText(/Compartes tu ubicación exacta con/)).toHaveCount(0) // se cortó
    await expect(page.getByRole('heading', { name: 'Cercanos (3)' })).toBeVisible() // la relación sigue
    // En modo fantasma no se puede compartir la exacta.
    await exactBtn(page, 'Sofi').click()
    await expect(sheet(page, 'Sofi')).toContainText('Estás en modo fantasma')
    await expect(sheet(page, 'Sofi').getByRole('button', { name: '30 min' })).toHaveCount(0)
    await expectNoAxeViolations(page)
    await page.keyboard.press('Escape')

    // Sigue viendo el mapa y puede jalar un plan.
    await backToProfile(page)
    await expect(page.getByRole('link', { name: /^Amigos cercanos/ })).toContainText('3 cercanos')
    await goMapa(page)
    await expect(page.getByText('Modo fantasma: nadie te ve')).toBeVisible()
    await expect(page.getByRole('button', { name: /Dani: plan en Tortas ahogadas/ })).toBeVisible()
    await goInicio(page)
    await page.getByRole('button', { name: 'Jalo', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
  })

  test('se refleja en mapa, publicar y perfil', async ({ page }) => {
    await signIn(page)
    await goMapa(page)
    await expect(page.getByText('Te ven 3 cercanos')).toBeVisible()
    await page.getByRole('link', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('El plan se ve en su lugar exacto')).toBeVisible()
    await goPerfil(page)
    await expect(page.getByRole('link', { name: /^Amigos cercanos/ })).toContainText('3 cercanos')
  })

  test('las preferencias sobreviven a recargar; lo pendiente no', async ({ page }) => {
    await openHub(page)
    await page.getByRole('button', { name: 'Aceptar a Dani como amigo cercano' }).click()
    await exactBtn(page, 'Sofi').click()
    await sheet(page, 'Sofi').getByRole('button', { name: 'Quitar de amigos cercanos' }).click()
    await page.getByRole('button', { name: 'Invitar a Regina a ser amigo cercano' }).click() // pendiente
    await page.reload()
    await expect(page.getByText('Tu ubicación aproximada la ven 3 personas: Dani, Mau, Nico.')).toBeVisible()
    await expect(cercanos(page)).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Invitar a Regina a ser amigo cercano' })).toBeVisible() // la solicitud pendiente no se guardó
    await expect(page.getByRole('button', { name: 'Invitar a Sofi a ser amigo cercano' })).toBeVisible()
  })

  test('valores guardados por versiones anteriores se leen bien ("cercano" → mutuo, "amigo/conocido" → normal)', async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('jalas.mock.v1')) localStorage.setItem('jalas.mock.v1', JSON.stringify({ closeness: { leo: 'cercano', sofi: 'amigo', mau: 'conocido' } }))
    })
    await openHub(page)
    await expect(page.getByText('Tu ubicación aproximada la ven 2 personas: Leo, Nico.')).toBeVisible()
  })

  test('los botones cumplen objetivos táctiles de 44 px', async ({ page }) => {
    await openHub(page)
    const names = [/^Invitar a /, /^Ubicación exacta con /, /^Aceptar a /, /^Ahora no: /]
    let count = 0
    for (const n of names) {
      const heights = await page.getByRole('button', { name: n }).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
      count += heights.length
      for (const h of heights) expect(h).toBeGreaterThanOrEqual(44)
    }
    expect(count).toBeGreaterThanOrEqual(7)
  })
})

test.describe('ubicación exacta temporal', () => {
  test('compartir la tuya: elegir cuánto, ver el aviso, y cortarla', async ({ page }) => {
    await openHub(page)
    await exactBtn(page, 'Sofi').click()
    const dlg = sheet(page, 'Sofi')
    await expect(dlg).toContainText('Solo Sofi ve tu punto exacto y solo mientras dure')
    const options = dlg.getByRole('group', { name: 'Compartir mi ubicación exacta con Sofi por' }).getByRole('button')
    await expect(options).toHaveText(['30 min', '1 h', '2 h', '4 h'])
    await dlg.getByRole('button', { name: '1 h' }).click()
    await expect(dlg.getByText(/Compartiendo con Sofi hasta las .* \(60 min\)/)).toBeVisible()
    await expectNoAxeViolations(page)
    await dlg.getByRole('button', { name: 'Dejar de compartir' }).click()
    await expect(dlg.getByRole('button', { name: '30 min' })).toBeVisible()
    await dlg.getByRole('button', { name: '30 min' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('Compartes tu ubicación exacta con Sofi.')).toBeVisible()
    await expect(cercanos(page).filter({ hasText: 'Sofi' })).toContainText('Compartes tu exacta hasta las')

    // En el mapa se dice en voz alta mientras dura.
    await backToProfile(page)
    await goMapa(page)
    await expect(page.getByText('Exacta con 1 amigo')).toBeVisible()
  })

  test('pedir la suya: espera, acepta y se ve en el mapa (plan de Sofi, y Nico que está chilling)', async ({ page }) => {
    await openHub(page)
    await exactBtn(page, 'Sofi').click()
    await sheet(page, 'Sofi').getByRole('button', { name: 'Pedirle su ubicación exacta' }).click()
    await expect(sheet(page, 'Sofi')).toContainText('Esperando a que Sofi acepte…')
    await expect(sheet(page, 'Sofi')).toContainText('te comparte su ubicación exacta hasta las', { timeout: 8000 })
    await page.keyboard.press('Escape')
    await exactBtn(page, 'Nico').click()
    await sheet(page, 'Nico').getByRole('button', { name: 'Pedirle su ubicación exacta' }).click()
    await expect(sheet(page, 'Nico')).toContainText('te comparte su ubicación exacta hasta las', { timeout: 8000 })
    await sheet(page, 'Nico').getByRole('link', { name: 'Verla en el mapa' }).click()

    // Sofi (tiene plan): su marcador pasa a exacto, pero puedes seguir jalando su plan.
    const sofi = page.getByRole('button', { name: /Sofi: ubicación exacta compartida/ })
    await expect(sofi).toBeVisible()
    await expect(sofi).toContainText('exacta')
    if (test.info().project.name !== 'desktop') {
      const hoja = page.getByRole('region', { name: 'Seleccionado en el mapa' }) // Sofi es la seleccionada por defecto
      await expect(hoja).toContainText('Sofi · Café')
      await expect(hoja).toContainText('Ubicación exacta compartida hasta las')
      await expect(hoja.getByRole('button', { name: 'Jalo' })).toBeVisible()
    }
    // Nico (sin plan): sigue "chilling", ahora con punto exacto.
    const nico = page.getByRole('button', { name: /Nico: sin plan, ubicación exacta compartida/ })
    await expect(nico).toBeVisible()
    await expect(nico).toContainText('Nico · exacta')
    // Un amigo cercano que no la compartió sigue aproximado.
    await expect(page.getByRole('button', { name: /Mau: plan en Entrada/ })).toBeVisible()
  })

  test('si dejan de ser cercanos, se corta la exacta y desaparece del mapa', async ({ page }) => {
    await openHub(page)
    await exactBtn(page, 'Nico').click()
    await sheet(page, 'Nico').getByRole('button', { name: 'Pedirle su ubicación exacta' }).click()
    await expect(sheet(page, 'Nico')).toContainText('te comparte su ubicación exacta', { timeout: 8000 })
    await sheet(page, 'Nico').getByRole('button', { name: 'Quitar de amigos cercanos' }).click()
    await backToProfile(page)
    await goMapa(page)
    await expect(page.getByRole('button', { name: /Dani: plan en Tortas ahogadas/ })).toBeVisible() // el mapa ya cargó
    await expect(page.getByRole('button', { name: /Nico: sin plan/ })).toHaveCount(0)
  })
})
