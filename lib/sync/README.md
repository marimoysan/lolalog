# Sync (fase 2) — implementado

La base SQLite de cada dispositivo ([lib/db/client.ts](../db/client.ts)) sigue
siendo la fuente de verdad. El servidor (Upstash Redis vía Vercel Marketplace)
solo reenvía filas cifradas end-to-end entre dispositivos — nunca ve el
contenido del diario en claro.

## Esquema de cifrado

- Clave AES-GCM-256 derivada de una passphrase con PBKDF2 (250.000
  iteraciones, salt fijo de la app — ver [crypto.ts](crypto.ts)).
- Se cifra todo el contenido del día (`painLevel`, `painEpisodes`,
  `activityLevel`, `lieDownNeed`, `sports`, `period`, `sex`, `food`, `notes`)
  como un blob JSON con IV aleatorio por operación.
- `date` y `updated_at` van **en claro** — el servidor los necesita para
  indexar por fecha y arbitrar last-write-wins sin descifrar nada. Trade-off
  consciente: el servidor aprende qué días tienes registrados, nunca qué
  pusiste.
- La `CryptoKey` derivada (no el passphrase) se persiste en IndexedDB vía
  `idb-keyval` — se deriva una vez por dispositivo, ver
  [key-store.ts](key-store.ts) y `components/SyncSetupForm.tsx`.

## Modelo de datos en Redis

Un único hash `lolalog:entries` (`HSET`/`HGETALL`/`HGET`), clave = `date`,
valor = `{updatedAt, iv, ciphertext}`. Sin `SCAN`, sin índice aparte — el
hash ya es el índice. Sin cursor de "cambios desde X": el pull siempre trae
todo, suficiente para el volumen de un diario personal.

Clave aparte `lolalog:canary`: un texto fijo cifrado por el primer
dispositivo que sincroniza (set-if-absent). Cada pull lo descifra primero; si
falla (passphrase equivocada), se aborta todo el sync sin tocar nada — evita
que un dispositivo mal configurado corrompa silenciosamente los datos
compartidos. Ver `syncOnLoad` en [sync.ts](sync.ts).

## API

`app/api/sync/entries/route.ts` (`GET` pull, `POST` push/upsert por `date`) y
`app/api/sync/canary/route.ts` (`PUT` set-if-absent). Autenticadas con un
bearer token estático (`SYNC_API_TOKEN`, comparado con `timingSafeEqual`) —
no cifra nada, solo evita que el endpoint quede abierto a cualquiera en
internet.

## Trigger

Automático: `syncPush` en cada `saveEntry`, `syncOnLoad` (pull + merge +
push de lo pendiente) al abrir la app — ver el hook-in en
[lib/db/entries-store.tsx](../db/entries-store.tsx). Sin botón manual, sin
polling en background.

## Configuración por dispositivo

Una vez por dispositivo en `/sync` (`components/SyncSetupForm.tsx`):
passphrase + `SYNC_API_TOKEN`. Solo se persiste la clave derivada, no la
passphrase — no se puede volver a mostrar después de esa pantalla.

## Setup manual en Vercel (no automatizado)

1. Añadir la integración Upstash Redis del Marketplace al proyecto.
2. Comprobar los nombres exactos de las env vars que inyecta en Project
   Settings → Environment Variables. En este proyecto, la integración está
   namespaced bajo el store "lolalog" e inyecta `lolalog_KV_REST_API_URL` /
   `lolalog_KV_REST_API_TOKEN` (no los nombres genéricos
   `UPSTASH_REDIS_REST_URL`/`TOKEN`) — [redis.ts](redis.ts) usa esos nombres
   exactos en vez de `Redis.fromEnv()`. Si se reconecta el store y el
   namespace cambia, hay que actualizar `redis.ts`.
3. Generar y añadir `SYNC_API_TOKEN` (`openssl rand -hex 32`).
4. Redeploy.
