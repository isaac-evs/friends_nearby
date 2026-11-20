# Evidencia

Capturas de la app, de dos flujos completos y de la infraestructura.

> **Written for:** quien revisa el proyecto y quiere ver cómo se ve y cómo funciona sin ejecutarlo.

## Contenido

```
docs/evidence/
├── app/
│   ├── mobile/    25 pantallas en iPhone 14 (390 × 844)
│   └── desktop/   25 pantallas en escritorio (1440 × 900)
├── flows/
│   ├── plan/      7 pasos: publicar → ver → unirse → lobby → check-in → XP
│   └── evento/    3 pasos: crear (tipo "Otro" con ícono y color) → publicado → visto por otra persona
└── infra/         Diagrama del README de infra, renderizado desde infra/docs/architecture.mmd
```

Los diagramas de arquitectura y de reglas están en [`../diagrams/`](../diagrams/) (HTML interactivo y PNG).

## Pantallas (celular y escritorio)

Cada fila es una pantalla. Haz clic en una imagen para verla a tamaño completo.

| Pantalla | Celular (iPhone 14) | Escritorio (1440 × 900) |
|---|---|---|
| **01 · Entrar** | <a href="app/mobile/01-entrar.png"><img src="app/mobile/01-entrar.png" width="190" alt="Entrar en celular"></a> | <a href="app/desktop/01-entrar.png"><img src="app/desktop/01-entrar.png" width="520" alt="Entrar en escritorio"></a> |
| **02 · Registro** | <a href="app/mobile/02-registro.png"><img src="app/mobile/02-registro.png" width="190" alt="Registro en celular"></a> | <a href="app/desktop/02-registro.png"><img src="app/desktop/02-registro.png" width="520" alt="Registro en escritorio"></a> |
| **03 · Permiso de ubicación** | <a href="app/mobile/03-permiso.png"><img src="app/mobile/03-permiso.png" width="190" alt="Permiso de ubicación en celular"></a> | <a href="app/desktop/03-permiso.png"><img src="app/desktop/03-permiso.png" width="520" alt="Permiso de ubicación en escritorio"></a> |
| **04 · Explorar** | <a href="app/mobile/04-explorar.png"><img src="app/mobile/04-explorar.png" width="190" alt="Explorar en celular"></a> | <a href="app/desktop/04-explorar.png"><img src="app/desktop/04-explorar.png" width="520" alt="Explorar en escritorio"></a> |
| **05 · Mapa** | <a href="app/mobile/05-mapa.png"><img src="app/mobile/05-mapa.png" width="190" alt="Mapa en celular"></a> | <a href="app/desktop/05-mapa.png"><img src="app/desktop/05-mapa.png" width="520" alt="Mapa en escritorio"></a> |
| **06 · Publicar plan** | <a href="app/mobile/06-publicar-plan.png"><img src="app/mobile/06-publicar-plan.png" width="190" alt="Publicar plan en celular"></a> | <a href="app/desktop/06-publicar-plan.png"><img src="app/desktop/06-publicar-plan.png" width="520" alt="Publicar plan en escritorio"></a> |
| **07 · Crear evento** | <a href="app/mobile/07-publicar-evento.png"><img src="app/mobile/07-publicar-evento.png" width="190" alt="Crear evento en celular"></a> | <a href="app/desktop/07-publicar-evento.png"><img src="app/desktop/07-publicar-evento.png" width="520" alt="Crear evento en escritorio"></a> |
| **08 · Amigos** | <a href="app/mobile/08-amigos.png"><img src="app/mobile/08-amigos.png" width="190" alt="Amigos en celular"></a> | <a href="app/desktop/08-amigos.png"><img src="app/desktop/08-amigos.png" width="520" alt="Amigos en escritorio"></a> |
| **09 · Ranking** | <a href="app/mobile/09-ranking.png"><img src="app/mobile/09-ranking.png" width="190" alt="Ranking en celular"></a> | <a href="app/desktop/09-ranking.png"><img src="app/desktop/09-ranking.png" width="520" alt="Ranking en escritorio"></a> |
| **10 · Mis planes** | <a href="app/mobile/10-mis-planes.png"><img src="app/mobile/10-mis-planes.png" width="190" alt="Mis planes en celular"></a> | <a href="app/desktop/10-mis-planes.png"><img src="app/desktop/10-mis-planes.png" width="520" alt="Mis planes en escritorio"></a> |
| **11 · Plan** | <a href="app/mobile/11-plan-detalle.png"><img src="app/mobile/11-plan-detalle.png" width="190" alt="Plan en celular"></a> | <a href="app/desktop/11-plan-detalle.png"><img src="app/desktop/11-plan-detalle.png" width="520" alt="Plan en escritorio"></a> |
| **12 · Evento (de otra persona)** | <a href="app/mobile/12-evento-detalle.png"><img src="app/mobile/12-evento-detalle.png" width="190" alt="Evento (de otra persona) en celular"></a> | <a href="app/desktop/12-evento-detalle.png"><img src="app/desktop/12-evento-detalle.png" width="520" alt="Evento (de otra persona) en escritorio"></a> |
| **13 · Evento (propio)** | <a href="app/mobile/13-evento-propio.png"><img src="app/mobile/13-evento-propio.png" width="190" alt="Evento (propio) en celular"></a> | <a href="app/desktop/13-evento-propio.png"><img src="app/desktop/13-evento-propio.png" width="520" alt="Evento (propio) en escritorio"></a> |
| **14 · Notificaciones** | <a href="app/mobile/14-notificaciones.png"><img src="app/mobile/14-notificaciones.png" width="190" alt="Notificaciones en celular"></a> | <a href="app/desktop/14-notificaciones.png"><img src="app/desktop/14-notificaciones.png" width="520" alt="Notificaciones en escritorio"></a> |
| **15 · Preferencias de notificaciones** | <a href="app/mobile/15-preferencias-notificaciones.png"><img src="app/mobile/15-preferencias-notificaciones.png" width="190" alt="Preferencias de notificaciones en celular"></a> | <a href="app/desktop/15-preferencias-notificaciones.png"><img src="app/desktop/15-preferencias-notificaciones.png" width="520" alt="Preferencias de notificaciones en escritorio"></a> |
| **16 · Perfil** | <a href="app/mobile/16-perfil.png"><img src="app/mobile/16-perfil.png" width="190" alt="Perfil en celular"></a> | <a href="app/desktop/16-perfil.png"><img src="app/desktop/16-perfil.png" width="520" alt="Perfil en escritorio"></a> |
| **17 · Editar perfil** | <a href="app/mobile/17-editar-perfil.png"><img src="app/mobile/17-editar-perfil.png" width="190" alt="Editar perfil en celular"></a> | <a href="app/desktop/17-editar-perfil.png"><img src="app/desktop/17-editar-perfil.png" width="520" alt="Editar perfil en escritorio"></a> |
| **18 · Nivel · Progreso** | <a href="app/mobile/18-nivel-progreso.png"><img src="app/mobile/18-nivel-progreso.png" width="190" alt="Nivel · Progreso en celular"></a> | <a href="app/desktop/18-nivel-progreso.png"><img src="app/desktop/18-nivel-progreso.png" width="520" alt="Nivel · Progreso en escritorio"></a> |
| **19 · Nivel · Niveles** | <a href="app/mobile/19-nivel-niveles.png"><img src="app/mobile/19-nivel-niveles.png" width="190" alt="Nivel · Niveles en celular"></a> | <a href="app/desktop/19-nivel-niveles.png"><img src="app/desktop/19-nivel-niveles.png" width="520" alt="Nivel · Niveles en escritorio"></a> |
| **20 · Nivel · Historial** | <a href="app/mobile/20-nivel-historial.png"><img src="app/mobile/20-nivel-historial.png" width="190" alt="Nivel · Historial en celular"></a> | <a href="app/desktop/20-nivel-historial.png"><img src="app/desktop/20-nivel-historial.png" width="520" alt="Nivel · Historial en escritorio"></a> |
| **21 · Amigos cercanos (privacidad)** | <a href="app/mobile/21-privacidad-amigos-cercanos.png"><img src="app/mobile/21-privacidad-amigos-cercanos.png" width="190" alt="Amigos cercanos (privacidad) en celular"></a> | <a href="app/desktop/21-privacidad-amigos-cercanos.png"><img src="app/desktop/21-privacidad-amigos-cercanos.png" width="520" alt="Amigos cercanos (privacidad) en escritorio"></a> |
| **22 · Modo abierto** | <a href="app/mobile/22-modo-abierto.png"><img src="app/mobile/22-modo-abierto.png" width="190" alt="Modo abierto en celular"></a> | <a href="app/desktop/22-modo-abierto.png"><img src="app/desktop/22-modo-abierto.png" width="520" alt="Modo abierto en escritorio"></a> |
| **23 · Guardados** | <a href="app/mobile/23-guardados.png"><img src="app/mobile/23-guardados.png" width="190" alt="Guardados en celular"></a> | <a href="app/desktop/23-guardados.png"><img src="app/desktop/23-guardados.png" width="520" alt="Guardados en escritorio"></a> |
| **24 · Perfil de otra persona** | <a href="app/mobile/24-perfil-de-otra-persona.png"><img src="app/mobile/24-perfil-de-otra-persona.png" width="190" alt="Perfil de otra persona en celular"></a> | <a href="app/desktop/24-perfil-de-otra-persona.png"><img src="app/desktop/24-perfil-de-otra-persona.png" width="520" alt="Perfil de otra persona en escritorio"></a> |
| **25 · Legal** | <a href="app/mobile/25-legal.png"><img src="app/mobile/25-legal.png" width="190" alt="Legal en celular"></a> | <a href="app/desktop/25-legal.png"><img src="app/desktop/25-legal.png" width="520" alt="Legal en escritorio"></a> |

## Flujos

### Flujo de un plan

Quien organiza publica, un amigo lo ve en Explorar y se une, se abre el lobby, hace check-in y gana XP.

| Paso | Captura |
|---|---|
| 01 · Formulario plan | <a href="flows/plan/01-formulario-plan.png"><img src="flows/plan/01-formulario-plan.png" width="260" alt="Formulario plan"></a> |
| 02 · Plan publicado organizador | <a href="flows/plan/02-plan-publicado-organizador.png"><img src="flows/plan/02-plan-publicado-organizador.png" width="260" alt="Plan publicado organizador"></a> |
| 03 · Amigo lo ve en explorar | <a href="flows/plan/03-amigo-lo-ve-en-explorar.png"><img src="flows/plan/03-amigo-lo-ve-en-explorar.png" width="260" alt="Amigo lo ve en explorar"></a> |
| 04 · Amigo se une | <a href="flows/plan/04-amigo-se-une.png"><img src="flows/plan/04-amigo-se-une.png" width="260" alt="Amigo se une"></a> |
| 05 · Lobby ya llegue | <a href="flows/plan/05-lobby-ya-llegue.png"><img src="flows/plan/05-lobby-ya-llegue.png" width="260" alt="Lobby ya llegue"></a> |
| 06 · Check in hecho | <a href="flows/plan/06-check-in-hecho.png"><img src="flows/plan/06-check-in-hecho.png" width="260" alt="Check in hecho"></a> |
| 07 · Xp en historial | <a href="flows/plan/07-xp-en-historial.png"><img src="flows/plan/07-xp-en-historial.png" width="260" alt="Xp en historial"></a> |

### Flujo de un evento

Se crea un evento tipo "Otro" con ícono y color propios, y otra persona lo ve.

| Paso | Captura |
|---|---|
| 01 · Crear evento otro con icono y color | <a href="flows/evento/01-crear-evento-otro-con-icono-y-color.png"><img src="flows/evento/01-crear-evento-otro-con-icono-y-color.png" width="260" alt="Crear evento otro con icono y color"></a> |
| 02 · Evento publicado organizador | <a href="flows/evento/02-evento-publicado-organizador.png"><img src="flows/evento/02-evento-publicado-organizador.png" width="260" alt="Evento publicado organizador"></a> |
| 03 · Otra persona ve el evento | <a href="flows/evento/03-otra-persona-ve-el-evento.png"><img src="flows/evento/03-otra-persona-ve-el-evento.png" width="260" alt="Otra persona ve el evento"></a> |

## Infraestructura

<a href="infra/infra-readme-architecture.png"><img src="infra/infra-readme-architecture.png" width="900" alt="Diagrama de infraestructura del README de infra"></a>

## Cómo se generaron

Con datos de demostración: seis cuentas ficticias, planes y eventos con horarios relativos a "ahora" (hora de México) y
lugares de Guadalajara. Las ubicaciones son puntos de prueba, no de personas reales.

```bash
# backend/ — instancia aislada con tablas propias (no toca tus datos)
PORT=8081 USERS_TABLE=shots-users FRIENDSHIPS_TABLE=shots-friendships CONNECTIONS_TABLE=shots-connections \
  SOCIAL_TABLE=shots-social go run ./cmd/local

# frontend/
VITE_API_URL=http://localhost:8081 VITE_WS_URL=ws://localhost:8081/ws npx vite --port 5174
npm run evidence
```

`npm run evidence` borra y vuelve a crear `app/` y `flows/`. Cada corrida crea cuentas nuevas.

El script es [`frontend/scripts/capture-evidence.mjs`](../../frontend/scripts/capture-evidence.mjs). La infraestructura se
renderizó con Mermaid CLI a partir de [`infra/docs/architecture.mmd`](../../infra/docs/architecture.mmd).

## Límites

- Las capturas de pantallas largas se toman con el alto completo de la página, así que la barra inferior aparece al final.
- El mapa carga el mapa base de CARTO por internet; sin conexión, la captura del mapa sale sin calles.
- Las fotos de planes y eventos no se subieron (S3 local no firma las URL): las tarjetas muestran el ícono del tipo.
