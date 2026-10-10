/* App-shell caching only. Never cache financial API responses, authentication tokens or exported receipts. */
const NAME='fueltill-shell-v1.1';
const PRECACHE=['/','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(NAME).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fueltill-shell-')&&k!==NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/__/')||url.pathname.startsWith('/api/'))return;
 // For navigation, prefer fresh deployed code; use cached shell only when offline.
 if(req.mode==='navigate'){event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(NAME).then(c=>c.put('/',copy))}return res}).catch(()=>caches.match('/')));return}
 if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/icons/')||url.pathname==='/manifest.webmanifest'){
   event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(NAME).then(c=>c.put(req,copy))}return res})))
 }
});
