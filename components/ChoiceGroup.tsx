"use client";

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            value === option.value
              ? "border-brand-green bg-brand-green text-white"
              : "border-neutral-700 text-neutral-400"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
