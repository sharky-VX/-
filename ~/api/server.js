// ═══════════════════════════════════════════════
//  API REST propia — misma lógica que usa el bot.
//  Todas las rutas (menos /api/ping y /api/commands) piden ?key=TU_CLAVE
//
//  /api/ping                          /api/commands
//  /api/ai?q=hola                     /api/imagine?q=un gato astronauta&w=1024&h=1024  (devuelve imagen)
//  /api/weather?q=Caracas             /api/translate?text=hello&to=es
//  /api/wiki?q=Venezuela              /api/country?q=Chile
//  /api/pokemon?q=pikachu             /api/anime?q=naruto
//  /api/crypto?q=btc                  /api/dolar
//  /api/currency?amount=10&from=usd&to=eur
//  /api/ip?q=8.8.8.8                  /api/qr?text=hola   (redirige a la imagen)
//  /api/short?url=https://...         /api/define?q=love
//  /api/search?q=lofi                 /api/info?url=...
//  /api/download?url=...&type=mp3|mp4
// ═══════════════════════════════════════════════
const http = require('http');
const fs = require('fs');
const config = require('../config');
const yt = require('../lib/ytdlp');
const S = require('../lib/services');
const ai = require('../lib/ai');
const loader = require('../lib/loader');

function startApi() {
  if (!config.api.enabled) return;

  // Cada ruta recibe URLSearchParams y devuelve datos JSON
  const routes = {
    '/api/ai': async (q) => ({ answer: await ai.ask(need(q, 'q')) }),
    '/api/weather': async (q) => { const w = await S.weather(need(q, 'q')); return { place: w.place, current: w.current, daily: w.daily }; },
    '/api/translate': async (q) => ({ translation: await S.translate(need(q, 'text'), q.get('to') || 'es') }),
    '/api/wiki': async (q) => S.wiki(need(q, 'q'), q.get('lang') || 'es'),
    '/api/country': async (q) => S.country(need(q, 'q')),
    '/api/pokemon': async (q) => S.pokemon(need(q, 'q')),
    '/api/anime': async (q) => S.jikan('anime', need(q, 'q')),
    '/api/crypto': async (q) => S.crypto(q.get('q') || 'btc'),
    '/api/dolar': async () => S.dolar(),
    '/api/currency': async (q) => S.currency(+need(q, 'amount'), need(q, 'from'), need(q, 'to')),
    '/api/ip': async (q) => S.ipInfo(need(q, 'q')),
    '/api/short': async (q) => ({ short: await S.shorten(need(q, 'url')) }),
    '/api/define': async (q) => S.define(need(q, 'q')),
    '/api/search': async (q) => yt.search(need(q, 'q'), Math.min(+q.get('n') || 5, 15)),
    '/api/info': async (q) => yt.info(need(q, 'url')),
  };
  const need = (q, k) => {
    const v = q.get(k);
    if (!v) throw Object.assign(new Error(`Falta ?${k}=`), { code: 400 });
    return v;
  };

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://localhost');
    const q = u.searchParams;
    const json = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(obj, null, 2));
    };

    try {
      if (u.pathname === '/api/ping') return json(200, { status: true, ping: 'pong', time: Date.now(), bot: config.botName });
      if (u.pathname === '/api/commands') return json(200, { status: true, total: loader.registry.list.length, commands: loader.registry.list.map((c) => ({ name: c.name, category: c.category, desc: c.desc })) });
      if (!u.pathname.startsWith('/api/')) return json(404, { status: false, error: 'Ruta no encontrada' });
      if (q.get('key') !== config.api.key) return json(401, { status: false, error: 'API key inválida' });

      if (routes[u.pathname]) return json(200, { status: true, result: await routes[u.pathname](q) });

      if (u.pathname === '/api/qr') {
        res.writeHead(302, { Location: S.qrUrl(need(q, 'text')) });
        return res.end();
      }

      if (u.pathname === '/api/imagine') {
        const buf = await ai.image(need(q, 'q'), { width: +q.get('w') || 1024, height: +q.get('h') || 1024 });
        res.writeHead(200, { 'Content-Type': buf[0] === 0x89 ? 'image/png' : 'image/jpeg', 'Content-Length': buf.length });
        return res.end(buf);
      }

      if (u.pathname === '/api/download') {
        const type = (q.get('type') || 'mp4').toLowerCase();
        const audio = type === 'mp3';
        const d = await yt.download(need(q, 'url'), { audio });
        res.writeHead(200, {
          'Content-Type': audio ? 'audio/mpeg' : 'video/mp4',
          'Content-Length': d.size,
          'Content-Disposition': `attachment; filename="download.${audio ? 'mp3' : 'mp4'}"`,
        });
        fs.createReadStream(d.file).pipe(res);
        res.on('close', d.cleanup);
        return;
      }

      json(404, { status: false, error: 'Endpoint no existe' });
    } catch (e) {
      json(e.code === 400 ? 400 : 500, { status: false, error: e.message });
    }
  });

  server.on('error', (e) => console.log('⚠️ API no pudo iniciar:', e.message));
  server.listen(config.api.port, config.api.host, () =>
    console.log(`🌐 API lista en http://${config.api.host}:${config.api.port}/api/ping`)
  );
}

module.exports = { startApi };
