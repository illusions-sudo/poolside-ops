export function money(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number.isFinite(n) ? n : 0,
  );
}

export function num(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Formats a plain date string (YYYY-MM-DD) without timezone drift. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = value.length > 10 ? value.slice(0, 10) : value;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parts(iso: string): [number, number, number] {
  const p = iso.slice(0, 10).split("-");
  return [Number(p[0] ?? 0), Number(p[1] ?? 1), Number(p[2] ?? 1)];
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function daysOverdue(dueDate: string | null | undefined): number {
  if (!dueDate) return 0;
  const [y, m, d] = parts(dueDate);
  const due = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((start - due) / 86_400_000));
}

export function customerName(c: {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
} | null | undefined): string {
  if (!c) return "—";
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  if (person && c.company_name) return `${person} (${c.company_name})`;
  return person || c.company_name || "Unnamed customer";
}

export function initials(first?: string | null, last?: string | null, fallback = "U"): string {
  const a = (first ?? "").trim()[0];
  const b = (last ?? "").trim()[0];
  return ((a ?? "") + (b ?? "")).toUpperCase() || fallback;
}

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  one_time: "One-time",
  custom: "Custom",
};

export const BILLING_LABELS: Record<string, string> = {
  per_service: "Per service",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
  one_time: "One-time",
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  skipped: "Skipped",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
  void: "Void",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  credit_card: "Credit Card",
  ach: "ACH",
  other: "Other",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  failed: "Failed",
  refunded: "Refunded",
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Administrator",
  employee: "Employee",
};

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Turns a database/PostgREST error into something safe to show a user. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  if (!raw) return fallback;
  if (/exceeds the remaining balance/i.test(raw)) return raw.replace(/^.*?Payment/, "Payment");
  if (/duplicate key|already exists/i.test(raw)) return "That record already exists.";
  if (/violates foreign key/i.test(raw)) return "A linked record is missing or still in use.";
  if (/row-level security|permission denied|not authorized/i.test(raw))
    return "You don't have permission to do that.";
  if (/violates not-null/i.test(raw)) return "Please fill in all required fields.";
  if (/check constraint|check_violation/i.test(raw)) return "Some values are not valid. Please review the form.";
  if (/failed to fetch|network/i.test(raw)) return "Network problem — please check your connection and retry.";
  return fallback;
}
