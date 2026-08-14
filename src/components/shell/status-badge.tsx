import { cn } from "@/lib/utils";
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PLAN_STATUS_LABELS,
  SERVICE_STATUS_LABELS,
} from "@/lib/format";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  info: "bg-info/10 text-info border-info/25",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/15 text-warning-foreground border-warning/35",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  muted: "bg-muted text-muted-foreground border-border",
};

const TONES: Record<string, Tone> = {
  draft: "neutral",
  sent: "info",
  paid: "success",
  partially_paid: "warning",
  overdue: "danger",
  void: "muted",
  scheduled: "info",
  completed: "success",
  cancelled: "muted",
  skipped: "warning",
  pending: "warning",
  failed: "danger",
  refunded: "muted",
  active: "success",
  paused: "warning",
  inactive: "muted",
};

const LABELS: Record<string, string> = {
  ...INVOICE_STATUS_LABELS,
  ...SERVICE_STATUS_LABELS,
  ...PAYMENT_STATUS_LABELS,
  ...PLAN_STATUS_LABELS,
  inactive: "Inactive",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const tone = TONES[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {label ?? LABELS[status] ?? status}
    </span>
  );
}
