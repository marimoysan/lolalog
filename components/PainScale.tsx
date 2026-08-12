"use client";

import { PAIN_LEVELS } from "@/lib/pain-scale";
import type { PainLevel } from "@/lib/types";

export function PainScale({
  value,
  onChange,
}: {
  value: PainLevel | null;
  onChange: (level: PainLevel) => void;
}) {
  return (
    <div className="flex gap-3">
      {PAIN_LEVELS.map(({ level, Icon, label, textClass, bgClass }) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          aria-label={`Dolor nivel ${level}: ${label}`}
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
