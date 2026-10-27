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
> Phone installs are manifest-only: `public/manifest.webmanifest` plus icons in
> `public/icons/` and `public/apple-touch-icon.png`, with no service worker, no
> `vite-plugin-pwa` and no offline caching. Keep it that way unless offline use
> is explicitly requested, and keep the manifest landing page pointing at the
> signed-in app rather than the marketing page.
<!-- LOVABLE:END:AGENTS -->
