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
  en_route: "En Route",
  in_progress: "In Progress",
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

/* ---------- Version 2: field service ---------- */

export const FIELD_SERVICE_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  en_route: "En Route",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

/** Statuses a service can legally move to next. */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["en_route", "in_progress", "completed", "skipped", "cancelled"],
  en_route: ["in_progress", "completed", "skipped", "cancelled"],
  in_progress: ["completed", "skipped"],
  completed: ["in_progress"],
  skipped: ["scheduled"],
  cancelled: ["scheduled"],
};

export const OPEN_SERVICE_STATUSES = ["scheduled", "en_route", "in_progress"] as const;

export const SKIP_REASONS: Record<string, string> = {
  customer_request: "Customer requested skip",
  weather: "Bad weather",
  no_access: "Access unavailable",
  pool_closed: "Pool closed",
  equipment_issue: "Equipment issue",
  other: "Other",
};

export const CANCEL_REASONS: Record<string, string> = {
  customer_request: "Customer requested cancellation",
  plan_paused: "Service plan paused",
  scheduling_conflict: "Scheduling conflict",
  duplicate: "Duplicate visit",
  other: "Other",
};

export const EQUIPMENT_TYPES: Record<string, string> = {
  pump: "Pump",
  filter: "Filter",
  heater: "Heater",
  cleaner: "Cleaner",
  salt_system: "Salt system",
  automation: "Automation system",
  other: "Other",
};

export const EQUIPMENT_CONDITIONS: Record<string, string> = {
  good: "Good",
  attention: "Attention Needed",
  problem: "Problem",
  not_checked: "Not Checked",
};

export const CHEMICAL_UNITS: Record<string, string> = {
  gallons: "Gallons",
  quarts: "Quarts",
  ounces: "Ounces",
  pounds: "Pounds",
  tablets: "Tablets",
  bags: "Bags",
  scoops: "Scoops",
};

export const COMMON_CHEMICALS = [
  "Liquid Chlorine",
  "Calcium Hypochlorite",
  "Trichlor Tablets",
  "Muriatic Acid",
  "Sodium Bicarbonate",
  "Soda Ash",
  "Calcium Chloride",
  "Cyanuric Acid",
  "Algaecide",
  "Clarifier",
  "Pool Salt",
  "Diatomaceous Earth",
];

export const CHEMISTRY_FIELDS = [
  { key: "free_chlorine", label: "Free Chlorine", unit: "ppm", ideal: "1–3" },
  { key: "total_chlorine", label: "Total Chlorine", unit: "ppm", ideal: "1–3" },
  { key: "ph", label: "pH", unit: "", ideal: "7.4–7.6" },
  { key: "alkalinity", label: "Alkalinity", unit: "ppm", ideal: "80–120" },
  { key: "calcium_hardness", label: "Calcium Hardness", unit: "ppm", ideal: "200–400" },
  { key: "cyanuric_acid", label: "Cyanuric Acid", unit: "ppm", ideal: "30–50" },
  { key: "salt", label: "Salt", unit: "ppm", ideal: "2700–3400" },
  { key: "water_temperature", label: "Water Temperature", unit: "°F", ideal: "" },
] as const;

export const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Formats a Postgres time value (HH:MM:SS) for display. */
export function clockTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  if (h === undefined || Number.isNaN(h)) return "—";
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

export function timeInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

export function duration(minutes: number | null | undefined): string {
  const m = Math.round(num(minutes));
  if (!m) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export function weekStart(iso: string): string {
  const [y, m, d] = parts(iso);
  const dt = new Date(y, m - 1, d);
  return addDays(iso, -dt.getDay());
}

export function dayOfWeek(iso: string): number {
  const [y, m, d] = parts(iso);
  return new Date(y, m - 1, d).getDay();
}

export function monthLabel(iso: string): string {
  const [y, m, d] = parts(iso);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function weekdayDate(iso: string): string {
  const [y, m, d] = parts(iso);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function personName(
  p: { first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined,
  fallback = "Unassigned",
): string {
  if (!p) return fallback;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || fallback;
}

export function fullAddress(
  p: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null | undefined,
): string {
  if (!p) return "";
  return [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ");
}

export function mapsHref(
  p: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null | undefined,
): string {
  return `https://maps.google.com/?q=${encodeURIComponent(fullAddress(p))}`;
}

export function telHref(phone: string | null | undefined): string {
  return `tel:${(phone ?? "").replace(/[^\d+]/g, "")}`;
}
