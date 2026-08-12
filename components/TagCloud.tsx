"use client";

export function TagCloud({
  tags,
  selected,
  onToggle,
}: {
  tags: readonly string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const active = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active
                ? "border-foreground bg-foreground text-background"
                : "border-neutral-700 text-neutral-400"
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
