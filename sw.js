// EvoBible service worker.
//
// Strategy:
//   - Precache the app shell on install so the Bible can be read offline.
//   - Navigation requests are answered with the cached index.html
//     (the app is a single page; query string and hash are ignored).
//   - Other same-origin GET requests use stale-while-revalidate.
//   - Cross-origin requests (for example the Supabase function) are not
//     handled here at all, so they pass through untouched.
//
// Bump VERSION whenever the site files change so that devices download
// a fresh cache and drop the old one.

const VERSION = "v23";
const CACHE = "evobible-" + VERSION;

const PRECACHE = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "engine-core.js",
  "engine.js",
  "data.js",
  "manifest.webmanifest",
  "fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  "fonts/source-serif-4-latin-wght-normal.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon.svg"
];

// Salinan bersih: respons hasil pengalihan (redirect) tidak boleh dipakai untuk membuka halaman,
// jika dipakai browser menampilkan ERR_FAILED. Jadi dibuat ulang tanpa tanda pengalihan.
async function clean(r) {
  if (!r.redirected) return r;
  return new Response(await r.blob(), { status: 200, statusText: "OK", headers: r.headers });
}

// Install: simpan kerangka aplikasi, lalu aktifkan worker ini segera.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        PRECACHE.map(async (url) => {
          const r = await fetch(url, { cache: "reload" });
          if (!r.ok) throw new Error("precache gagal: " + url);
          await cache.put(url, await clean(r));
        })
      );
      await self.skipWaiting();
    })
  );
});

// Activate: remove old EvoBible caches, then take control of open pages.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("evobible-") && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: route only same-origin GET requests; leave everything else alone.
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  var p = new URL(request.url).pathname;
  if (/\/(data|engine)\.js$|\/fonts\/|\/icons\//.test(p)) {
    event.respondWith(caches.open(CACHE).then((c) => c.match(request).then((hit) => hit || fetch(request).then((r) => { if (r.ok) c.put(request, r.clone()); return r; }))));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, event));
});

// Serve the cached app shell for page navigations, falling back to the network.
async function handleNavigation(request) {
  const cache = await caches.open(CACHE);
  const cached = (await cache.match("index.html", { ignoreSearch: true })) || (await cache.match("./", { ignoreSearch: true }));
  if (cached) return clean(cached);
  try {
    return await clean(await fetch(request));
  } catch (e) {
    return new Response("Tidak ada koneksi. Buka lagi saat internet tersedia.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

// Return the cached copy at once and refresh it in the background.
// With nothing cached, go to the network and cache the result if it is ok.
function staleWhileRevalidate(request, event) {
  return caches.open(CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          return cache.put(request, response.clone()).then(() => response);
        }
        return response;
      });

      if (cached) {
        // Keep the worker alive until the background refresh has finished.
        // A failed refresh is ignored; the cached copy is still served.
        event.waitUntil(network.then(() => undefined, () => undefined));
        return cached;
      }

      return network.catch(() => Response.error());
    })
  );
}

// Allow the page to ask a waiting worker to activate immediately.
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
