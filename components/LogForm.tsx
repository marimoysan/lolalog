"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEntries } from "@/lib/db/entries-store";
import { DateHeader } from "@/components/DateHeader";
import { PainScale } from "@/components/PainScale";
import { ScaleInput } from "@/components/ScaleInput";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { TagCloud } from "@/components/TagCloud";
import { SportPicker } from "@/components/SportPicker";
import { PainEpisodePicker } from "@/components/PainEpisodePicker";
import { NO_PAIN } from "@/lib/pain-scale";
import { FOOD_TAGS } from "@/lib/types";
import type {
  PainLevel,
  ScaleLevel,
  SportEntry,
  PainEpisode,
  FoodQuantity,
  FoodQuality,
} from "@/lib/types";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-neutral-500">{label}</label>
      {children}
    </div>
  );
}

const YES_NO = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
] as const;

export function LogForm({ date, isToday }: { date: string; isToday: boolean }) {
  const router = useRouter();
  const { getEntry, saveEntry, deleteEntry } = useEntries();
  const existing = getEntry(date);

  const [painLevel, setPainLevel] = useState<PainLevel | null>(
    existing?.painLevel ?? null,
  );
  const [painEpisodes, setPainEpisodes] = useState<PainEpisode[]>(
    existing?.painEpisodes ?? [],
  );
  const [activityLevel, setActivityLevel] = useState<ScaleLevel | null>(
    existing?.activityLevel ?? null,
  );
  const [lieDownNeed, setLieDownNeed] = useState<ScaleLevel | null>(
    existing?.lieDownNeed ?? null,
  );
  const [sports, setSports] = useState<SportEntry[]>(existing?.sports ?? []);
  const [period, setPeriod] = useState<"si" | "no" | null>(
    existing ? (existing.period ? "si" : "no") : null,
  );
  const [sex, setSex] = useState<"si" | "no" | null>(
    existing ? (existing.sex ? "si" : "no") : null,
  );
  const [foodQuantity, setFoodQuantity] = useState<FoodQuantity | null>(
    existing?.food.quantity ?? null,
  );
  const [foodQuality, setFoodQuality] = useState<FoodQuality | null>(
    existing?.food.quality ?? null,
  );
  const [foodTags, setFoodTags] = useState<string[]>(existing?.food.tags ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");

  // Today's log stays open all day (it gets added to throughout the day),
  // so saving just leaves you where you are; any other day (opened from
  // Historial) goes back there instead.
  function finishEditing() {
    if (!isToday) router.push("/history");
  }

  // painLevel is no longer the sole required field — a retrospective log
  // (e.g. remembering activity/sport but not the pain that day) is valid
  // with painLevel left blank, as long as something else was filled in.
  const hasAnyData =
    painLevel !== null ||
    painEpisodes.length > 0 ||
    activityLevel !== null ||
    lieDownNeed !== null ||
    sports.length > 0 ||
    period !== null ||
    sex !== null ||
    foodQuantity !== null ||
    foodQuality !== null ||
    foodTags.length > 0 ||
    notes.trim() !== "";

  function buildEntry() {
    return {
      date,
      painLevel,
      painEpisodes,
      activityLevel,
      lieDownNeed,
      sports,
      period: period === "si",
      sex: sex === "si",
      food: { quantity: foodQuantity, quality: foodQuality, tags: foodTags },
      notes,
    };
  }

  function handleSubmit() {
    if (!hasAnyData) {
      // Everything blank on a day that already had an entry means "Vaciar
      // todo" was used: save-as-blank is how you return a day to unlogged.
      // On a brand-new day there's nothing to save (button is disabled).
      if (existing) {
        deleteEntry(date);
        finishEditing();
      }
      return;
    }
    saveEntry(buildEntry());
    finishEditing();
  }

  // Today's log autosaves (debounced) instead of needing an explicit Guardar
  // tap, since it's meant to be revisited and added to all day. History days
  // keep the manual button below — those are one-shot edits, not a running
  // log, so an explicit save (and the "Vaciar todo" it enables) fits better.
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "pending" | "saved">("idle");
  // Baseline to detect "has anything actually changed since the page
  // loaded" — computed once, lazily, during the first render. A boolean
  // "have I run yet" ref doesn't work here: React Strict Mode fires this
  // effect twice in dev, and the throwaway first call consumes it, making
  // the debounced save show as already "pending" on load.
  const initialSnapshot = useRef<string | null>(null);
  if (initialSnapshot.current === null) {
    initialSnapshot.current = JSON.stringify(buildEntry());
  }

  useEffect(() => {
    if (!isToday) return;
    if (JSON.stringify(buildEntry()) === initialSnapshot.current) return;
    setAutosaveStatus("pending");
    const timeout = setTimeout(() => {
      if (hasAnyData) {
        saveEntry(buildEntry());
      } else if (existing) {
        deleteEntry(date);
      }
      setAutosaveStatus("saved");
    }, 800);
    return () => clearTimeout(timeout);
    // existing/hasAnyData/saveEntry/deleteEntry are read fresh from this
    // render's closure on purpose — they come from EntriesProvider, whose
    // functions get a new identity on every save, so listing them here
    // would re-trigger this effect on every autosave and loop forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isToday,
    painLevel,
    painEpisodes,
    activityLevel,
    lieDownNeed,
    sports,
    period,
    sex,
    foodQuantity,
    foodQuality,
    foodTags,
    notes,
  ]);

  function clearAll() {
    setPainLevel(null);
    setPainEpisodes([]);
    setActivityLevel(null);
    setLieDownNeed(null);
    setSports([]);
    setPeriod(null);
    setSex(null);
    setFoodQuantity(null);
    setFoodQuality(null);
    setFoodTags([]);
    setNotes("");
  }

  function toggleFoodTag(tag: string) {
    setFoodTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {!isToday && (
        <div className="flex items-center justify-between">
          <Link
            href="/history"
            className="flex items-center gap-1 text-xs text-neutral-500 no-underline"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Historial
          </Link>
          {existing && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-neutral-700 px-3 py-1.5 text-xs text-neutral-500"
            >
              Vaciar todo
            </button>
          )}
        </div>
      )}

      <DateHeader date={date} isToday={isToday} />

      <div className="flex flex-col items-center gap-3">
        <PainScale value={painLevel} onChange={setPainLevel} />
        <button
          type="button"
          onClick={() => setPainLevel(0)}
          className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors ${
            painLevel === 0
              ? `border-brand-green ${NO_PAIN.bgClass} ${NO_PAIN.textClass}`
              : "border-neutral-700 text-neutral-500"
          }`}
        >
          <NO_PAIN.Icon size={18} strokeWidth={1.75} />
          {NO_PAIN.label}
        </button>
      </div>

      <Field label="Episodios de dolor">
        <PainEpisodePicker value={painEpisodes} onChange={setPainEpisodes} />
      </Field>

      <hr className="my-4 border-neutral-800" />
      <h2 className="text-lg font-medium">Actividad diaria</h2>

      <Field label="Actividad (caminar, paseos, recados)">
        <ScaleInput
          value={activityLevel}
          onChange={setActivityLevel}
          ariaLabelPrefix="Actividad"
        />
      </Field>

      <Field label="Necesidad de tumbarme">
        <ScaleInput
          value={lieDownNeed}
          onChange={setLieDownNeed}
          ariaLabelPrefix="Necesidad de tumbarme"
        />
      </Field>

      <Field label="Deporte">
        <SportPicker value={sports} onChange={setSports} />
      </Field>

      <Field label="Regla">
        <ChoiceGroup options={[...YES_NO]} value={period} onChange={setPeriod} />
      </Field>

      <Field label="Relaciones sexuales">
        <ChoiceGroup options={[...YES_NO]} value={sex} onChange={setSex} />
      </Field>

      <Field label="Comida — cantidad">
        <ChoiceGroup<FoodQuantity>
          options={[
            { value: "poco", label: "Poco" },
            { value: "normal", label: "Normal" },
            { value: "mucho", label: "Mucho" },
          ]}
          value={foodQuantity}
          onChange={setFoodQuantity}
        />
      </Field>

      <Field label="Comida — calidad">
        <ChoiceGroup<FoodQuality>
          options={[
            { value: "unhealthy", label: "Poco saludable" },
            { value: "medium", label: "Normal" },
            { value: "healthy", label: "Saludable" },
          ]}
          value={foodQuality}
          onChange={setFoodQuality}
        />
      </Field>

      <Field label="Comida — qué comiste">
        <TagCloud tags={FOOD_TAGS} selected={foodTags} onToggle={toggleFoodTag} />
      </Field>

      <Field label="Notas">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Cualquier otra cosa que quieras añadir"
          rows={3}
          className="resize-none rounded-xl border border-neutral-700 bg-transparent p-3 text-sm placeholder:text-neutral-600"
        />
      </Field>

      {isToday ? (
        <p className="text-center text-xs text-neutral-500" aria-live="polite">
          {autosaveStatus === "pending"
            ? "Guardando…"
            : autosaveStatus === "saved"
              ? "Guardado"
              : "Se guarda automáticamente"}
        </p>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasAnyData && !existing}
          className="rounded-xl bg-brand-green py-3 text-center text-sm font-medium text-white disabled:opacity-40"
        >
          Guardar
        </button>
      )}
    </div>
  );
}
