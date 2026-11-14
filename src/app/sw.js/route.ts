import { publicEnv } from "@/lib/public-env";

/**
 * The service worker, served from a route so each build gets a new version
 * string (which is how the browser notices an update).
 *
 * Caching is deliberately conservative:
 *   ✔ cached      the offline page, app icons, and Next.js build assets
 *                 (/_next/static — public, content-hashed, identical for everyone)
 *   ✘ never cached  pages, React Server Component payloads, Server Actions,
 *                 API routes, Supabase requests, signed document URLs —
 *                 i.e. anything that can contain a tenant's or owner's data.
 *
 * Nothing is queued for later either: if the network is down, a save simply
 * fails and the app says so. The user is never told something was saved when
 * the server did not confirm it.
 */
const source = (version: string) => `
const VERSION = ${JSON.stringify(version)};
const SHELL = "hm-shell-" + VERSION;
const ASSETS = "hm-assets-" + VERSION;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
  // no skipWaiting here: the page asks for it when the user taps "Refresh"
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("hm-") && k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: always the network. Offline → the generic offline page.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline").then((r) => r || Response.error())));
    return;
  }

  // Build assets: immutable and public → cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(ASSETS).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res.ok && res.type === "basic") cache.put(req, res.clone());
          return res;
        }))
      )
    );
  }
  // everything else: untouched (straight to the network, never stored)
});
`;

export async function GET() {
  return new Response(source(publicEnv.buildId), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
