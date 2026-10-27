// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let networkDown = false;
vi.mock("@/integrations/supabase/client", () => {
  const result = (label: string) => {
    if (networkDown) return Promise.reject(new TypeError("Failed to fetch"));
    calls.push(label);
    return Promise.resolve({ error: null });
  };
  return {
    supabase: {
      from: (t: string) => ({
        insert: () => result(`insert ${t}`),
        update: () => ({ eq: (_c: string, id: string) => result(`update ${t} ${id}`) }),
        delete: () => ({ eq: (_c: string, id: string) => result(`delete ${t} ${id}`) }),
      }),
    },
  };
});

function setOnline(v: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => v });
}

describe("offline visit queue", () => {
  beforeEach(() => {
    calls.length = 0;
    networkDown = false;
    localStorage.clear();
    vi.resetModules();
  });

  it("saves writes on the phone while offline and sends them in order once back online", async () => {
    const q = await import("./offline-queue");
    setOnline(false);
    expect((await q.runWrite({ table: "service_records", kind: "update", rowId: "a", values: {} })).queued).toBe(true);
    await q.runWrite({ table: "service_chemical_usage", kind: "insert", values: {} });
    expect(calls).toEqual([]);
    expect(q.getQueueState().pending).toHaveLength(2);

    setOnline(true);
    expect(await q.flushQueue()).toBe(2);
    expect(calls).toEqual(["update service_records a", "insert service_chemical_usage"]);
    expect(q.getQueueState().pending).toHaveLength(0);
  });

  it("queues instead of failing when the signal drops mid-save", async () => {
    const q = await import("./offline-queue");
    setOnline(true);
    networkDown = true;
    expect((await q.runWrite({ table: "service_records", kind: "update", rowId: "b", values: {} })).queued).toBe(true);
    expect(await q.flushQueue()).toBe(0);
    expect(q.getQueueState().pending).toHaveLength(1);
  });

  it("writes straight away when online", async () => {
    const q = await import("./offline-queue");
    setOnline(true);
    expect((await q.runWrite({ table: "service_records", kind: "delete", rowId: "c" })).queued).toBe(false);
    expect(calls).toEqual(["delete service_records c"]);
  });
});
