// Guarda os arquivos do app no celular para abrir sem internet.
// Ao publicar uma nova versão, aumente o número abaixo.
const VERSAO = 'lili-bolos-v4';
const ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/nav.js', 'js/db.js', 'js/calc.js', 'js/ui.js', 'js/pdf.js',
  'js/telas/inicio.js', 'js/telas/config.js', 'js/telas/insumos.js', 'js/telas/receitas.js',
  'js/telas/orcamentos.js', 'js/telas/agenda.js', 'js/telas/clientes.js', 'js/telas/financeiro.js',
  'js/telas/ranking.js', 'js/telas/ofertas.js',
  'img/logo.webp', 'img/icon-192.png', 'img/icon-512.png', 'img/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    // Apaga só versões antigas da LiLi Bolos; nunca mexe em arquivos de outros apps do mesmo endereço
    .then(nomes => Promise.all(nomes.filter(n => n.startsWith('lili-bolos-') && n !== VERSAO).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Responde rápido com o que está guardado e atualiza em segundo plano quando houver internet
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSAO).then(async cache => {
    const guardado = await cache.match(req, { ignoreSearch: true });
    const daRede = fetch(req).then(resp => {
      if (resp.ok) cache.put(req, resp.clone());
      return resp;
    }).catch(() => guardado);
    return guardado || daRede;
  }));
});
