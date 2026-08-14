import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-6" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function LoadingRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 flex-1 animate-pulse rounded bg-muted"
              style={{ maxWidth: c === 0 ? "12rem" : "8rem" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <h3 className="text-base font-semibold">We couldn't load this data</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        {message ?? "Please check your connection and try again."}
      </p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
