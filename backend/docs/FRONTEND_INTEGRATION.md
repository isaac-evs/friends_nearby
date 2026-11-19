# Contrato de integración con ¿Jalas?

Los endpoints anteriores se mantienen. El backend añade una proyección del estado
del frontend y acciones autorizadas. Nunca acepta identidad, XP o confirmaciones
de otra persona como autoridad del navegador.

## Endpoints

| Método/ruta | Uso |
|---|---|
| GET /app/state | Inicialización y sincronización de todas las pantallas |
| GET /app/user?username=nombre | Búsqueda exacta sin @; User del frontend |
| GET /app/user?id=id | Perfil público sujeto a bloqueos |
| POST /app/actions | Acción persistente; devuelve `{result}` |
| POST /auth/forgot | `{email}`; 202 para cuentas existentes/inexistentes |
| POST /auth/reset | `{token,password}`; enlace de un solo uso, 30 minutos |

/app/* exige Bearer JWT. Errores: `{error}` y status HTTP; 409 indica una escritura
concurrente incompatible que se puede reintentar. Las escrituras usan versiones
y transacciones; no hay Scan. El cliente normaliza el ID propio al alias `me`.

## Acciones de POST /app/actions

Todas llevan `type`:

| type | Otros campos |
|---|---|
| setLocation | location: {status,zoneName,center?:{lat,lng}} |
| setOpenMode | openMode: {enabled,adult,bigEvents,smallPlans} |
| toggleRanking | — |
| toggleRoomie | userId de un amigo aceptado |
| saveDraft | draft o null |
| swipe | kind: plan/event, id, action: pass/later |
| resetSwipes | kind; elimina solo pass |
| publishPlan | category,line,durationMin,audience |
| removePlan | id del plan propio |
| publishEvent | eventType,title,startsAt,placeName,capacity,audience,requiresApproval,center? |
| joinEvent / leaveEvent / setPace | id de evento, pace? |
| approveAttendance / rejectAttendance | id de evento,userId; solo organizador |
| jalo | id de plan; resultado: ID del match |
| quickMessage | id de match,message del catálogo |
| confirmMeet | id de match; confirma solo a quien firma el JWT |
| block / wave | userId |
| report | userId,reason del catálogo |

Publicar devuelve la entidad creada. Otras acciones devuelven null salvo las
respuestas idempotentes de incorporación. El cliente refresca el estado tras cada
escritura; nunca simula el resultado de una petición fallida.

## Reglas del servidor

- Registro con username único y bcrypt; JWT propio. Recuperación cambia la
  contraseña y revoca sesiones anteriores mediante session_version.
- Un plan activo por autor; máximo 24 h. Solo amigos aceptados lo ven. Roomies
  añade selección del autor; abierto añade consentimiento y preferencia del lector.
- Eventos amigos, amigos+ (amigo en común) y abiertos. Descubrimiento abierto
  exige consentimiento 18+ y preferencia de eventos. Cupo de 2 a 200.
- Pendientes no ocupan cupo ni dan XP. Solo el organizador aprueba. +40 XP por
  asistencia aceptada, una vez aunque salga y vuelva; +60 al crear evento.
- Jalo acepta la invitación del plan entre amigos: no hay segunda aceptación del
  autor. Ambos reciben el match. Exactitud: máximo una hora o vigencia del plan.
- Para entregar ubicación exacta se revalidan participante, amistad, bloqueo,
  ghost mode y TTL. `/nearby` y las zonas comunes redondean a 0.002°; zonas de 500 m.
- Encuentro: ambas posiciones vigentes a menos de 100 m y confirmación de ambas
  cuentas. +20 XP por persona, sin duplicación. Nivel cada 500 XP; racha por semana
  UTC consecutiva. Insignias calculadas con datos reales.
- Bloqueo en ambas direcciones para búsquedas, amistad, planes, posiciones,
  eventos y matches. Reportes persistidos para revisión; saludos por WS.
- Mapa: amigos con plan activo y ubicación vigente. Zona manual no se hace pasar
  por GPS. Eventos usan la zona elegida; el lugar es descriptivo, sin geocodificación.

## Sincronización

WebSocket de ubicación: `{action:"location",lat,lng}`, permiso concedido, pestaña
visible, ghost apagado. Máximo un envío cada 5 s y captura cada 30 s aun sin
movimiento. En pestaña oculta se detiene; Redis expira en 120 s.

Se conservan eventos de cercanía/amistad. state_changed invalida el estado tras
cambios sociales; wave lleva perfil público. Reconexión creciente y refresco cada
10 s recuperan mensajes perdidos y cambios de eventos entre no amigos.

## Límites operativos

- Sin chat completo, recordatorios de eventos ni push fuera de la aplicación.
- Historial existente sigue activo; ghost evita nuevas posiciones e historial.
- Feed de eventos por Query en una partición, filtrado en servidor. Para mayor
  escala requiere particionar por zona/fecha, paginar la proyección y añadir
  retención. Aún no se limpian entidades sociales antiguas.
- Perfiles: 500 recompensas recientes, 1000 swipes, 500 bloqueos y 100 roomies;
  eventos: 500 registros de asistencia/solicitud. Listas DynamoDB se paginan
  internamente. Los totales de nivel/XP no dependen de conservar todo el historial.
- Correo local en .local/mail. Uploads requieren S3/CloudFront reales.
- Despliegue pendiente de [INFRA_REQUESTS.md](INFRA_REQUESTS.md); AWS no probado.
