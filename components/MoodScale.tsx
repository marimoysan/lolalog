"use client";

import { MOOD_LEVELS } from "@/lib/mood-scale";
import type { ScaleLevel } from "@/lib/types";

export function MoodScale({
  value,
  onChange,
}: {
  value: ScaleLevel | null;
  onChange: (level: ScaleLevel) => void;
}) {
  return (
    <div className="flex gap-3">
      {MOOD_LEVELS.map(({ level, Icon, label, textClass, bgClass }) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          aria-label={`Ánimo nivel ${level}: ${label}`}
          className={`rounded-full p-1.5 transition-colors ${
            value === level ? `${bgClass} ${textClass}` : "text-neutral-400"
          }`}
        >
          <Icon size={32} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
