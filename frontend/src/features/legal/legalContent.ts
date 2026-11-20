/** Texto legal de la app. Es el contenido base: debe revisarlo quien sea el responsable legal antes de publicar. */
export const LEGAL_UPDATED = '19 de noviembre de 2026'

export interface LegalSection { id: string; title: string; items: string[] }

export const LEGAL_SECTIONS: LegalSection[] = [
  {
    id: 'responsable',
    title: 'Quién es responsable de tus datos',
    items: [
      '¿Jalas? es un proyecto escolar (ITESO, Sistemas Escalables). El equipo del proyecto es responsable del tratamiento de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México).',
    ],
  },
  {
    id: 'datos',
    title: 'Qué datos tratamos y para qué',
    items: [
      'Cuenta: correo, nombre, nombre de usuario, contraseña (guardada cifrada) y foto. Sirven para crear tu cuenta y que tus amigos te reconozcan.',
      'Planes y eventos: lo que publicas, a lo que te unes, tus mensajes en el chat del plan y tu asistencia. Sirven para organizar y para tu historial, XP y confiabilidad.',
      'Ubicación: para mostrarte lo que hay cerca, avisar a tus amigos a cuántos metros estás y verificar que llegaste a un plan. Es opcional; sin ella puedes elegir tu zona a mano.',
      'No usamos tu ubicación para publicidad ni la vendemos. La ubicación nunca va a analítica, registros técnicos ni notificaciones.',
    ],
  },
  {
    id: 'ubicacion',
    title: 'Tu ubicación: quién ve qué',
    items: [
      'Tu ubicación se usa solo para mostrarte lo cercano y para verificar que llegaste al lugar de un plan.',
      'Amigos cercanos mutuos: te ven aproximada en el mapa siempre que estés conectado (sin límite de distancia).',
      'Amigos: solo ven a cuántos metros estás (redondeado a 100 m), sin coordenadas y nunca en el mapa.',
      'Quienes van a un mismo plan: ven a cuánto estás del lugar del plan (redondeado a 100 m), nunca dónde andas.',
      'Quien no es tu amigo no ve tu ubicación. Tu ubicación exacta solo se comparte si tú la compartes, por el tiempo que elijas, con un amigo cercano.',
      'Si te desconectas, tus amigos ven tu última ubicación aproximada con “hace cuánto”.',
      'Guardamos la ubicación aproximada (redondeada a celdas de unos cientos de metros), no la coordenada exacta, salvo mientras compartas la exacta.',
    ],
  },
  {
    id: 'verificacion',
    title: 'Verificación de llegada',
    items: [
      'Al tocar “Ya llegué” usamos tu ubicación una sola vez para comprobar que estás en el lugar. Solo se guarda que llegaste y a qué hora, no dónde estabas.',
      'Si tu GPS falla, quien organiza el plan o alguien que ya llegó puede confirmarte.',
    ],
  },
  {
    id: 'conservacion',
    title: 'Cuánto tiempo guardamos tus datos',
    items: [
      'Tu ubicación en vivo caduca en minutos; la última ubicación aproximada, en 7 días.',
      'Los planes que ya terminaron y su chat quedan en tu historial 30 días.',
      'El historial de ubicaciones aproximadas se guarda en lotes para tu historial de lugares; puedes controlarlo desde Privacidad.',
      'Puedes eliminar tu cuenta cuando quieras desde Editar perfil: se borran tus datos personales, salvo lo que la ley nos obligue a conservar.',
    ],
  },
  {
    id: 'terceros',
    title: 'Con quién los compartimos',
    items: [
      'Usamos servicios de nube (Amazon Web Services) para almacenar y procesar datos y fotos. No los compartimos con terceros para fines propios de ellos.',
      'Lo que publicas lo ven las personas que elijas según su relación contigo (amigos, invitados, integrantes del plan).',
    ],
  },
  {
    id: 'derechos',
    title: 'Tus derechos (ARCO) y cómo ejercerlos',
    items: [
      'Puedes Acceder a tus datos, Rectificarlos, Cancelarlos u Oponerte a su uso.',
      'Desde la app: edita tu perfil y tu contraseña en Cuenta, borra tu historial, bloquea o reporta personas y apaga el modo abierto.',
      'Para ejercer un derecho que no puedas hacer desde la app, solicítalo al equipo del proyecto; responderemos en un máximo de 20 días hábiles.',
      'Puedes revocar el permiso de ubicación en cualquier momento desde tu navegador o sistema.',
    ],
  },
  {
    id: 'edad',
    title: 'Edad y uso responsable',
    items: [
      'Los eventos con gente nueva (modo abierto) son solo para personas adultas.',
      'No publiques contenido ofensivo ni te hagas pasar por otra persona. Puedes reportar y bloquear; podemos suspender cuentas que incumplan.',
      'Los planes son entre personas: reúnete en lugares públicos y avisa a alguien de confianza.',
    ],
  },
  {
    id: 'cambios',
    title: 'Cambios a este aviso',
    items: [`Si cambia, te lo diremos dentro de la app. Última actualización: ${LEGAL_UPDATED}.`],
  },
]
