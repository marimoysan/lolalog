"use client";

import { X, Plus } from "lucide-react";
import { ScaleInput } from "@/components/ScaleInput";
import { SPORT_TYPES } from "@/lib/types";
import type { SportEntry } from "@/lib/types";

function newSport(): SportEntry {
  return { id: crypto.randomUUID(), type: SPORT_TYPES[0], intensity: null };
}

export function SportPicker({
  value,
  onChange,
}: {
  value: SportEntry[];
  onChange: (sports: SportEntry[]) => void;
}) {
  function updateSport(id: string, patch: Partial<SportEntry>) {
    onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSport(id: string) {
    onChange(value.filter((s) => s.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((sport) => (
        <div
          key={sport.id}
          className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-3"
        >
          <div className="flex items-center gap-2">
            <select
              value={sport.type}
              onChange={(e) =>
                updateSport(sport.id, {
                  type: e.target.value as SportEntry["type"],
                })
              }
              className="flex-1 rounded-lg border border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
            >
              {SPORT_TYPES.map((type) => (
                <option key={type} value={type} className="bg-background text-foreground">
                  {type}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeSport(sport.id)}
              aria-label="Quitar deporte"
              className="p-1 text-neutral-500"
            >
              <X size={18} />
            </button>
          </div>
          <ScaleInput
            value={sport.intensity}
            onChange={(intensity) => updateSport(sport.id, { intensity })}
            ariaLabelPrefix={`Intensidad ${sport.type}`}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, newSport()])}
        className="flex items-center gap-1 self-start rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400"
      >
        <Plus size={16} />
        Añadir deporte
      </button>
    </div>
  );
}
