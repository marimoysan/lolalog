"use client";

import { X, Plus } from "lucide-react";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { TagCloud } from "@/components/TagCloud";
import { PAIN_EPISODE_SYMPTOMS, PAIN_EPISODE_TRIGGERS } from "@/lib/types";
import type { PainEpisode } from "@/lib/types";

function newEpisode(): PainEpisode {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    trigger: null,
    symptoms: [],
    note: "",
  };
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PainEpisodePicker({
  value,
  onChange,
}: {
  value: PainEpisode[];
  onChange: (episodes: PainEpisode[]) => void;
}) {
  function updateEpisode(id: string, patch: Partial<PainEpisode>) {
    onChange(value.map((ep) => (ep.id === id ? { ...ep, ...patch } : ep)));
  }

  function removeEpisode(id: string) {
    onChange(value.filter((ep) => ep.id !== id));
  }

  function toggleSymptom(episode: PainEpisode, symptom: string) {
    const symptoms = episode.symptoms.includes(symptom)
      ? episode.symptoms.filter((s) => s !== symptom)
      : [...episode.symptoms, symptom];
    updateEpisode(episode.id, { symptoms });
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((episode) => (
        <div
          key={episode.id}
          className="flex flex-col gap-3 rounded-xl border border-neutral-800 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">{formatTime(episode.timestamp)}</span>
            <button
              type="button"
              onClick={() => removeEpisode(episode.id)}
              aria-label="Quitar episodio"
              className="p-1 text-neutral-500"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-500">Qué lo desencadenó</label>
            <ChoiceGroup
              options={PAIN_EPISODE_TRIGGERS.map((trigger) => ({
                value: trigger,
                label: trigger,
              }))}
              value={episode.trigger}
              onChange={(trigger) => updateEpisode(episode.id, { trigger })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-500">Síntomas</label>
            <TagCloud
              tags={PAIN_EPISODE_SYMPTOMS}
              selected={episode.symptoms}
              onToggle={(symptom) => toggleSymptom(episode, symptom)}
            />
          </div>

          <input
            type="text"
            value={episode.note}
            onChange={(e) => updateEpisode(episode.id, { note: e.target.value })}
            placeholder="Nota (opcional)"
            className="rounded-lg border border-neutral-700 bg-transparent px-3 py-1.5 text-sm placeholder:text-neutral-600"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, newEpisode()])}
        className="flex items-center gap-1 self-start rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400"
      >
        <Plus size={16} />
        Añadir episodio
      </button>
    </div>
  );
}
