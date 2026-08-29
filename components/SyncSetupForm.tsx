"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { deriveKey } from "@/lib/sync/crypto";
import { isSyncConfigured, loadToken, storeKey, storeToken } from "@/lib/sync/key-store";
import { syncOnLoad } from "@/lib/sync/sync";
import type { SyncResult } from "@/lib/sync/types";

type FailureReason = Extract<SyncResult, { ok: false }>["reason"];

const REASON_COPY: Record<FailureReason, string> = {
  unconfigured: "Falta completar los dos campos.",
  "wrong-passphrase": "La passphrase no coincide con la de tus otros dispositivos.",
  "auth-error": "El token no es correcto.",
  "network-error": "No se pudo conectar con el servidor de sincronización.",
};

export function SyncSetupForm() {
  const [passphrase, setPassphrase] = useState("");
  const [token, setToken] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [alreadyConfigured, setAlreadyConfigured] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setAlreadyConfigured(await isSyncConfigured());
      const savedToken = await loadToken();
      if (savedToken) setToken(savedToken);
    })();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passphrase || !token) return;

    setStatus("saving");
    setMessage(null);

    const key = await deriveKey(passphrase);
    await storeKey(key);
    await storeToken(token);

    const db = await getDb();
    const result = await syncOnLoad(db);

    if (result.ok) {
      setStatus("ok");
      setMessage(
        result.appliedCount > 0
          ? `Sincronizado: ${result.appliedCount} día(s) traído(s) de otros dispositivos.`
          : "Sincronizado: todo al día.",
      );
      setAlreadyConfigured(true);
    } else {
      setStatus("error");
      setMessage(REASON_COPY[result.reason]);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {alreadyConfigured && (
        <p className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400">
          Ya hay una sincronización configurada en este dispositivo. Puedes volver a
          introducir los datos si quieres corregir algo.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-500" htmlFor="sync-passphrase">
          Passphrase de cifrado
        </label>
        <div className="flex items-center gap-2">
          <input
            id="sync-passphrase"
            type={showPassphrase ? "text" : "password"}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-2"
          />
          <button
            type="button"
            onClick={() => setShowPassphrase((v) => !v)}
            aria-label={showPassphrase ? "Ocultar passphrase" : "Mostrar passphrase"}
            className="text-neutral-500"
          >
            {showPassphrase ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          La misma en todos tus dispositivos. Guárdala ahora en tu gestor de
          contraseñas. La app no podrá volver a mostrártela después de esta pantalla.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-500" htmlFor="sync-token">
          Token de sincronización
        </label>
        <div className="flex items-center gap-2">
          <input
            id="sync-token"
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-2"
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            aria-label={showToken ? "Ocultar token" : "Mostrar token"}
            className="text-neutral-500"
          >
            {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          El valor de <code>SYNC_API_TOKEN</code> configurado en Vercel, el mismo en
          todos tus dispositivos. Este sí puede volver a mostrarse aquí en cualquier
          momento.
        </p>
      </div>

      <button
        type="submit"
        disabled={!passphrase || !token || status === "saving"}
        className="rounded-lg bg-foreground py-3 text-center text-sm font-medium text-background disabled:opacity-40"
      >
        {status === "saving" ? "Sincronizando…" : "Guardar y sincronizar"}
      </button>

      {message && (
        <p className={`text-sm ${status === "error" ? "text-red-500" : "text-green-600"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
