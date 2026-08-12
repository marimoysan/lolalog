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
  arrays/objetos (`painLocations`, `sports`, `food.tags`) se guardan como TEXT
  con JSON. Incluye `updated_at` desde ya, aunque nada lo usa todavía, porque
  el futuro sync (ver debajo) lo necesita para el upsert.
- **Sync (fase 2, sin implementar)**: relay cifrado end-to-end a través de un
  backend mínimo en Vercel; el servidor nunca ve datos en claro. Sync = upsert
  por `date` con `updated_at` (last-write-wins). Ver [lib/sync/README.md](lib/sync/README.md).
  No construir esto todavía — se aborda como fase separada, ahora que el
  logging local ya persiste de verdad (SQLite conectado).
- **Análisis y gráficas**: deliberadamente fuera de la app. Los datos en
  bruto se consultan directamente desde SQLite (`pandas.read_sql`) en Python.
  No añadir librerías de charting (Recharts, D3, etc.) a la app salvo que se
  pida explícitamente. El tab Dashboard es un placeholder a propósito.

## Estado actual: UI conectada a SQLite, sync todavía no

Los datos se guardan de verdad: `EntriesProvider`/`useEntries`
([lib/db/entries-store.tsx](lib/db/entries-store.tsx)) leen y escriben en la
tabla `daily_log` vía sql.js, y persisten en IndexedDB (sobreviven a recargar
y cerrar el navegador). No hay seed de datos de ejemplo — la tabla empieza
vacía por dispositivo. El siguiente paso grande, cuando se quiera, es el sync
entre dispositivos (ver "Sync" arriba), todavía sin implementar.

### Pantallas construidas

- **PIN gate** ([components/PinGate.tsx](components/PinGate.tsx)): candado de
  UI, no de seguridad real (PIN por defecto `1234`, configurable vía
  `NEXT_PUBLIC_LOLALOG_PIN`, ver `.env.local.example`). No protege el SQLite.
- **Nav inferior** ([components/BottomNav.tsx](components/BottomNav.tsx)):
  Dashboard / Log (default, `/`) / Historial, con iconos de `lucide-react`.
- **Log** ([components/LogForm.tsx](components/LogForm.tsx)): una sola
  pantalla reutilizada tanto para hoy (`/`) como para cualquier día pasado
  (`/history/[date]`) — solo cambia qué `date` recibe. Dos estados: si el día
  ya tiene entrada guardada muestra una celebración + botón "Editar"; si no,
  el formulario completo. El estado logged/not-logged se deriva de si existe
  fila para esa fecha, no de un flag aparte.
- **Historial** ([components/HistoryList.tsx](components/HistoryList.tsx)):
  últimos 30 días, incluyendo huecos "Sin registrar". Tap en cualquier día
  abre el Log con esa fecha fija (edición o entrada retroactiva).
- **Dashboard**: placeholder "Próximamente".

### Esquema actual de `DailyEntry` ([lib/types.ts](lib/types.ts))

Todo opcional salvo `painLevel` (único campo requerido para poder guardar):

- `painLevel: 0-5` (0 = sin dolor, vía botón aparte)
- `painLocations: string[]` — multiselect entre 4 zonas (`PAIN_LOCATIONS`),
  solo visible en el form si `painLevel > 0`
- `activityLevel`, `lieDownNeed`: escalas genéricas 1-5
- `sports: SportEntry[]` — lista libre (añadir/quitar), cada uno con tipo
  (`SPORT_TYPES`) + intensidad 1-5
- `period`, `sex`: booleanos (Sí/No)
- `food: { quantity, quality, tags[] }` — cantidad y calidad de 3 opciones,
  tags multiselect (`FOOD_TAGS`)

### Sistema de inputs (reutilizar, no crear inputs ad-hoc nuevos)

- [PainScale.tsx](components/PainScale.tsx): 5 caras de `lucide-react`
  (Smile/Meh/Annoyed/Frown/Angry) — el shape de esos iconos es casi idéntico
  entre sí a tamaño pequeño, así que **el color es lo que realmente
  distingue cada nivel** (verde-amarillo-ámbar-naranja-rojo), no el glifo.
  Los datos (icono + color por nivel) viven en [lib/pain-scale.ts](lib/pain-scale.ts),
  compartido también por el botón "Sin dolor" y por `HistoryList` — si se
  cambia un color/icono, cambiarlo ahí, no en cada componente.
- [ScaleInput.tsx](components/ScaleInput.tsx): escala genérica 1-5 en
  píldoras numeradas, para todo lo que NO sea dolor (actividad, necesidad de
  tumbarme, intensidad de deporte). Deliberadamente distinta visualmente de
  `PainScale`.
- [ChoiceGroup.tsx](components/ChoiceGroup.tsx): single-select genérico de N
  opciones string (Sí/No, cantidad, calidad de comida).
- [TagCloud.tsx](components/TagCloud.tsx): multiselect genérico de chips
  (tags de comida, ubicación del dolor).
- [SportPicker.tsx](components/SportPicker.tsx): lista de deportes
  añadir/quitar, cada fila con dropdown + `ScaleInput`.
- [DateHeader.tsx](components/DateHeader.tsx): fecha apilada (día grande /
  mes / año pequeños), usada arriba del Log.

## Convenciones

- Copy/UI en español.
- Evitar overengineering: sin abstracciones prematuras, sin flags de
  compatibilidad, sin features especulativas. Es una app personal de una
  sola usuaria.
- Mobile-first pero debe verse bien en desktop: todo el contenido va dentro
  de un contenedor `max-w-md mx-auto` (ver `PinGate.tsx`), no añadir layouts
  de desktop separados.
- Antes de dar por hecho que algo visual es un bug (colores raros, texto sin
  actualizar), verificar con Playwright + `getComputedStyle`, no solo con la
  captura: Chrome Headless Shell renderiza algunos colores con artefactos
  (texto negro sale anaranjado, blends se ven lavados) que no existen en el
  navegador real.
