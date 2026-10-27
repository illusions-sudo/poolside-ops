import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CustomerSortKey, SortDirection } from "@/lib/customer-sort";

/**
 * Table heading that sorts the list when clicked: the active column is highlighted
 * with an arrow, and screen readers hear the current direction.
 */
export function SortableTh({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: CustomerSortKey;
  activeKey: CustomerSortKey;
  direction: SortDirection;
  onSort: (key: CustomerSortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;

  return (
    <th
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : undefined}
      className={cn("px-4 py-2.5 font-medium", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label.toLowerCase()}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm text-xs font-medium uppercase tracking-wide transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (
          direction === "asc" ? (
            <ArrowUp className="size-3.5" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  );
}
