// The only place the offline service worker is registered.
// It never runs in development, inside the editor preview, or in an iframe.
const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;
const PREVIEW_SUFFIXES = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"];

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  const host = window.location.hostname.toLowerCase();
  const label = host.split(".")[0] ?? "";
  if (PREVIEW_SUFFIXES.some((s) => host.endsWith(s))) {
    if (PREVIEW_LABEL.test(label)) return true;
    if (/^project--[a-z0-9-]+-dev$/.test(label)) return true;
  }
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterAppWorkers() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) =>
        [r.active, r.waiting, r.installing].some((w) => w?.scriptURL.endsWith("/sw.js")),
      )
      .map((r) => r.unregister()),
  );
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    if (isRefusedContext()) {
      await unregisterAppWorkers();
      return;
    }
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
  } catch (e) {
    console.warn("Offline mode unavailable", e);
  }
}
