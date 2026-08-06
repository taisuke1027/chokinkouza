/**
 * service-worker.js
 * ------------------------------------------------------------------
 * オフラインでも基本機能（運動記録・資産確認）が使えるように、
 * アプリシェルとローカルアセットをキャッシュする（33章 ⑤）。
 * データそのものはlocalStorageに保存されるため、通信状況に
 * 左右されない。
 * ------------------------------------------------------------------
 */

const CACHE_VERSION = "chikutate-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/data/config.js",
  "./js/data/exercises.js",
  "./js/data/tips.js",
  "./js/data/praises.js",
  "./js/data/mascot.js",
  "./js/data/models.js",
  "./js/data/storage.js",
  "./js/engine/cardioCalculator.js",
  "./js/engine/strengthCalculator.js",
  "./js/engine/enduranceCalculator.js",
  "./js/engine/decayCalculator.js",
  "./js/engine/habitCalculator.js",
  "./js/engine/bptCalculator.js",
  "./js/engine/seasonManager.js",
  "./js/ui/format.js",
  "./js/ui/icons.js",
  "./js/ui/chart.js",
  "./js/ui/picker.js",
  "./js/ui/confirm.js",
  "./js/ui/home.js",
  "./js/ui/bptInfo.js",
  "./js/ui/pressureInfo.js",
  "./js/ui/habitInfo.js",
  "./js/ui/record.js",
  "./js/ui/exercisePicker.js",
  "./js/ui/template.js",
  "./js/ui/result.js",
  "./js/ui/edit.js",
  "./js/ui/asset.js",
  "./js/ui/ledger.js",
  "./js/ui/seasons.js",
  "./js/ui/science.js",
  "./js/ui/more.js",
  "./js/ui/router.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/ranks/bronze.png",
  "./icons/ranks/silver.png",
  "./icons/ranks/gold.png",
  "./icons/ranks/platinum.png",
  "./icons/ranks/legend.png",
  "./icons/mascot/normal.png",
  "./icons/mascot/joy.png",
  "./icons/mascot/motivated.png",
  "./icons/mascot/tehepero.png",
  "./icons/mascot/body_jump.png",
  "./icons/mascot/body_guts.png",
  "./icons/mascot/run/run_01.png",
  "./icons/mascot/run/run_02.png",
  "./icons/mascot/run/run_03.png",
  "./icons/mascot/run/run_04.png",
  "./icons/mascot/run/run_05.png",
  "./icons/mascot/run/run_06.png",
  "./icons/mascot/run/run_07.png",
  "./icons/mascot/run/run_08.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Google Fonts等の外部リソースはネットワーク優先＋キャッシュフォールバック
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // アプリシェル: キャッシュ優先（オフライン確実性重視）
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, resClone));
          return res;
        }).catch(() => cached);
      })
    );
  } else {
    // 外部リソース: ネットワーク優先、失敗時はキャッシュ
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, resClone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
