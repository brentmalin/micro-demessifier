const CACHE="micro-demessifier-v7-move-any-item";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./apple-touch-icon.png","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("micro-demessifier-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin){return}
  e.respondWith(fetch(e.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(e.request,copy));
    return response;
  }).catch(()=>caches.match(e.request)));
});
