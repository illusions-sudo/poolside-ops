import { describe, expect, it } from "vitest";

import {
  CUSTOMER_SORT_OPTIONS,
  customerSortName,
  sortCustomers,
  type SortableCustomer,
} from "./customer-sort";

const rows: SortableCustomer[] = [
  { id: "1", first_name: "Zoe", last_name: "Adams", billing_city: "Yarmouth", billing_state: "MA" },
  { id: "2", first_name: "Aaron", last_name: "Zimmer", billing_city: "Barnstable", billing_state: "MA" },
  { id: "3", first_name: "Mia", last_name: "Chen", company_name: "Blue Harbor", billing_city: "Falmouth" },
  { id: "4", first_name: "Owen", last_name: "Reilly", billing_city: "Yarmouth", billing_state: "MA" },
  { id: "5", first_name: "Priya", company_name: "Seaside Villas", billing_state: "RI" },
];

const ids = (list: SortableCustomer[]) => list.map((r) => r.id);

describe("sortCustomers", () => {
  it("sorts alphabetically by last name first", () => {
    expect(ids(sortCustomers(rows, "name", "asc"))).toEqual(["1", "3", "5", "4", "2"]);
    expect(ids(sortCustomers(rows, "name", "desc"))).toEqual(["2", "4", "5", "3", "1"]);
  });

  it("sorts by town and keeps customers with no town at the bottom", () => {
    expect(ids(sortCustomers(rows, "city", "asc"))).toEqual(["2", "3", "1", "4", "5"]);
    expect(ids(sortCustomers(rows, "city", "desc"))).toEqual(["1", "4", "3", "2", "5"]);
  });

  it("sorts by state with the missing state last in both directions", () => {
    expect(ids(sortCustomers(rows, "state", "asc"))).toEqual(["1", "2", "4", "5", "3"]);
    expect(ids(sortCustomers(rows, "state", "desc"))).toEqual(["5", "1", "2", "4", "3"]);
  });

  it("lists active customers before inactive ones when sorted by status", () => {
    const withStatus: SortableCustomer[] = [
      { id: "a", last_name: "A", active: true },
      { id: "b", last_name: "B", active: false },
      { id: "c", last_name: "C", active: true },
    ];
    expect(ids(sortCustomers(withStatus, "status", "asc"))).toEqual(["a", "c", "b"]);
    expect(ids(sortCustomers(withStatus, "status", "desc"))).toEqual(["b", "a", "c"]);
  });

  it("sorts by property count with the fewest first", () => {
    const withProps: SortableCustomer[] = [
      { id: "a", last_name: "A", properties: [{ count: 2 }] },
      { id: "b", last_name: "B", properties: [{ count: 7 }] },
      { id: "c", last_name: "C" },
    ];
    expect(ids(sortCustomers(withProps, "properties", "asc"))).toEqual(["c", "a", "b"]);
    expect(ids(sortCustomers(withProps, "properties", "desc"))).toEqual(["b", "a", "c"]);
  });

  it("does not modify the caller's array", () => {
    const before = ids(rows);
    sortCustomers(rows, "city", "desc");
    expect(ids(rows)).toEqual(before);
  });

  it("names rows last name first, falling back to company", () => {
    expect(customerSortName({ id: "x", first_name: "Jon", last_name: "Amaral" })).toBe(
      "Amaral, Jon",
    );
    expect(customerSortName({ id: "x", company_name: "Seaside Villas" })).toBe("Seaside Villas");
  });

  it("offers every field the list can be sorted by", () => {
    expect(CUSTOMER_SORT_OPTIONS.map((o) => o.key)).toEqual([
      "name",
      "company",
      "city",
      "state",
      "properties",
      "status",
      "created",
    ]);
  });
});
