"use client";

import { useState } from "react";
import { Info } from "lucide-react";

export function TagCloud({
  tags,
  selected,
  onToggle,
  hints,
}: {
  tags: readonly string[];
  selected: string[];
  onToggle: (tag: string) => void;
  // Optional tag -> explanation, shown as a tap-to-reveal hint (e.g. what
  // counts as "Gluten") instead of a hover title, since this is used on
  // touch devices.
  hints?: Partial<Record<string, string>>;
}) {
  const [openHint, setOpenHint] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const active = selected.includes(tag);
        const hint = hints?.[tag];
        return (
          <div key={tag} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggle(tag)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-brand-green bg-brand-green text-white"
                  : "border-neutral-700 text-neutral-400"
              }`}
            >
              {tag}
            </button>
            {hint && (
              <button
                type="button"
                onClick={() => setOpenHint((prev) => (prev === tag ? null : tag))}
                aria-label={`Qué contiene ${tag}`}
                className="text-neutral-500"
              >
                <Info size={16} strokeWidth={1.75} />
              </button>
            )}
          </div>
        );
      })}
      {openHint && hints?.[openHint] && (
        <p className="w-full rounded-xl border border-neutral-800 p-3 text-xs text-neutral-400">
          {hints[openHint]}
        </p>
      )}
    </div>
  );
}
