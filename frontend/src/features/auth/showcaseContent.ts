/**
 * Contenido de la vista previa de la pantalla de entrada (desktop). Es decoración de marketing, no datos de la app.
 * Las fotos pueden ser URLs completas (https://…) o archivos de `public/auth/` (ver LEEME.txt). Si una no carga, se muestra un color con iniciales.
 */
export const SHOWCASE = {
  /** Foto grande del plan. */
  photo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpLJaWuKAeiE-97z03KvmSqSqOnxFQmKxKvwGEgNyGaCr5ZwsXF0SIdgs&s=10',
  category: 'Café',
  title: 'Por un café, ¿alguien?',
  when: 'Hoy 7:00 pm',
  place: 'Café Ámbar',
  distance: 'a 800 m',
  author: { name: 'Sofi', photo: 'https://t3.ftcdn.net/jpg/19/24/03/50/360_F_1924035011_JyvtJNByiTms0woooP9b1vZKrEU1cCWA.jpg' },
  joined: [{ name: 'Mau', photo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTrHGE0_zcyXiCwq7Rtu-XSVZQ2s24ld8MjbW-n_gBzMc1m5fY8CAQw4ev&s=10' }, { name: 'Dani', photo: 'https://images.pexels.com/photos/30799008/pexels-photo-30799008/free-photo-of-man-enjoying-mountainous-landscape-view.jpeg?cs=tinysrgb&dpr=1&w=500' }],
  /** Otros amigos que se ven en el mapa (la foto es opcional). */
  nearby: [{ name: 'Ro', photo: '' }],
} as const
