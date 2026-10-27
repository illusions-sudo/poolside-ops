// Offline "outbox" for visit work. Writes made without a signal are saved on the
// device (localStorage) and replayed in order once the connection returns.
import { supabase } from "@/integrations/supabase/client";

export type QueuedTable =
  | "service_records"
  | "service_checklist_items"
  | "service_chemistry_readings"
  | "service_chemical_usage"
  | "service_equipment_observations";

export type QueuedOp = {
  id: string;
  table: QueuedTable;
  kind: "insert" | "update" | "delete";
  values?: Record<string, unknown>;
  /** Row id the update/delete targets. */
  rowId?: string;
  createdAt: string;
};

export type FailedOp = QueuedOp & { error: string };

const KEY = "poolside-offline-queue-v1";
const FAILED_KEY = "poolside-offline-failed-v1";

type State = { pending: QueuedOp[]; failed: FailedOp[]; syncing: boolean };
let state: State = { pending: [], failed: [], syncing: false };
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    state = {
      pending: JSON.parse(localStorage.getItem(KEY) ?? "[]"),
      failed: JSON.parse(localStorage.getItem(FAILED_KEY) ?? "[]"),
      syncing: false,
    };
  } catch {
    state = { pending: [], failed: [], syncing: false };
  }
}

function commit(next: Partial<State>) {
  state = { ...state, ...next };
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(state.pending));
    localStorage.setItem(FAILED_KEY, JSON.stringify(state.failed));
  }
  listeners.forEach((l) => l());
}

export function subscribeQueue(fn: () => void) {
  load();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getQueueState(): State {
  load();
  return state;
}

const SERVER_STATE: State = { pending: [], failed: [], syncing: false };
export function getServerQueueState(): State {
  return SERVER_STATE;
}

export function dismissFailed() {
  commit({ failed: [] });
}

export function newId(): string {
  return crypto.randomUUID();
}

/** True when the error means "couldn't reach the server" rather than "server said no". */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String((e as { message?: unknown })?.message ?? e ?? "");
  return (
    e instanceof TypeError ||
    /failed to fetch|network ?error|load failed|networkerror|fetch failed/i.test(msg)
  );
}

async function execute(op: QueuedOp) {
  // The tables are narrowed at call sites; the generic client needs a loose cast here.
  const table = supabase.from(op.table) as unknown as {
    insert: (v: unknown) => PromiseLike<{ error: unknown }>;
    update: (v: unknown) => { eq: (c: string, v: string) => PromiseLike<{ error: unknown }> };
    delete: () => { eq: (c: string, v: string) => PromiseLike<{ error: unknown }> };
  };
  let res: { error: unknown };
  if (op.kind === "insert") res = await table.insert(op.values);
  else if (op.kind === "update") res = await table.update(op.values).eq("id", op.rowId!);
  else res = await table.delete().eq("id", op.rowId!);
  if (res.error) throw res.error;
}

/**
 * Run a write now when possible, otherwise save it for later.
 * Returns `queued: true` when it was saved on the device.
 * Writes are also queued while older ones are still waiting, so order is preserved.
 */
export async function runWrite(
  op: Omit<QueuedOp, "id" | "createdAt">,
): Promise<{ queued: boolean }> {
  load();
  const full: QueuedOp = { ...op, id: newId(), createdAt: new Date().toISOString() };
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  if (offline || state.pending.length > 0) {
    commit({ pending: [...state.pending, full] });
    if (!offline) void flushQueue();
    return { queued: true };
  }
  try {
    await execute(full);
    return { queued: false };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    commit({ pending: [...state.pending, full] });
    return { queued: true };
  }
}

let flushing: Promise<number> | null = null;

/** Send saved writes in order. Resolves with how many were sent. */
export function flushQueue(): Promise<number> {
  load();
  if (flushing) return flushing;
  if (state.pending.length === 0) return Promise.resolve(0);
  flushing = (async () => {
    commit({ syncing: true });
    let sent = 0;
    try {
      while (state.pending.length > 0) {
        const op = state.pending[0]!;
        try {
          await execute(op);
          sent++;
          commit({ pending: state.pending.slice(1) });
        } catch (e) {
          if (isNetworkError(e)) break; // still no signal; try again later
          const message = String((e as { message?: unknown })?.message ?? e);
          commit({
            pending: state.pending.slice(1),
            failed: [...state.failed, { ...op, error: message }],
          });
        }
      }
    } finally {
      commit({ syncing: false });
      flushing = null;
    }
    return sent;
  })();
  return flushing;
}
