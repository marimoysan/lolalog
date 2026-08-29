@AGENTS.md

# lolalog

Diario personal para trackear síntomas de dolor y buscar patrones (deporte,
comida, ciclo menstrual, relaciones sexuales, etc.) rellenado una vez al día.
Datos médicos/personales sensibles — no añadir analytics, telemetría ni
llamadas a servicios de terceros que reciban estos datos en claro.

## Arquitectura (decidida, no reabrir sin motivo)

- **App**: Next.js (App Router, TS, Tailwind), PWA instalable en el móvil,
  desplegada en Vercel.
- **Almacenamiento**: local-first. SQLite corriendo en el navegador vía
  `sql.js` (WASM), persistido en IndexedDB. Ver [lib/db/client.ts](lib/db/client.ts)
  (abrir/persistir la base) y [lib/db/daily-log.ts](lib/db/daily-log.ts)
  (schema y queries de `daily_log`), conectados a la UI vía
  [lib/db/entries-store.tsx](lib/db/entries-store.tsx) (`EntriesProvider`/`useEntries`).
  Los binarios `sql-wasm.wasm`/`sql-wasm-browser.wasm` se copian a `public/`
  mediante `scripts/copy-sql-wasm.mjs` (hook `postinstall`) — no editar esos
  wasm a mano.
- **Esquema**: una única tabla ancha `daily_log`, una fila por día
  (`date` como PK). Se descartó explícitamente un modelo EAV
  (`entry_type`/`value`) y también dividir en varias tablas por dominio
  (dolor, comida, deporte...): el diario es de una entrada al día, no de
  eventos múltiples, así que ninguna de esas complejidades aplica.
  Las columnas reflejan el shape de [lib/types.ts](lib/types.ts) (`DailyEntry`);
  arrays/objetos (`painEpisodes`, `sports`, `food.tags`) se guardan como TEXT
  con JSON. Incluye `updated_at`, usado por el sync (ver debajo) para
  arbitrar el upsert. También incluye `deleted` (soft-delete: "vaciar todo"
  en el Log marca la fila en vez de hacer `DELETE`, para conservar
  `updated_at` y poder seguir arbitrando el borrado por last-write-wins) —
  dispositivos con datos ya guardados migran solos vía `ALTER TABLE` en
  `initDailyLogSchema`.
- **Sync (fase 2, implementado y en uso)**: relay cifrado end-to-end sobre
  Upstash Redis (Vercel Marketplace) — el servidor nunca descifra el
  contenido del diario, solo `date`/`updated_at` (y, para un borrado,
  `deleted: true`) en claro para arbitrar el upsert last-write-wins. Un
  borrado se propaga como tombstone: mismo mecanismo de last-write-wins,
  sin `iv`/`ciphertext` porque no hay contenido que cifrar — ver
  `deleteEntry` en [lib/db/daily-log.ts](lib/db/daily-log.ts) y
  `syncPushDelete`/`syncOnLoad` en [lib/sync/sync.ts](lib/sync/sync.ts).
  Automático (push en cada `saveEntry`/`deleteEntry`, pull+merge al abrir la
  app), sin botón manual ni polling. Configuración de passphrase + token una
  vez por dispositivo en `/sync`. Detalle completo en
  [lib/sync/README.md](lib/sync/README.md), incluidos los nombres reales de
  las env vars de Redis (namespaced bajo `lolalog_` en este proyecto, no los
  genéricos `UPSTASH_REDIS_REST_*`). Confirmado funcionando entre dos
  dispositivos reales (móvil + desktop).
- **Análisis y gráficas**: decidido — Dashboard con gráficas reales *dentro*
  de la app, client-side (consultando el sql.js ya cargado en cada
  dispositivo), nunca server-side: el servidor de sync nunca ve datos en
  claro, así que cualquier cómputo de stats en servidor rompería esa
  garantía. Primer MVP ya construido (solo dolor, ver "Pantallas
  construidas" → Dashboard) como SVG propio, sin librería de charting — si
  en el futuro se añade una librería, que sea porque se pide explícitamente,
  no por defecto.

## Estado actual: SQLite + sync funcionando en producción

Los datos se guardan de verdad: `EntriesProvider`/`useEntries`
([lib/db/entries-store.tsx](lib/db/entries-store.tsx)) leen y escriben en la
tabla `daily_log` vía sql.js, y persisten en IndexedDB (sobreviven a recargar
y cerrar el navegador). No hay seed de datos de ejemplo — cada dispositivo
empieza con la tabla vacía y se llena vía uso normal + sync. El sync entre
dispositivos (ver "Sync" arriba) está desplegado y configurado — probado de
verdad entre móvil y desktop. El Dashboard tiene ya un primer MVP de
gráficas reales (solo dolor por ahora, ver "Análisis y gráficas" y
"Pantallas construidas" → Dashboard); el siguiente paso es sumar más
métricas al mismo Dashboard (actividad, deporte, ciclo, comida...).

### Pantallas construidas

- **PIN gate** ([components/PinGate.tsx](components/PinGate.tsx)): candado de
  UI, no de seguridad real (PIN por defecto `1234`, configurable vía
  `NEXT_PUBLIC_LOLALOG_PIN`, ver `.env.local.example`). No protege el SQLite.
  Es un dialpad numérico (no un input de texto): 4 puntos de progreso en
  coral que se rellenan al marcar, auto-envío al completar los 4 dígitos,
  y parpadeo en rojo + limpieza automática si el PIN es incorrecto. También
  escucha teclado físico (dígitos/Backspace) para uso en desktop.
- **Nav inferior** ([components/BottomNav.tsx](components/BottomNav.tsx)):
  Dashboard / Log (default, `/`) / Historial, con iconos de `lucide-react`.
- **Swipe entre pestañas** ([components/SwipeNav.tsx](components/SwipeNav.tsx)):
  Dashboard/Log/Historial también se cambian arrastrando horizontalmente,
  no solo con el nav inferior. Implementado como carrusel: los tres viven
  siempre montados a la vez en una tira `flex` (no dependen de que Next.js
  monte/desmonte la ruta activa) — así la pantalla vecina ya está ahí,
  visible, desde el primer píxel de arrastre, en vez de aparecer de golpe
  cuando termina la navegación. Cada uno hace scroll vertical de forma
  independiente (`overflow-y-auto` propio) en vez de la página entera —
  por eso `body` es `h-dvh overflow-hidden` en `layout.tsx` (no
  `min-h-dvh`): no hay scroll de documento, cada pantalla es su propio
  contenedor con scroll. Efecto secundario intencional: cambiar de pestaña
  conserva la posición de scroll y el estado local (p. ej. un form a medio
  rellenar) de las otras dos. Rutas fuera de esas tres (`/history/[date]`,
  `/sync`) no son swipeables, se renderizan normal sin la tira. El nav
  inferior y el swipe comparten la misma animación, así que tocar un icono
  también desliza en vez de saltar de golpe.
- **Log** ([components/LogForm.tsx](components/LogForm.tsx)): una sola
  pantalla reutilizada tanto para hoy (`/`) como para cualquier día pasado
  (`/history/[date]`) — solo cambia qué `date` recibe, vía la prop
  `isToday`. El estado logged/not-logged se deriva de si existe fila
  (no borrada) para esa fecha, no de un flag aparte. Comportamiento distinto
  por `isToday`:
  - **Hoy**: siempre abierto en modo edición, sin pantalla intermedia de
    "ya registraste hoy" — se vuelve a lo largo del día para ampliar o
    corregir (p. ej. añadir otro episodio de dolor más tarde). Autoguarda
    con debounce (~800ms tras el último cambio) en vez de tener botón
    "Guardar"; un texto bajo el form indica el estado ("Se guarda
    automáticamente" / "Guardando…" / "Guardado").
  - **Día pasado**: abre directo en modo edición (precargado si ya había
    datos); tiene una barra superior con enlace "← Historial", un botón
    "Guardar" manual (a diferencia de hoy: es una edición puntual, no un
    registro que se reabre) y, si el día ya tenía entrada, un botón
    "Vaciar todo" que resetea el form a blanco. Guardar con *todos* los
    campos en blanco sobre un día que ya existía borra la entrada (vuelve a
    "Sin registrar") en vez de guardar — `painLevel` solo, por sí solo, ya
    no dispara esto (ver esquema de `DailyEntry` debajo); guardar (con o
    sin borrar) siempre navega de vuelta a `/history`, no a `/`.
- **Historial** ([components/HistoryList.tsx](components/HistoryList.tsx)):
  últimos 30 días, incluyendo huecos "Sin registrar". Tap en el día de hoy
  enlaza directo a `/` (no a `/history/[date]`); tap en cualquier otro día
  abre el Log en esa fecha, directo en modo edición (ver arriba).
- **Dashboard** ([components/DashboardView.tsx](components/DashboardView.tsx)
  — montado directamente por `SwipeNav` para el carrusel;
  `app/dashboard/page.tsx` es solo un wrapper fino para cuando se navega o
  recarga directo a esa ruta): primer MVP — gráfica de dolor por día
  ([components/PainChart.tsx](components/PainChart.tsx), SVG propio sin
  librería), tabs Última semana / Último mes / Custom (`ChoiceGroup`
  reutilizado; Último mes por defecto; Custom revela un mini-form con dos
  `<input type="date">` + "Aplicar"). Eje Y fijo 0–5 sin números; días sin
  registrar quedan como hueco en la línea, no como 0 (huecos cortan la
  línea — no se interpola por encima; probado lo contrario y revertido a
  petición explícita). Arrastrar sobre la gráfica (mouse o touch, vía
  Pointer Events) muestra un crosshair + tooltip con la fecha y el nivel (o
  "Sin registrar").
  - **Eje X**: sombreado de fondo en columnas de sábado/domingo, gridline
    vertical en cada tick etiquetado, más ticks que una gráfica genérica
    (todos los días si hay ≤10 puntos, ~8 repartidos si hay más). Etiquetas
    adaptativas: ≤10 puntos muestra letra del día de la semana (convención
    española L M X J V S D, X para no chocar con martes) sobre el número de
    día; con más puntos muestra el número de día solo, y el nombre completo
    del mes (no abreviado) aparece una vez en el primer tick y en cada
    cambio de mes.
  - **Línea**: color por gradiente en vez de puntos fijos — cada segmento
    entre dos días consecutivos es un `<linearGradient>` de SVG que va del
    color del nivel de dolor de un día al del siguiente (mismas clases de
    `lib/pain-scale.ts`, vía `stop-color: currentColor` — no hay hex
    duplicado). La curva es Catmull-Rom → Bézier
    ([lib/chart-path.ts](lib/chart-path.ts), `smoothLinePath`/
    `smoothSegments`) en vez de segmentos rectos, pensada para reusarse tal
    cual cuando se superpongan más series (mood, cansancio...). No hay
    punto fijo por día — solo un punto al hacer hover/arrastrar, y un punto
    suelto para un día registrado que quedó aislado entre dos huecos (sin
    vecino con el que formar un segmento que lleve el gradiente).

### Esquema actual de `DailyEntry` ([lib/types.ts](lib/types.ts))

Todo opcional, incluido `painLevel` — un día se guarda si tiene *algún* campo
relleno (no hace falta que sea el dolor: p. ej. registrar deporte en
retrospectiva sin acordarte del dolor de ese día es válido):

- `painLevel: 0-5 | null` (0 = sin dolor vía botón aparte; `null` = no
  respondido, distinto de 0 — en Historial se muestra como "Sin dato" en vez
  del icono de dolor)
- `painEpisodes: PainEpisode[]` — episodios puntuales de dolor durante el
  día (lista libre, añadir/quitar, timestamp automático al crear), cada uno
  con trigger (`PAIN_EPISODE_TRIGGERS`, single-select), síntomas
  (`PAIN_EPISODE_SYMPTOMS`, multiselect), ubicación (`PAIN_LOCATIONS`,
  multiselect — vive aquí, por episodio, no a nivel de día) y nota libre.
  En [PainEpisodePicker.tsx](components/PainEpisodePicker.tsx) cada episodio
  se puede colapsar a una fila-resumen (trigger · ubicación · síntomas, +
  icono si tiene nota) para que un día con varios no sea una pared de forms
  abiertos.
- `activityLevel`, `tiredness`, `mood`: escalas genéricas 1-5. `mood` se
  muestra con caras (`MoodScale.tsx`/`lib/mood-scale.ts`, mismo patrón que
  `PainScale`/`pain-scale.ts` pero con la escala invertida: 1 = Muy mal
  (rojo) → 5 = Muy bien (verde), frente a dolor donde 1 = leve).
- `sports: SportEntry[]` — lista libre (añadir/quitar), cada uno con tipo
  (`SPORT_TYPES`) + intensidad 1-5
- `period`, `sex`, `alcohol`: booleanos (Sí/No) — `alcohol` vivió dentro de
  `food.tags` originalmente; se sacó a campo independiente para poder
  trackearlo aparte de qué se comió.
- `medication: Medication | null` + `medicationEffect: string` —
  single-select entre `MEDICATIONS` (Ibuprofeno/Paracetamol/Metamizol/
  Buscapina) reutilizando `TagCloud` (pensado para multiselect) con
  selección de uno solo y deselección al volver a tocar el chip activo
  (`toggleMedication` en `LogForm.tsx`); al seleccionar aparece un textarea
  libre "Efecto", que se limpia si se deselecciona la medicación.
- `food: { quantity, quality, tags[] }` — cantidad y calidad de 3 opciones,
  tags multiselect (`FOOD_TAGS`; `FOOD_TAG_HINTS` mapea algún tag, de
  momento solo "Gluten", a un texto explicativo — `TagCloud` lo muestra como
  hint plegado tras un icono de info junto al chip, tap para abrir/cerrar en
  vez de un `title` con hover, porque esta es una app táctil)
- `notes: string` — notas libres al final del registro, para lo que no
  encaje en ningún otro campo

Las columnas SQLite `pain_locations` (ubicación a nivel de día, versión
previa a moverla dentro de `painEpisodes`) y `lie_down_need` ("necesidad de
tumbarme", descartado por no ser relevante) siguen en el schema pero ya no
se leen ni se escriben — ver comentarios en `initDailyLogSchema`.

Los arrays/objetos anidados dentro de `DailyEntry` (como `PainEpisode`) no
tienen migración de columna SQL propia — viven serializados como JSON dentro
de una sola columna TEXT. Si se le añade un campo nuevo a `PainEpisode` (o a
cualquier otro tipo anidado), las entradas ya guardadas antes de ese cambio
vuelven de SQLite/sync sin ese campo (`undefined`, no vacío) y pueden romper
al iterarlas. `normalizeEntry` en [lib/types.ts](lib/types.ts) rellena esos
huecos con valores por defecto; se aplica en los dos puntos donde una
`DailyEntry` entra a la app (`rowToEntry` en `daily-log.ts` y tras
`decryptEntry` en `syncOnLoad`) — seguir el mismo patrón (añadir el default
ahí, no en cada sitio donde se lee el campo) la próxima vez que se amplíe
`PainEpisode` o similar.

### Sistema de inputs (reutilizar, no crear inputs ad-hoc nuevos)

- [PainScale.tsx](components/PainScale.tsx): 5 caras de `lucide-react`
  (Smile/Meh/Annoyed/Frown/Angry) — el shape de esos iconos es casi idéntico
  entre sí a tamaño pequeño, así que **el color es lo que realmente
  distingue cada nivel** (verde-amarillo-ámbar-naranja-rojo), no el glifo.
  Los datos (icono + color por nivel) viven en [lib/pain-scale.ts](lib/pain-scale.ts),
  compartido también por el botón "Sin dolor" y por `HistoryList` — si se
  cambia un color/icono, cambiarlo ahí, no en cada componente.
- [ScaleInput.tsx](components/ScaleInput.tsx): escala genérica 1-5 en
  píldoras numeradas, para todo lo que NO sea dolor ni ánimo (actividad,
  cansancio, intensidad de deporte). Deliberadamente distinta visualmente de
  `PainScale`. Prop opcional `allowNull` añade una píldora "NA" que llama a
  `onChange(null)`, para permitir borrar/marcar como no aplicable un campo ya
  respondido — de momento sin ningún campo activándola (queda disponible
  para el próximo campo 1-5 que la necesite).
- [MoodScale.tsx](components/MoodScale.tsx): caras 1-5 para "Ánimo", mismo
  patrón que `PainScale.tsx` (ver arriba, colores por `lib/mood-scale.ts`)
  pero con la escala invertida.
- [ChoiceGroup.tsx](components/ChoiceGroup.tsx): single-select genérico de N
  opciones string (Sí/No, cantidad, calidad de comida).
- [TagCloud.tsx](components/TagCloud.tsx): multiselect genérico de chips
  (tags de comida, ubicación del dolor). Prop opcional `hints` (tag → texto)
  añade un icono de info tras el chip que al tocarlo despliega ese texto
  debajo de la nube — usado para explicar qué cuenta como "Gluten".
- [SportPicker.tsx](components/SportPicker.tsx): lista de deportes
  añadir/quitar, cada fila con dropdown + `ScaleInput`.
- [DateHeader.tsx](components/DateHeader.tsx): fecha apilada (día de la
  semana / día grande / mes / año pequeños), usada arriba del Log.

### Identidad visual

Assets de marca en `public/`: `lolalog-icono-1024.svg` (icono cuadrado
redondeado, grid de 9 puntos, uno coral — colores fijos, seguro de usar via
`<img>` en cualquier fondo), `lolalog-lockup-horizontal.svg` (wordmark
completo con colores fijos — **no usarlo vía `<img>` sobre fondos oscuros**,
el texto "Lola" es casi negro y se pierde; para UI, reproducir el wordmark
como texto HTML con `text-foreground`, que sí sigue el tema — ver el
patrón en `PinGate.tsx`) y `lolalog_identidad_completa_puntos.svg` (hoja de
referencia de la identidad — paleta, variantes de color/monocromo/contorno —
no es un asset para usar en la UI).

Tokens de color de marca definidos en
[app/globals.css](app/globals.css) y expuestos como utilidades Tailwind:
`brand-green` (`#0F6E56` — acciones primarias, estados seleccionados,
nav activa), `brand-green-light` (`#1D9E75` — acento del "Log" en el
wordmark), `brand-coral` (`#F0997B` — acento puntual, de momento solo en
los puntos del PIN al marcar un dígito). Usar estos tokens para cualquier
elemento con identidad de marca en vez de colores Tailwind genéricos
(`green-600`, etc.) — la única excepción es la escala de dolor
(`lib/pain-scale.ts`), cuyos colores son semánticos (severidad), no de
marca, salvo "Sin dolor" que sí usa `brand-green`.

### Datos de prueba en local

Para ver el Dashboard con datos sin tocar el diario real: `npm run
seed:dummy` ([scripts/seed-dummy-month.mjs](scripts/seed-dummy-month.mjs))
rellena un mes (dolor con onda orgánica + huecos, ánimo, actividad,
cansancio, un bloque de regla, días sueltos de sexo/alcohol) tecleando en la
UI real vía Playwright, en un perfil de Chromium aislado (`.dev-profile/`,
gitignored) — no hay ningún atajo que escriba directo en IndexedDB. Sync
nunca se configura en ese perfil, así que el push de `saveEntry` es un
no-op garantizado (`isSyncConfigured()` en `lib/sync/key-store.ts`): no
puede llegar a Redis ni a otros dispositivos. `npm run preview:dummy`
([scripts/open-dummy-preview.mjs](scripts/open-dummy-preview.mjs)) reabre
ese mismo perfil en el Dashboard sin re-sembrar. Ambos requieren `npm run
dev` corriendo y fuerzan `colorScheme: "dark"` (Playwright no hereda el
tema del SO); solo puede haber una ventana de ese perfil abierta a la vez
(IndexedDB bloquea a nivel de proceso) — cerrar la anterior antes de
relanzar cualquiera de los dos.

## Convenciones

- Copy/UI en español.
- Evitar overengineering: sin abstracciones prematuras, sin flags de
  compatibilidad, sin features especulativas. Es una app personal de una
  sola usuaria.
- Mobile-first pero debe verse bien en desktop: todo el contenido va dentro
  de un contenedor `max-w-md mx-auto` (ver `PinGate.tsx`), no añadir layouts
  de desktop separados.
- Elementos pegados al borde de la pantalla (nav inferior, dialpad del PIN)
  usan `dvh` en vez de `vh`/`%` para la altura y `env(safe-area-inset-*)`
  para el padding — ver `layout.tsx` (`h-dvh`, `viewportFit: "cover"`),
  `BottomNav.tsx` y `PinGate.tsx`. Necesario para que nada quede bajo el
  notch/home-indicator en la PWA instalada; seguir el mismo patrón en
  cualquier pantalla nueva que toque un borde.
- Antes de dar por hecho que algo visual es un bug (colores raros, texto sin
  actualizar), verificar con Playwright + `getComputedStyle`, no solo con la
  captura: Chrome Headless Shell renderiza algunos colores con artefactos
  (texto negro sale anaranjado, blends se ven lavados) que no existen en el
  navegador real.
- Nunca formatear una fecha local con `Date.toISOString().slice(0, 10)`:
  `toISOString()` convierte a UTC primero, así que en cualquier huso horario
  por delante de UTC (España en verano, por ejemplo) desplaza la fecha un
  día hacia atrás en ciertas horas. `datesInRange` en [lib/date.ts](lib/date.ts)
  construye el string desde los campos locales del `Date`
  (`getFullYear`/`getMonth`/`getDate`) en vez de pasar por UTC — seguir ese
  patrón en cualquier función de fechas nueva. `todayISO()` y `lastNDays()`
  en el mismo archivo todavía usan el patrón viejo (bug latente, no
  corregido aún — solo se manifiesta de madrugada según el huso horario).
