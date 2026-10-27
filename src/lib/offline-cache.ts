import type { QueryClient } from "@tanstack/react-query";

/** Apply a visit change to the screens already on the phone, so it shows right away. */
export function patchServiceCache(
  queryClient: QueryClient,
  serviceId: string,
  patch: Record<string, unknown>,
) {
  queryClient.setQueryData(["service", serviceId], (old: Record<string, unknown> | null | undefined) =>
    old ? { ...old, ...patch } : old,
  );
  queryClient.setQueriesData(
    { queryKey: ["my-day"] },
    (old: { list: { id: string }[]; notes: string | null } | undefined) =>
      old
        ? { ...old, list: old.list.map((s) => (s.id === serviceId ? { ...s, ...patch } : s)) }
        : old,
  );
}
