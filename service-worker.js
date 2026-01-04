const CACHE_NAME = 'seismic-monitor-v6-7-0';
const ASSETS_TO_CACHE = [
    './index.html', // メインHTML
    './manifest.json',              // マニフェストファイル
    
    // 外部ライブラリ (CDN)
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    
    // フォント
    'https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap',
    'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap',
    
    // アイコン・画像（もしローカルにあれば）
    // './icon-192.png',
    // './icon-512.png',
    // './shingen.png'
];

// インストール処理：指定したファイルをキャッシュに保存
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // 一部のファイルが見つからなくてもインストールを完了させるために catch でエラーを握りつぶす
            // (ローカル画像などがない場合でもアプリ自体は動くようにするため)
            return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Cache addAll warning:', err));
        })
    );
});

// アクティブ化処理：古いバージョンのキャッシュを削除
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

// フェッチ処理：通信への割り込み
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. 地震データAPI (WolfX, P2PQuake) -> 常にネットワークから取得（キャッシュしない）
    // リアルタイム性が命なので、キャッシュから返してはいけない
    if (url.hostname.includes('wolfx.jp') || url.hostname.includes('p2pquake.net')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 2. 地図タイル (OpenStreetMap) や Nominatim API -> キャッシュ優先
    // 変更頻度が低く、同じ画像を何度も読み込むためキャッシュを活用する
    if (url.hostname.includes('openstreetmap.org')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // キャッシュになければネットワークから取得してキャッシュに保存
                    return fetch(event.request).then((networkResponse) => {
                        // 正常なレスポンスのみキャッシュ
                        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        // オフラインなどで失敗した場合（地図が出ないだけなので何もしないか、プレースホルダーを返す）
                    });
                });
            })
        );
        return;
    }

    // 3. その他の静的アセット（HTML, CSS, JS） -> キャッシュ優先
    event.respondWith(
        caches.match(event.request).then((response) => {
            // キャッシュにあればそれを返す、なければネットワークへ
            return response || fetch(event.request);
        })
    );
});
