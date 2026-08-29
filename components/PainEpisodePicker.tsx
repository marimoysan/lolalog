"use client";

import { useState } from "react";
import { Check, ChevronDown, StickyNote, Trash2, Plus } from "lucide-react";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { TagCloud } from "@/components/TagCloud";
import { PAIN_EPISODE_SYMPTOMS, PAIN_EPISODE_TRIGGERS, PAIN_LOCATIONS } from "@/lib/types";
import type { PainEpisode } from "@/lib/types";

function newEpisode(): PainEpisode {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    trigger: null,
    symptoms: [],
    locations: [],
    note: "",
  };
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarize(episode: PainEpisode): string {
  const parts = [episode.trigger, ...episode.locations, ...episode.symptoms].filter(
    Boolean,
  ) as string[];
  return parts.length > 0 ? parts.join(" · ") : "Sin detalles";
}

export function PainEpisodePicker({
  value,
  onChange,
}: {
  value: PainEpisode[];
  onChange: (episodes: PainEpisode[]) => void;
}) {
  // Empty by default so existing/loaded episodes show collapsed; adding one
  // opens it for editing, and the check button collapses it back once
  // you're done — otherwise a day with several episodes turns into a wall
  // of open forms.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function updateEpisode(id: string, patch: Partial<PainEpisode>) {
    onChange(value.map((ep) => (ep.id === id ? { ...ep, ...patch } : ep)));
  }

  function removeEpisode(id: string) {
    onChange(value.filter((ep) => ep.id !== id));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSymptom(episode: PainEpisode, symptom: string) {
    const symptoms = episode.symptoms.includes(symptom)
      ? episode.symptoms.filter((s) => s !== symptom)
      : [...episode.symptoms, symptom];
    updateEpisode(episode.id, { symptoms });
  }

  function toggleLocation(episode: PainEpisode, location: string) {
    const locations = episode.locations.includes(location)
      ? episode.locations.filter((l) => l !== location)
      : [...episode.locations, location];
    updateEpisode(episode.id, { locations });
  }

  function addEpisode() {
    const episode = newEpisode();
    onChange([...value, episode]);
    setExpandedIds((prev) => new Set(prev).add(episode.id));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((episode) => {
        if (!expandedIds.has(episode.id)) {
          return (
            <button
              key={episode.id}
              type="button"
              onClick={() => toggleExpanded(episode.id)}
              className="flex items-center justify-between gap-2 rounded-xl border border-neutral-800 px-3 py-2.5 text-left text-sm"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-neutral-500">{formatTime(episode.timestamp)}</span>
                <span className="truncate">{summarize(episode)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {episode.note.trim() !== "" && (
                  <StickyNote size={14} className="text-neutral-500" aria-label="Tiene nota" />
                )}
                <ChevronDown size={16} className="text-neutral-500" />
              </span>
            </button>
          );
        }

        return (
          <div
            key={episode.id}
            className="flex flex-col gap-3 rounded-xl border border-neutral-800 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">{formatTime(episode.timestamp)}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleExpanded(episode.id)}
                  aria-label="Guardar episodio"
                  className="rounded-full p-1 text-brand-green"
                >
                  <Check size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => removeEpisode(episode.id)}
                  aria-label="Quitar episodio"
                  className="p-1 text-neutral-500"
                >
                  <Trash2 size={18} />
                </button>
              </div>
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

            <div className="flex flex-col gap-2">
              <label className="text-xs text-neutral-500">Ubicación del dolor</label>
              <TagCloud
                tags={PAIN_LOCATIONS}
                selected={episode.locations}
                onToggle={(location) => toggleLocation(episode, location)}
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
        );
      })}
      <button
        type="button"
        onClick={addEpisode}
        className="flex items-center gap-1 self-start rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400"
      >
        <Plus size={16} />
        Añadir episodio
      </button>
    </div>
  );
}
