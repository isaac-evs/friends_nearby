import { expect, test } from '@playwright/test'
import { expectNoAxeViolations, signIn } from './helpers'

test.describe('flujos principales (mock)', () => {
  test('entrar → zona manual → jalar → match → ya nos vimos (XP solo con ambos)', async ({ page }) => {
    await signIn(page)
    await expect(page.getByText('Por un café en Providencia, ¿alguien?').first()).toBeVisible()
    await page.getByRole('button', { name: 'Jalo', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await expect(page.getByText(/Tu ubicación solo la usa el sistema, una vez, para comprobar que llegaste/)).toBeVisible()
    await page.getByRole('button', { name: 'Voy en 10' }).click()
    await expect(page.getByText('Enviado a Sofi: “Voy en 10”')).toBeVisible()
    await page.getByRole('button', { name: 'Ya nos vimos' }).click()
    await expect(page.getByText('Esperando a que Sofi confirme…')).toBeVisible()
    await expect(page.getByText(/Los dos confirmaron/)).toBeVisible({ timeout: 6000 })
    await expect(page.getByText(/racha de 5 semanas/)).toBeVisible()
  })

  test('privacidad: un match NO da ubicación exacta; solo la comparte un amigo cercano por un rato', async ({ page }) => {
    await signIn(page)
    await page.goto('/mapa')
    await expect(page.getByRole('button', { name: /Café\s*,\s*Sofi: plan en Café Ámbar, lugar exacto/ })).toBeVisible()
    await expect(page.getByText('Exacta', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Jalo', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await page.getByRole('link', { name: 'Ver dónde es en el mapa' }).click()
    // Con match, el plan sigue en su lugar exacto y Sofi no comparte su ubicación.
    await expect(page.getByRole('button', { name: /Café\s*,\s*Sofi: plan en Café Ámbar, lugar exacto/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sofi: ubicación exacta/ })).toHaveCount(0)
  })

  test('verificar que estamos juntos: solo el sistema usa la ubicación y nadie ve coordenadas', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Jalo', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await expect(page.getByText(/Ni Sofi ni nadie la ve/)).toBeVisible()
    await page.getByRole('button', { name: 'Verificar que estoy aquí' }).click()
    await expect(page.getByText('Verificado: llegaste al punto de encuentro.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Verificar que estoy aquí' })).toHaveCount(0)
    // Ninguna coordenada (decimales largos tipo 20.6736) llega a la pantalla.
    expect(await page.locator('body').innerText()).not.toMatch(/-?\d{1,3}\.\d{4,}/)
    await expectNoAxeViolations(page)
  })

  test('modo abierto: apagado por defecto, 18+ obligatorio, luego eventos y Me uno', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /^Abierto/ }).click()
    await expect(page.getByRole('heading', { name: 'El modo abierto está apagado' })).toBeVisible()
    await page.goto('/modo-abierto')
    const activate = page.getByRole('button', { name: 'Activar modo abierto' })
    await expect(activate).toBeDisabled()
    await page.getByLabel('Confirmo que tengo 18 años o más').check()
    await expect(activate).toBeEnabled()
    await activate.click()
    await page.getByRole('button', { name: /^Abierto/ }).click()
    await expect(page.getByRole('heading', { name: 'Social Run 5K en Colomos' })).toBeVisible()
    await page.getByRole('button', { name: 'Deporte', exact: true }).click()
    await page.getByRole('button', { name: 'Me uno', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Social Run 5K en Colomos' })).toBeVisible()
    await page.getByRole('button', { name: /^Me uno · / }).click()
    await expect(page.getByText('¡Estás dentro!')).toBeVisible()
    await page.getByRole('button', { name: 'Salirme' }).click()
    await expect(page.getByRole('button', { name: /^Me uno · / })).toBeVisible()
  })

  test('publicar plan y crear evento validan campos', async ({ page }) => {
    await signIn(page)
    await page.goto('/publicar')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Cuéntales qué andas haciendo')).toBeVisible()
    await expect(page.getByText('Escribe cómo se llama el lugar')).toBeVisible() // el lugar es obligatorio
    await page.getByLabel('Cuéntales en una línea').fill('Tacos en el centro')
    await page.getByLabel('¿Dónde es?').fill('Taquería El Güero')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Márcalo en el mapa')).toBeVisible() // con nombre pero sin punto exacto
    await page.getByRole('button', { name: 'Elegir en el mapa' }).click()
    await page.getByRole('button', { name: 'Usar este lugar' }).click()
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Plan publicado')).toBeVisible()

    await page.goto('/publicar/evento')
    await page.getByRole('button', { name: 'Publicar evento' }).click()
    await expect(page.getByText('Ponle un nombre al evento')).toBeVisible()
    await page.getByLabel('Nombre del evento').fill('Reta de fut en la cancha')
    await page.getByLabel('¿Dónde?').fill('Cancha Revolución')
    await page.getByRole('button', { name: 'Elegir en el mapa' }).click()
    await page.getByRole('button', { name: 'Usar este lugar' }).click()
    await page.getByRole('button', { name: 'Más cupo' }).click()
    await page.getByRole('button', { name: 'Publicar evento' }).click()
    await expect(page.getByRole('heading', { name: 'Reta de fut en la cancha' })).toBeVisible()
  })

  test('amigos: aceptar y rechazar solicitudes, buscar por @usuario', async ({ page }) => {
    await signIn(page)
    await page.goto('/amigos')
    await expect(page.getByRole('heading', { name: 'Solicitudes (2)' })).toBeVisible()
    await page.getByRole('button', { name: 'Aceptar a Pau' }).click()
    await page.getByRole('button', { name: 'Rechazar a Beto' }).click()
    await expect(page.getByRole('heading', { name: /Solicitudes/ })).toHaveCount(0)
    await page.getByPlaceholder('Busca por @usuario').fill('@karla')
    await page.getByRole('button', { name: 'Agregar' }).click()
    await expect(page.getByText('Solicitud enviada', { exact: true })).toBeVisible()
  })

  test('perfil: modo fantasma y bloquear a alguien lo oculta', async ({ page }) => {
    await signIn(page)
    await page.goto('/perfil')
    const ghost = page.getByRole('switch', { name: 'Modo fantasma' })
    await expect(ghost).toHaveAttribute('aria-checked', 'false')
    await ghost.click()
    await expect(ghost).toHaveAttribute('aria-checked', 'true')
    await page.goto('/u/karla')
    await page.getByRole('button', { name: 'Más opciones' }).click()
    await page.getByRole('menuitem', { name: /Bloquear a Karla/ }).click()
    await expect(page.getByRole('heading', { name: 'Tu banda' })).toBeVisible()
    await page.getByPlaceholder('Busca por @usuario').fill('karla')
    await expect(page.getByText(/No encontramos a nadie/)).toBeVisible()
  })

  test('ruta protegida redirige a /entrar y recuperación responde igual', async ({ page }) => {
    await page.goto('/amigos')
    await expect(page).toHaveURL(/\/entrar/)
    await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
    await page.getByLabel('Correo').fill('nadie@correo.com')
    await page.getByRole('button', { name: 'Mandar link' }).click()
    await expect(page.getByText(/Si ese correo tiene cuenta/)).toBeVisible()
  })
})

test.describe('guardados', () => {
  test('Luego guarda el plan y se puede quitar desde Guardados', async ({ page }) => {
    await signIn(page)
    await expect(page.getByText('Por un café en Providencia, ¿alguien?').first()).toBeVisible()
    await page.getByRole('button', { name: 'Guardar para luego' }).click()
    await expect(page.getByText('Guardado en tu lista')).toBeVisible()
    await page.getByRole('link', { name: /^Guardados/ }).click()
    await expect(page.getByRole('heading', { name: 'Guardados' })).toBeVisible()
    await expect(page.getByText('Planes de amigos (1)')).toBeVisible()
    await expect(page.getByText('Por un café en Providencia, ¿alguien?')).toBeVisible()
    await page.getByRole('button', { name: 'Quitar plan de Sofi' }).click()
    await expect(page.getByRole('heading', { name: /Aquí caen tus/ })).toBeVisible()
  })

  test('jalar desde Guardados lleva al match', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Guardar para luego' }).click()
    // Acceso desde la UI: marcador con contador (móvil) o menú lateral (desktop).
    await page.getByRole('link', { name: /^Guardados/ }).click()
    await page.getByRole('button', { name: 'Jalo con Sofi' }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
  })
})

test.describe('mapa', () => {
  test('lista en móvil: buscador fijo mientras la lista hace scroll; la nota del círculo solo en amigos cercanos sin plan', async ({ page }, info) => {
    await signIn(page)
    await page.evaluate(() => localStorage.setItem('x', '1'))
    await page.goto('/modo-abierto')
    await page.getByLabel('Confirmo que tengo 18 años o más').check()
    await page.getByRole('button', { name: 'Activar modo abierto' }).click()
    await page.goto('/mapa?sel=chill-nico')
    if (info.project.name === 'desktop') {
      await expect(page.getByText('Círculo = ubicación aproximada')).toBeVisible()
      await page.getByRole('button', { name: /Social Run/ }).click()
      await expect(page.getByText('Círculo = ubicación aproximada')).toHaveCount(0)
      return
    }
    await expect(page.getByText('Círculo = ubicación aproximada')).toBeVisible()
    await page.getByRole('button', { name: 'Eventos', exact: true }).click()
    await expect(page.getByText('Círculo = ubicación aproximada')).toHaveCount(0)
    await page.getByRole('button', { name: 'Todos', exact: true }).click()
    await page.getByRole('button', { name: 'Lista', exact: true }).click()
    const search = page.getByPlaceholder('Buscar amigo o evento')
    const before = (await search.boundingBox())!
    await page.mouse.move(200, 500)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(300)
    const after = (await search.boundingBox())!
    expect(after.y).toBe(before.y)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})

test.describe('accesibilidad (axe)', () => {
  test('pantallas sin sesión', async ({ page }) => {
    await page.goto('/entrar'); await expectNoAxeViolations(page)
    await page.goto('/dev/ui'); await expectNoAxeViolations(page)
  })
  test('pantallas con sesión', async ({ page }) => {
    test.setTimeout(120_000) // recorre ~20 pantallas, cada una con carga de red y axe
    await signIn(page)
    for (const url of ['/', '/mapa', '/publicar', '/publicar/evento', '/amigos', '/guardados', '/perfil', '/perfil/editar', '/perfil/nivel', '/perfil/nivel?tab=niveles', '/perfil/nivel?tab=historial', '/privacidad', '/amigos?tab=ranking', '/modo-abierto', '/evento/evt-run', '/u/pau']) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await expectNoAxeViolations(page)
    }
  })
})
