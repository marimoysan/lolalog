"use client";

// UI-only lock, not real security: the PIN ships in the client bundle and
// nothing here is encrypted. Good enough to keep data off a glanced-at
// screen; see CLAUDE.md before treating this as protecting the SQLite data.

import { useEffect, useState, type ReactNode } from "react";
import { Delete } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

const PIN = process.env.NEXT_PUBLIC_LOLALOG_PIN ?? "1234";
const SESSION_KEY = "lolalog.unlocked";
const PIN_LENGTH = 4;

const DIAL_KEYS = [
  "1", "2", "3",
  "4", "5", "6",
  "7", "8", "9",
  "", "0", "backspace",
];

export function PinGate({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    setUnlocked(sessionStorage.getItem(SESSION_KEY) === "1");
    setChecked(true);
  }, []);

  useEffect(() => {
    if (value.length !== PIN_LENGTH) return;
    if (value === PIN) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
      return;
    }
    setError(true);
    const timeout = setTimeout(() => {
      setValue("");
      setError(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [value]);

  function pressDigit(digit: string) {
    if (error) return;
    setValue((v) => (v.length >= PIN_LENGTH ? v : v + digit));
  }

  function pressBackspace() {
    if (error) return;
    setValue((v) => v.slice(0, -1));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") pressDigit(e.key);
      else if (e.key === "Backspace") pressBackspace();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [error]);

  if (!checked) return null;

  if (!unlocked) {
    return (
      <main className="flex flex-1 flex-col items-center justify-between overflow-y-auto p-8 pt-12 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col items-center gap-4 pt-6">
          <img
            src="/lolalog-icono-1024.svg"
            alt=""
            className="h-20 w-20 rounded-[18px]"
          />
          <span className="text-3xl font-semibold text-foreground">
            Lola<span className="text-brand-green-light">Log</span>
          </span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-4">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                  error
                    ? "border-red-500 bg-red-500"
                    : i < value.length
                      ? "border-brand-coral bg-brand-coral"
                      : "border-neutral-600 bg-transparent"
                }`}
              />
            ))}
          </div>
          <p className="h-5 text-sm text-red-500">
            {error ? "PIN incorrecto" : ""}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {DIAL_KEYS.map((key, i) => {
            if (key === "") return <div key={i} className="h-16 w-16" />;
            if (key === "backspace") {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={pressBackspace}
                  aria-label="Borrar"
                  className="flex h-16 w-16 items-center justify-center rounded-full text-foreground transition-colors active:bg-neutral-800/60"
                >
                  <Delete size={22} strokeWidth={1.75} />
                </button>
              );
            }
            return (
              <button
                key={i}
                type="button"
                onClick={() => pressDigit(key)}
                aria-label={`Dígito ${key}`}
                className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-medium text-foreground transition-colors active:bg-neutral-800/60"
              >
                {key}
              </button>
            );
          })}
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
