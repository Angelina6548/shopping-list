const CACHE='shopping-v1';
const sdk='https://www.gstatic.com/firebasejs/13.4.0/';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./style.css','./app.js','./manifest.webmanifest',sdk+'firebase-app.js',sdk+'firebase-auth.js',sdk+'firebase-firestore.js'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||!(u.origin===self.location.origin||u.href.startsWith(sdk)))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request)));});
