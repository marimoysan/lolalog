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
  garantía. Ya construido (dolor, cansancio y ánimo, ver "Pantallas
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
verdad entre móvil y desktop. El Dashboard tiene ya tres gráficas reales
(Dolor, Cansancio, Ánimo) con agregación diaria/semanal/mensual, capas de
eventos (sexo, actividad intensa, alcohol) y ciclo menstrual (regla,
ventana fértil, ovulación) sobre Dolor, y una superposición opcional de
Cansancio/Ánimo sobre esa misma gráfica — ver "Análisis y gráficas" y
"Pantallas construidas" → Dashboard; el siguiente paso es sumar comida al
mismo Dashboard.

### Pantallas construidas

- **PIN gate** ([components/PinGate.tsx](components/PinGate.tsx)): candado de
  UI, no de seguridad real (PIN por defecto `1234`, configurable vía
  `NEXT_PUBLIC_LOLALOG_PIN`, ver `.env.local.example`). No protege el SQLite.
  Es un dialpad numérico (no un input de texto): 4 puntos de progreso en
  coral que se rellenan al marcar, auto-envío al completar los 4 dígitos,
  y parpadeo en rojo + limpieza automática si el PIN es incorrecto. También
  escucha teclado físico (dígitos/Backspace) para uso en desktop.
- **Barra superior** ([components/TopBar.tsx](components/TopBar.tsx)): franja
  fija arriba con el wordmark "LolaLog" (icono cuadrado + texto reproducido
  como HTML con `text-foreground`/`text-brand-green-light`, no el SVG del
  lockup — mismo patrón que describe "Identidad visual" debajo). Montada en
  `PinGate.tsx` junto a `BottomNav`, así que es global a toda la app ya
  desbloqueada (las tres pestañas del carrusel, Historial, `/sync`), no solo
  al Dashboard/Log.
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
  recarga directo a esa ruta): tres gráficas apiladas — Dolor, Cansancio,
  Ánimo (ver bullets propios debajo) — que comparten un único componente
  genérico ([components/MetricChart.tsx](components/MetricChart.tsx), SVG
  propio sin librería; se llamó `PainChart` hasta que dejó de ser solo de
  dolor) parametrizado por `points`/`range`/`valueInfo`/`label`, más un
  único selector de rango (tabs Última semana / Último mes / Custom,
  `ChoiceGroup` reutilizado; Último mes por defecto; Custom revela un
  mini-form con dos `<input type="date">` + "Aplicar") y una única
  granularidad (ver "Agregación" debajo) que aplican a las tres a la vez.
  Eje Y fijo a `range` sin números; días sin registrar quedan como hueco en
  la línea, no como el mínimo del rango (huecos cortan la línea — no se
  interpola por encima; probado lo contrario y revertido a petición
  explícita). Arrastrar sobre cualquiera de las tres gráficas (mouse o
  touch, vía Pointer Events) muestra un crosshair + tooltip con la fecha y
  el valor (o "Sin registrar") — y ese mismo índice se refleja en las otras
  dos, como si una única línea vertical atravesase las tres a la vez (cada
  una con su propio tooltip para esa fecha). El índice activo vive en
  `DashboardView` (`activeIndex`/`setActiveIndex`), no en cada gráfica —
  `MetricChart` acepta `activeIndex`/`onActiveIndexChange` opcionales para
  este caso (controlado) y cae a un `useState` propio si no se pasan
  (usado en cualquier otro sitio donde se monte una sola gráfica suelta).
  Funciona porque las tres comparten exactamente el mismo `dates`/buckets,
  así que un mismo índice numérico apunta al mismo día en las tres; se
  resetea a `null` en cuanto cambia el rango o la granularidad, para no
  apuntar a un día que ya no está en el eje.
  - **Eje X**: sombreado de fondo en columnas de sábado/domingo (solo en
    vista diaria), gridline vertical en cada tick etiquetado, más ticks que
    una gráfica genérica (todos los días/semanas/meses si hay ≤10 puntos,
    ~8 repartidos si hay más). Etiquetas adaptativas por granularidad
    ([lib/chart-axis.ts](lib/chart-axis.ts), `buildAxisLabels` — factorizado
    fuera de la gráfica en sí precisamente para esto, reusarse entre Dolor/
    Cansancio/Ánimo con el mismo eje): diario ≤10 puntos muestra letra del día de la semana
    (convención española L M X J V S D, X para no chocar con martes) sobre
    el número de día, >10 puntos muestra el número solo + nombre del mes en
    el primer tick y en cada cambio de mes; semanal etiqueta el día de cada
    lunes (sin letra de día, sería engañosa); mensual etiqueta el nombre
    corto del mes + año en cada cambio de año. `tooltipDateLabel` (mismo
    archivo) da el texto del tooltip por granularidad: fecha completa /
    "Semana del X al Y" / "Mes Año".
  - **Línea**: color por gradiente en vez de puntos fijos — cada segmento
    entre dos puntos consecutivos es un `<linearGradient>` de SVG que va del
    color de un punto al del siguiente, vía `stop-color: currentColor` —
    no hay hex duplicado. El color/icono/label por valor lo da la prop
    `valueInfo` (`painLevelInfo`/`moodLevelInfo`/`tirednessLevelInfo` según
    la gráfica — ver "Cansancio y Ánimo" debajo), así que Cansancio y Ánimo
    tienen exactamente esta misma línea con gradiente, solo cambia la
    paleta. La curva es Catmull-Rom → Bézier
    ([lib/chart-path.ts](lib/chart-path.ts), `smoothLinePath`/
    `smoothSegments`) en vez de segmentos rectos. No hay
    punto fijo por día — solo un punto al hacer hover/arrastrar, y un punto
    suelto para un día registrado que quedó aislado entre dos huecos (sin
    vecino con el que formar un segmento que lleve el gradiente).
  - **Agregación** ([components/DashboardGranularityPicker.tsx](components/DashboardGranularityPicker.tsx),
    [lib/aggregate.ts](lib/aggregate.ts)): icono de calendario, debajo de
    los presets de rango, que despliega un panel inline Diario/Semanal/Mensual
    (por defecto Diario; elegir una opción cierra el panel — a diferencia de
    los botones de Eventos, ver debajo, que son toggles independientes sin
    panel). Una sola granularidad para las tres gráficas (Dolor, Cansancio,
    Ánimo). En semana/mes,
    `groupByWeek`/`groupByMonth` agrupan las fechas visibles en buckets
    (semana = lunes de esa semana ISO, mes = día 1 de ese mes,
    independientemente de si esa fecha cae dentro del rango visible) y el
    valor de cada bucket es la media de los días registrados de esa gráfica
    redondeada al entero más cercano (`averageLevel`, genérica sobre
    cualquiera de las tres escalas; `null` solo si ningún día del bucket
    tiene dato).
  - **Eventos** (sexo/actividad intensa/alcohol —
    [lib/event-icons.ts](lib/event-icons.ts) centraliza icono+color+label
    por tipo, mismo patrón que `lib/pain-scale.ts`): tres botones
    independientes solo-icono a la altura del título "Dolor", no del título
    "Dashboard" (en `DashboardView.tsx`, sin componente propio ni panel
    desplegable — se probó un botón "Filtros" que desplegaba un panel con
    chips y se simplificó a esto) — deliberado: solo filtran la gráfica de
    dolor, así que viven pegados a su título en vez de al nivel del
    Dashboard entero, para que quede claro que no son globales. Todos
    apagados por defecto — "añadir cosas a la
    gráfica", no mostradas de serie; cada botón alterna su
    evento (verde cuando está activo) y lleva `aria-label`/`aria-pressed`
    con el label de `lib/event-icons.ts` ya que no hay texto visible. En la
    misma fila, tras un separador vertical fino, van dos botones más con el
    mismo estilo para superponer Cansancio/Ánimo sobre Dolor — ver
    "Superposición sobre Dolor" debajo; comparten el componente
    `ToggleIconButton` interno de `DashboardView.tsx` pero controlan estado
    distinto (`visibleSeries` vs `visibleOverlays`) porque son conceptos
    distintos: eventos son booleanos con su propio render (carriles/barras),
    superposición es una serie continua reutilizando el mismo render de
    línea que la gráfica principal.
    "Actividad" reutiliza exactamente la misma señal que
    el badge de rayo del Historial (`hasIntenseActivity` en
    [lib/day-badges.ts](lib/day-badges.ts): deporte registrado O escala de
    actividad al máximo) para que ambas pantallas lean el mismo criterio.
    Representación distinta según granularidad — vista diaria: un carril
    fino por evento activo, debajo de las etiquetas del eje, con el icono
    marcado solo en los días donde ocurrió; vista semana/mes: en vez de
    carriles, cada evento activo se dibuja como una barra fina translúcida
    (opacity fija, no gated por nivel de dolor) dentro de la misma gráfica,
    varias barras en paralelo con un hueco pequeño entre ellas y uno mayor
    entre buckets (no en stack — se probó apilado/ancho completo y se
    redujo explícitamente porque tapaba la línea de dolor), altura
    limitada a una fracción del alto del plot para que nunca compita
    visualmente con la línea.
  - **Ciclo menstrual** ([lib/cycle.ts](lib/cycle.ts)): regla siempre visible
    como sombreado de fondo (no es uno de los botones de Eventos, no es
    opt-in) — solo en
    vista diaria, agregado a semana/mes se probó y se quitó porque un
    puñado de días de regla dentro de un bucket se leía como un bloque
    sólido engañoso. Ventana fértil y ovulación se calculan sobre un modelo
    de ciclo fijo de 26 días proyectado desde el inicio de regla más
    reciente (día 1 = primer día de un bloque de regla, no cada día del
    bloque — `periodStartDates`; el cálculo depende solo de en qué día
    *empieza* la regla, no de cuántos días dura), con `% 26` para seguir
    proyectando ventanas futuras aunque la siguiente regla todavía no esté
    registrada (`cycleDayOf`, null si no hay ninguna regla previa registrada
    con la que anclar). Ventana fértil = días de ciclo 7–13 (sombreado
    celeste, mismo mecanismo que la regla pero no togglable), ovulación =
    día 12 (icono de huevo, `lib/event-icons.ts`, anclado en el margen
    superior del gráfico para no quedar nunca tapado por la línea de dolor
    sea cual sea su altura ese día). Para poder anclar el ciclo a una regla
    anterior al rango visible en el Dashboard, `useEntries` expone
    `listEntries()` ([lib/db/entries-store.tsx](lib/db/entries-store.tsx))
    además del `getEntry(date)` puntual — necesario porque el ciclo puede
    empezar fuera de la ventana que se está graficando.
  - **Cansancio y Ánimo**: dos gráficas más, debajo de Dolor, siempre
    visibles (no dependen de ningún toggle) — mismo `MetricChart`, mismo
    eje X, misma granularidad, pero `range={[1, 5]}` (no `[0, 5]` como
    dolor) y sin ninguno de los extras de Dolor (sin sombreado de ciclo, sin
    botones de Eventos propios — decisión explícita: menos superficie nueva
    antes que triplicar esos controles; se puede añadir después si hace
    falta). Ánimo usa
    `moodLevelInfo` ([lib/mood-scale.ts](lib/mood-scale.ts)) para el
    gradiente — igual que Dolor, cada nivel tiene su propio color, aquí
    invertido (1 rojo → 5 verde). Cansancio usa
    `tirednessLevelInfo` ([lib/tiredness-scale.ts](lib/tiredness-scale.ts)),
    deliberadamente **plano** (mismo `textClass` en los 5 niveles, cambia
    solo el label del tooltip) en vez de un gradiente de severidad — a
    diferencia de dolor/ánimo, `ScaleInput` ya mantiene cansancio sin color
    propio en el Log (ver "Sistema de inputs" debajo), así que la gráfica
    sigue esa misma convención en lugar de inventar una paleta nueva solo
    para esto.
  - **Superposición sobre Dolor**: los dos botones extra de la fila de
    Eventos (ver arriba) activan `visibleOverlays`
    (`Set<"tiredness" | "mood">`, [lib/overlay-metrics.ts](lib/overlay-metrics.ts))
    y dibujan Cansancio/Ánimo como una línea gris plana (sin gradiente,
    `opacity` baja, `smoothLinePath` de un solo color en vez de
    `smoothSegments` con gradiente por punto) por encima de la gráfica de
    Dolor — prop `overlays` de `MetricChart`. Deliberadamente gris y no con
    la paleta propia de cada métrica: el eje ya no tiene números (es
    intencional, solo enseña forma/tendencia — ver arriba), así que una
    línea con degradado de color propio insinuaría una escala compartida
    con dolor que no existe (dolor es 0–5, cansancio/ánimo son 1–5); una
    línea plana solo enseña la forma, no un valor comparable. Las dos
    superposiciones posibles se distinguen entre sí por trazo, no por color
    (cansancio discontinuo, ánimo continuo — `dashed` en
    `lib/overlay-metrics.ts`), ya que ambas comparten el mismo gris. Solo
    aplica en vista diaria (igual que el sombreado de ciclo): en semana/mes
    los botones siguen ahí pero no tienen efecto, muy pocos puntos por
    bucket como para que una superposición se lea con fiabilidad. Sin
    tooltip propio para las líneas superpuestas todavía — son solo visuales,
    hover sigue mostrando el valor de Dolor.

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
  respondido — activada en Cansancio (labels "Algo cansada" → "KO" en
  [lib/tiredness-scale.ts](lib/tiredness-scale.ts), usadas también por el
  tooltip del Dashboard); Actividad sigue sin ella.
- [MoodScale.tsx](components/MoodScale.tsx): caras 1-5 para "Ánimo", mismo
  patrón que `PainScale.tsx` (ver arriba, colores por `lib/mood-scale.ts`)
  pero con la escala invertida — y, a diferencia de dolor, no del todo
  simétrica: 1-2 van rojo/naranja como el extremo alto de dolor, pero el
  centro (3) es amarillo, no ámbar, y 4-5 son verde claro → verde más
  vivo en vez de un único verde repetido, para que la mitad "buena" de la
  escala se distinga de un vistazo en vez de leerse como un solo tono.
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
- Elementos pegados al borde de la pantalla (barra superior, nav inferior,
  dialpad del PIN) usan `dvh` en vez de `vh`/`%` para la altura y
  `env(safe-area-inset-*)` para el padding — ver `layout.tsx` (`h-dvh`,
  `viewportFit: "cover"`), `TopBar.tsx`, `BottomNav.tsx` y `PinGate.tsx`.
  Necesario para que nada quede bajo el notch/home-indicator en la PWA
  instalada; seguir el mismo patrón en cualquier pantalla nueva que toque
  un borde.
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
