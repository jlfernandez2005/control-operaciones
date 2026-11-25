const CACHE='ctrl-ops-v3.6.3';
const ASSETS=['/','/index.html','/app.js','/app-core.js','/finance-core.js','/finance-ui.js','/budget-ui.js','/icons/sisfia-mark.png','/icons/sisfia-logo-full.png','/favicon.ico','/icons/icon-32.png','/styles.css','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ctrl-ops-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 if(u.pathname.startsWith('/api/'))return;
 if(!ASSETS.includes(u.pathname)&&e.request.mode!=='navigate')return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request.mode==='navigate'?'/':e.request,copy)));}return r;}).catch(async()=>await caches.match(e.request.mode==='navigate'?'/':e.request)||new Response('Sin conexión',{status:503})));
});
