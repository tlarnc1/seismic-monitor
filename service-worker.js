const CACHE_NAME = 'seismic-monitor-v6-7-0-assets'; // キャッシュ名を更新してリロード時に反映されるようにします
const ASSETS_TO_CACHE = [
    // メインファイル
    './SeismicMonitor_v6.7.0.html',
    './manifest.json',

    // ローカルアセット（画像・アイコン）
    './icon-192.png',
    './icon-512.png',
    // './shingen.png', // もし震源アイコン画像を使用している場合はコメントアウトを外してください

    // ローカルアセット（音声）
    './forecast.mp3',
    './warning.mp3',
    './update.mp3',
    
    // 外部ライブラリ (CDN)
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    
    // フォント
    'https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap',
    'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap'
];

// インストール処理
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // ファイルが1つでも欠けているとインストールが失敗してしまうのを防ぐため、
            // 万が一ファイルが見つからなくてもエラーをログに出して続行するようにしています。
            return cache.addAll(ASSETS_TO_CACHE).catch(err => console.warn('Some assets could not be cached:', err));
        })
    );
});

// アクティブ化処理（古いキャッシュの削除）
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// フェッチ処理
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. 地震データAPI (WolfX, P2PQuake) -> 常にネットワークから取得（キャッシュしない）
    if (url.hostname.includes('wolfx.jp') || url.hostname.includes('p2pquake.net')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 2. 地図タイル (OpenStreetMap) や Nominatim API -> キャッシュ優先
    if (url.hostname.includes('openstreetmap.org')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        // オフライン時のフォールバックなど
                    });
                });
            })
        );
        return;
    }

    // 3. その他の静的アセット -> キャッシュ優先
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
