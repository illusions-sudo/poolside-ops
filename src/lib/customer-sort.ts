export type CustomerSortKey =
  | "name"
  | "company"
  | "city"
  | "state"
  | "properties"
  | "status"
  | "created";

export type SortDirection = "asc" | "desc";

export type CustomerSortOption = {
  key: CustomerSortKey;
  label: string;
};

export const CUSTOMER_SORT_OPTIONS: CustomerSortOption[] = [
  { key: "name", label: "Name (A–Z)" },
  { key: "company", label: "Company" },
  { key: "city", label: "City / town" },
  { key: "state", label: "State" },
  { key: "properties", label: "Property count" },
  { key: "status", label: "Active status" },
  { key: "created", label: "Date added" },
];

export type SortableCustomer = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  active?: boolean | null;
  created_at?: string | null;
  properties?: { count?: number }[] | null;
};

/** Display name used for the "Name" sort: last name first so the list reads like a directory. */
export function customerSortName(c: SortableCustomer): string {
  const last = (c.last_name ?? "").trim();
  const first = (c.first_name ?? "").trim();
  if (last && first) return `${last}, ${first}`;
  if (last) return last;
  if (first) return first;
  return (c.company_name ?? "").trim();
}

function propertyCount(c: SortableCustomer): number {
  return c.properties?.[0]?.count ?? 0;
}

/**
 * Sort key for a row. Empty values (no city, no company) always compare as "" so
 * they land last in ascending order regardless of the direction flip.
 */
function sortValue(c: SortableCustomer, key: CustomerSortKey): string | number {
  switch (key) {
    case "name":
      return customerSortName(c);
    case "company":
      return (c.company_name ?? "").trim();
    case "city":
      return (c.billing_city ?? "").trim();
    case "state":
      return (c.billing_state ?? "").trim();
    case "properties":
      return propertyCount(c);
    case "status":
      return c.active ? 0 : 1;
    case "created":
      return c.created_at ?? "";
  }
}

/**
 * Sorts a customer list by a field and direction, keeping rows with no value for
 * that field at the bottom. Falls back to name, then id, so the order is stable
 * and identical every time the page is opened.
 */
export function sortCustomers<T extends SortableCustomer>(
  list: readonly T[],
  key: CustomerSortKey,
  direction: SortDirection,
): T[] {
  const dir = direction === "desc" ? -1 : 1;

  return [...list].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);

    // Rows missing a value for the sorted field stay at the bottom either way.
    const aEmpty = av === "" || av === null || av === undefined;
    const bEmpty = bv === "" || bv === null || bv === undefined;
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;

    let cmp: number;
    if (typeof av === "number" || typeof bv === "number") {
      cmp = Number(av) - Number(bv);
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }
    if (cmp !== 0) return cmp * dir;

    // Tie-breaker keeps the order deterministic.
    return customerSortName(a).localeCompare(customerSortName(b), undefined, {
      sensitivity: "base",
    });
  });
}
