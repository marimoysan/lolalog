"use client";

import type { ScaleLevel } from "@/lib/types";

const LEVELS: ScaleLevel[] = [1, 2, 3, 4, 5];

export function ScaleInput({
  value,
  onChange,
  ariaLabelPrefix,
}: {
  value: ScaleLevel | null;
  onChange: (level: ScaleLevel) => void;
  ariaLabelPrefix: string;
}) {
  return (
    <div className="flex gap-2">
      {LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          aria-label={`${ariaLabelPrefix} ${level}`}
          className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-colors ${
            value === level
              ? "border-brand-green bg-brand-green font-medium text-white"
              : "border-neutral-700 text-neutral-400"
          }`}
        >
          {level}
        </button>
      ))}
    </div>
  );
}
