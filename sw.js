// 한글 놀이 PWA 서비스워커
// 캐시 버전을 올리면 이전 캐시를 정리하고 새 자산을 받습니다.
const CACHE = "hangul-play-v1";

// 오프라인에서도 동작하도록 미리 담아둘 앱 기본 파일들
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./game.js",
  "./logo.png",
  "./manifest.webmanifest",
  "./images/towel.png",
  "./images/duvet.png",
  "./images/button.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// stale-while-revalidate: 캐시가 있으면 바로 보여주고, 뒤에서 최신본을 받아 캐시를 갱신
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
