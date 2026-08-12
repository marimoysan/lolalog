"use client";

// UI-only lock, not real security: the PIN ships in the client bundle and
// nothing here is encrypted. Good enough to keep data off a glanced-at
// screen; see CLAUDE.md before treating this as protecting the SQLite data.

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";

const PIN = process.env.NEXT_PUBLIC_LOLALOG_PIN ?? "1234";
const SESSION_KEY = "lolalog.unlocked";

export function PinGate({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    setUnlocked(sessionStorage.getItem(SESSION_KEY) === "1");
    setChecked(true);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value === PIN) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setValue("");
    }
  }

  if (!checked) return null;

  if (!unlocked) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-lg font-medium">lolalog</h1>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center gap-3"
        >
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            className="w-32 rounded-lg border border-neutral-700 bg-transparent px-4 py-2 text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-sm text-red-500">PIN incorrecto</p>}
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Entrar
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col pb-16">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
