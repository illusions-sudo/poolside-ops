import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import {
  dismissFailed,
  flushQueue,
  getQueueState,
  getServerQueueState,
  subscribeQueue,
} from "@/lib/offline-queue";

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** Sends saved visit work when the signal returns, and shows offline status. */
export function OfflineSync() {
  const queryClient = useQueryClient();
  const online = useOnline();
  const q = useSyncExternalStore(subscribeQueue, getQueueState, getServerQueueState);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    const run = async () => {
      const sent = await flushQueue();
      if (cancelled) return;
      if (sent > 0) {
        toast.success(`Synced ${sent} saved change${sent === 1 ? "" : "s"}.`);
        await queryClient.invalidateQueries();
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [online, queryClient]);

  // Warm the page cache for the field screens so they open with no signal.
  useEffect(() => {
    if (!online || !("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
    for (const path of ["/my-day", "/dashboard", "/schedule", "/routes"]) {
      void fetch(path, { headers: { accept: "text/html" }, credentials: "same-origin" }).catch(
        () => undefined,
      );
    }
  }, [online]);

  const pending = q.pending.length;

  if (online && pending === 0 && q.failed.length === 0) return null;

  return (
    <div className="no-print space-y-2 px-4 pt-3 sm:px-6">
      {!online || pending > 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {!online ? (
            <CloudOff className="size-4 shrink-0 text-muted-foreground" />
          ) : q.syncing ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          ) : (
            <RefreshCw className="size-4 shrink-0 text-primary" />
          )}
          <span className="min-w-0 flex-1">
            {!online ? "You're offline. Visit work is saved on this phone" : "Back online"}
            {pending > 0
              ? ` — ${pending} change${pending === 1 ? "" : "s"} waiting to sync.`
              : !online
                ? " and will sync when you have signal."
                : "."}
          </span>
          {online && pending > 0 && !q.syncing ? (
            <button
              className="text-xs font-medium text-primary"
              onClick={() => void flushQueue().then(() => queryClient.invalidateQueries())}
            >
              Sync now
            </button>
          ) : null}
        </div>
      ) : null}
      {q.failed.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1">
            {q.failed.length} offline change{q.failed.length === 1 ? "" : "s"} couldn't be saved
            (the visit may have been changed by someone else). Please re-check the visit.
          </span>
          <button className="text-xs font-medium" onClick={dismissFailed}>
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
