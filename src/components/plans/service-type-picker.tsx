import { Bath, Waves } from "lucide-react";

import { cn } from "@/lib/utils";

export type ServiceType = "pool" | "spa";

const OPTIONS: { value: ServiceType; label: string; icon: typeof Waves }[] = [
  { value: "pool", label: "Pool", icon: Waves },
  { value: "spa", label: "Spa", icon: Bath },
];

/**
 * Two-box choice for what a service plan covers: Pool or Spa.
 * Optional — pressing the already-selected box clears the choice.
 */
export function ServiceTypePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: ServiceType | "") => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Pool or spa">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(selected ? "" : option.value)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
