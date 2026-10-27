<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

<!-- LOVABLE:BEGIN:AGENTS -->
> [!IMPORTANT]
> Offline mode uses `vite-plugin-pwa` (generateSW, output `dist/client/sw.js`) registered only from
> `src/lib/register-sw.ts`, which refuses dev/preview/iframe hosts; pages are NetworkFirst, never
> cache-first. Keep the manifest landing page pointing at the signed-in app.
> Field (visit) writes go through `runWrite` in `src/lib/offline-queue.ts` so they queue on the device
> when offline and replay in order; patch the React Query cache after queuing so the change shows.
> Query data is persisted to localStorage via PersistQueryClientProvider in `__root.tsx`.
> Photo uploads still require a connection.
<!-- LOVABLE:END:AGENTS -->

Customer/property permanent deletion uses guarded database RPCs and DELETE triggers, with shared lifecycle controls; invoice-linked records remain inactive to prevent cascading loss of financial history.

Sortable list pages order rows client-side with a pure comparator module under `src/lib` and the shared
`SortableTh` header (see `src/lib/customer-sort.ts`), so sorting works offline and exports follow the
on-screen order; the chosen sort is saved per page in localStorage and restored after hydration.
