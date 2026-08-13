"use client";

import { useState, type ReactNode } from "react";
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
import { NO_PAIN } from "@/lib/pain-scale";
import { FOOD_TAGS, PAIN_LOCATIONS } from "@/lib/types";
import type {
  PainLevel,
  ScaleLevel,
  SportEntry,
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

  // History days skip the "already registered" summary screen and open
  // straight into the editable form; only today keeps that intermediate step.
  const [editing, setEditing] = useState(!existing || !isToday);
  const [painLevel, setPainLevel] = useState<PainLevel | null>(
    existing?.painLevel ?? null,
  );
  const [painLocations, setPainLocations] = useState<string[]>(
    existing?.painLocations ?? [],
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

  // Today stays on the page and flips to the celebration screen; any other
  // day (opened from Historial) always returns there instead.
  function finishEditing() {
    if (isToday) {
      setEditing(false);
    } else {
      router.push("/history");
    }
  }

  // painLevel is no longer the sole required field — a retrospective log
  // (e.g. remembering activity/sport but not the pain that day) is valid
  // with painLevel left blank, as long as something else was filled in.
  const hasAnyData =
    painLevel !== null ||
    painLocations.length > 0 ||
    activityLevel !== null ||
    lieDownNeed !== null ||
    sports.length > 0 ||
    period !== null ||
    sex !== null ||
    foodQuantity !== null ||
    foodQuality !== null ||
    foodTags.length > 0;

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
    saveEntry({
      date,
      painLevel,
      painLocations,
      activityLevel,
      lieDownNeed,
      sports,
      period: period === "si",
      sex: sex === "si",
      food: { quantity: foodQuantity, quality: foodQuality, tags: foodTags },
    });
    finishEditing();
  }

  function clearAll() {
    setPainLevel(null);
    setPainLocations([]);
    setActivityLevel(null);
    setLieDownNeed(null);
    setSports([]);
    setPeriod(null);
    setSex(null);
    setFoodQuantity(null);
    setFoodQuality(null);
    setFoodTags([]);
  }

  function startEdit() {
    if (!existing) return;
    setPainLevel(existing.painLevel);
    setPainLocations(existing.painLocations);
    setActivityLevel(existing.activityLevel);
    setLieDownNeed(existing.lieDownNeed);
    setSports(existing.sports);
    setPeriod(existing.period ? "si" : "no");
    setSex(existing.sex ? "si" : "no");
    setFoodQuantity(existing.food.quantity);
    setFoodQuality(existing.food.quality);
    setFoodTags(existing.food.tags);
    setEditing(true);
  }

  function toggleFoodTag(tag: string) {
    setFoodTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function togglePainLocation(location: string) {
    setPainLocations((prev) =>
      prev.includes(location)
        ? prev.filter((l) => l !== location)
        : [...prev, location],
    );
  }

  // Only reachable for today: history days always start with editing=true
  // and finishEditing() navigates away from them instead of clearing it.
  if (existing && !editing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <DateHeader date={date} isToday={isToday} />
        <p className="text-4xl">🎉</p>
        <p className="text-neutral-500">Ya registraste hoy.</p>
        <button
          type="button"
          onClick={startEdit}
          className="mt-2 rounded-xl border border-neutral-700 px-4 py-2 text-sm"
        >
          Editar
        </button>
      </div>
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
          onClick={() => {
            setPainLevel(0);
            setPainLocations([]);
          }}
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

      {painLevel !== null && painLevel > 0 && (
        <Field label="Ubicación del dolor">
          <TagCloud
            tags={PAIN_LOCATIONS}
            selected={painLocations}
            onToggle={togglePainLocation}
          />
        </Field>
      )}

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

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!hasAnyData && !existing}
        className="rounded-xl bg-brand-green py-3 text-center text-sm font-medium text-white disabled:opacity-40"
      >
        Guardar
      </button>
    </div>
  );
}
