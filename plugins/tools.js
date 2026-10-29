const crypto = require('crypto');
const axios = require('axios');
const U = require('../lib/utils');
const S = require('../lib/services');

const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'tools', run });

const HTTP = { 100: 'Continue', 101: 'Switching Protocols', 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 206: 'Partial Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 418: "I'm a teapot ☕", 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };

const list = [
  mk('calc', 'Calculadora', '<2+2*5>', ({ q, reply }) => {
    if (!q) return reply('🧮 Ejemplo: .calc 2+2*5');
    if (!/^[\d+\-*/().,%\s^x]+$/i.test(q)) return reply('❌ Solo números y + - * / ^ % ( )');
    const expr = q.replace(/,/g, '.').replace(/\^/g, '**').replace(/x/gi, '*');
    let r;
    try { r = Function(`"use strict";return (${expr})`)(); } catch { return reply('❌ Expresión inválida. Ejemplo: .calc 2+2*5'); }
    if (!isFinite(r)) return reply('❌ Resultado inválido');
    reply(`🧮 ${q} = *${r}*`);
  }, ['calcular']),

  mk('qr', 'Genera un código QR', '<texto o enlace>', ({ q, sendImage, reply }) =>
    q ? sendImage(S.qrUrl(q), '✅ Tu QR') : reply('Ejemplo: .qr https://google.com')),

  mk('barcode', 'Genera un código de barras', '<texto o número>', ({ q, sendImage, reply }) =>
    q ? sendImage(S.barcodeUrl(q), '✅ Código de barras') : reply('Ejemplo: .barcode 123456789'), ['codigobarras']),

  mk('acortar', 'Acorta un enlace', '<url>', async ({ q, reply }) => {
    if (!U.isUrl(q)) return reply('Ejemplo: .acortar https://sitio.com/muy/largo');
    reply(`🔗 ${await S.shorten(q)}`);
  }, ['short', 'shorten']),

  mk('ip', 'Información de una IP o dominio', '<ip>', async ({ q, reply }) => {
    if (!q) return reply('Ejemplo: .ip 8.8.8.8');
    const d = await S.ipInfo(q);
    if (d.status !== 'success') return reply('❌ No encontrado');
    reply(`🌐 *${d.query}*\n📍 ${d.city}, ${d.regionName}, ${d.country}\n🏢 ${d.isp}\n🕒 ${d.timezone}\n🗺️ ${d.lat}, ${d.lon}`);
  }),

  mk('dns', 'Registros DNS (A) de un dominio', '<dominio>', async ({ q, reply }) => {
    if (!q) return reply('Ejemplo: .dns google.com');
    const r = await S.dns(q);
    reply(r.length ? `🌐 *${q}*\n` + r.map((a) => `• ${a}`).join('\n') : '❌ Sin registros');
  }),

  mk('dnsmx', 'Registros MX (correo) de un dominio', '<dominio>', async ({ q, reply }) => {
    if (!q) return reply('Ejemplo: .dnsmx gmail.com');
    const r = await S.dns(q, 'MX');
    reply(r.length ? `📧 *${q}*\n` + r.map((a) => `• ${a}`).join('\n') : '❌ Sin registros');
  }),

  mk('dnstxt', 'Registros TXT de un dominio', '<dominio>', async ({ q, reply }) => {
    if (!q) return reply('Ejemplo: .dnstxt google.com');
    const r = await S.dns(q, 'TXT');
    reply(r.length ? `📝 *${q}*\n` + r.map((a) => `• ${a}`).join('\n').slice(0, 3000) : '❌ Sin registros');
  }),

  mk('github', 'Perfil de GitHub', '<usuario>', async ({ q, reply, sendImage }) => {
    if (!q) return reply('Ejemplo: .github torvalds');
    const d = await S.github(q);
    sendImage(d.avatar_url, `🐙 *${d.login}*\n${d.name || ''}\n${d.bio || ''}\n📦 Repos: ${d.public_repos}\n👥 Seguidores: ${d.followers}\n🔗 ${d.html_url}`);
  }, ['gh']),

  mk('npm', 'Información de un paquete npm', '<paquete>', async ({ q, reply }) => {
    if (!q) return reply('Ejemplo: .npm axios');
    const d = await S.npmInfo(q);
    reply(`📦 *${d.name}* v${d.version}\n${d.description || ''}\n🔗 https://npmjs.com/package/${d.name}`);
  }),

  mk('tts', 'Texto a voz', '[idioma] <texto>', async ({ args, quotedText, reply, sendAudio }) => {
    const lang = args[0] && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(args[0]) && args.length > 1 ? args.shift() : 'es';
    const text = (args.join(' ') || quotedText).slice(0, 200);
    if (!text) return reply('Ejemplo: .tts hola mundo   |   .tts en hello world');
    const buf = await U.getBuffer(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`);
    await sendAudio(buf, false);
  }, ['voz']),

  mk('ssweb', 'Captura de pantalla de una web', '<url>', ({ q, sendImage, reply }) => {
    if (!U.isPublicUrl(q)) return reply('Ejemplo: .ssweb https://google.com');
    return sendImage(`https://image.thum.io/get/width/1280/crop/800/noanimate/${q}`, `📸 ${q}`);
  }, ['ss', 'screenshot']),

  mk('hora', 'Hora en una zona horaria', '[Zona/Ciudad]', ({ q, reply }) => {
    const tz = q || 'America/Caracas';
    try {
      reply(`🕒 *${tz}*\n${new Date().toLocaleString('es-VE', { timeZone: tz, dateStyle: 'full', timeStyle: 'medium' })}`);
    } catch {
      reply('❌ Zona inválida. Ejemplo: .hora America/Mexico_City');
    }
  }, ['time']),

  mk('color', 'Información de un color HEX', '<#ff00aa>', ({ q, reply, sendImage }) => {
    const hex = (q || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return reply('Ejemplo: .color #00e5ff');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return sendImage(`https://singlecolorimage.com/get/${hex}/300x300`, `🎨 #${hex.toUpperCase()}\nRGB: ${r}, ${g}, ${b}`);
  }),

  mk('colorrandom', 'Color al azar', '', ({ sendImage }) => {
    const hex = crypto.randomBytes(3).toString('hex');
    return sendImage(`https://singlecolorimage.com/get/${hex}/300x300`, `🎨 #${hex.toUpperCase()}`);
  }),

  mk('pass', 'Genera una contraseña segura', '[longitud]', ({ args, reply }) => {
    const n = U.clamp(parseInt(args[0]) || 14, 6, 64);
    const set = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?';
    reply('🔐 ' + Array.from({ length: n }, () => set[crypto.randomInt(set.length)]).join(''));
  }, ['password']),

  mk('passcheck', 'Evalúa la fuerza de una contraseña', '<contraseña>', ({ q, reply }) => {
    if (!q) return reply('Ejemplo: .passcheck MiClave123');
    let s = 0;
    if (q.length >= 8) s++;
    if (q.length >= 12) s++;
    if (/[a-z]/.test(q) && /[A-Z]/.test(q)) s++;
    if (/\d/.test(q)) s++;
    if (/[^A-Za-z0-9]/.test(q)) s++;
    reply(`🔐 Fuerza: *${['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte', 'Muy fuerte'][s]}* (${s}/5)\n⚠️ Borra este mensaje, no compartas tus claves reales.`);
  }),

  mk('uuid', 'Genera un UUID', '', ({ reply }) => reply(`🆔 ${crypto.randomUUID()}`)),

  mk('timestamp', 'Fecha ↔ timestamp Unix', '[número]', ({ args, reply }) => {
    if (args[0] && !isNaN(+args[0])) {
      const n = +args[0] > 1e11 ? +args[0] : +args[0] * 1000;
      return reply(`🕒 ${new Date(n).toISOString()}`);
    }
    reply(`🕒 Ahora: *${Math.floor(Date.now() / 1000)}*`);
  }, ['unix']),

  mk('b64', 'Codifica en Base64', '<texto>', ({ q, reply }) => reply(q ? Buffer.from(q).toString('base64') : 'Escribe un texto')),
  mk('unb64', 'Decodifica Base64', '<texto>', ({ q, reply }) => reply(q ? Buffer.from(q, 'base64').toString('utf8') : 'Escribe un texto')),

  mk('lorem', 'Texto de relleno', '[palabras]', ({ args, reply }) => {
    const w = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
    reply(Array.from({ length: U.clamp(parseInt(args[0]) || 30, 1, 200) }, () => U.pick(w)).join(' ') + '.');
  }),

  mk('httpstatus', 'Significado de un código HTTP', '<código>', ({ args, reply }) => {
    const c = parseInt(args[0]);
    reply(HTTP[c] ? `🌐 *${c}* — ${HTTP[c]}` : '❌ Código desconocido. Ejemplo: .httpstatus 404');
  }, ['http']),

  mk('checkurl', 'Comprueba si una web responde y en cuánto tiempo', '<url>', async ({ q, reply }) => {
    if (!U.isPublicUrl(q)) return reply('Ejemplo: .checkurl https://google.com');
    const t = Date.now();
    try {
      const r = await axios.get(q, { timeout: 15000, validateStatus: () => true, maxContentLength: 2_000_000, responseType: 'stream' });
      r.data.destroy();
      reply(`🌐 ${q}\n${r.status < 400 ? '✅ En línea' : '⚠️ Responde con error'}\n📟 Estado: ${r.status} ${HTTP[r.status] || ''}\n⏱️ ${Date.now() - t} ms`);
    } catch (e) {
      reply(`🌐 ${q}\n❌ No responde (${e.code || e.message})`);
    }
  }, ['webup']),

  mk('headers', 'Cabeceras HTTP de una web', '<url>', async ({ q, reply }) => {
    if (!U.isPublicUrl(q)) return reply('Ejemplo: .headers https://google.com');
    const r = await axios.head(q, { timeout: 15000, validateStatus: () => true });
    reply(`📋 *${q}* (${r.status})\n` + Object.entries(r.headers).slice(0, 18).map(([k, v]) => `• ${k}: ${String(v).slice(0, 80)}`).join('\n'));
  }),

  mk('avatar', 'Avatar generado a partir de un nombre', '[estilo] <nombre>', ({ args, sendImage, reply }) => {
    const styles = ['avataaars', 'bottts', 'pixel-art', 'adventurer', 'lorelei', 'fun-emoji', 'identicon', 'micah', 'notionists', 'thumbs'];
    const style = styles.includes(args[0]) ? args.shift() : 'avataaars';
    const seed = args.join(' ');
    if (!seed) return reply(`Ejemplo: .avatar sharky\nEstilos: ${styles.join(', ')}`);
    return sendImage(S.avatarUrl(style, seed), `🧑 ${style}: ${seed}`);
  }),

  mk('robohash', 'Robot generado a partir de un nombre', '<nombre>', ({ q, sendImage, reply }) =>
    q ? sendImage(S.robohashUrl(q), `🤖 ${q}`) : reply('Ejemplo: .robohash sharky')),

  mk('placeholder', 'Imagen de relleno con texto', '<texto>', ({ q, sendImage, reply }) =>
    q ? sendImage(`https://placehold.co/800x450/png?text=${encodeURIComponent(q)}`, '🖼️') : reply('Ejemplo: .placeholder Hola')),

  mk('creameme', 'Crea un meme con tu texto', '<plantilla> texto arriba | texto abajo', ({ args, reply, sendImage }) => {
    const tpl = args.shift();
    const [top, bottom] = args.join(' ').split('|').map((x) => x.trim());
    if (!tpl || !top) return reply('Ejemplo: .creameme drake estudiar | dormir\nPlantillas: .memelist');
    return sendImage(S.memeUrl(tpl, top, bottom || ''), '😂');
  }, ['memegen']),

  mk('memelist', 'Plantillas disponibles para .creameme', '', ({ reply }) =>
    reply('😂 Plantillas: drake, doge, fry, buzz, success, cat, disastergirl, ds (botones), gru, rollsafe, spongebob, sad-biden, mordor, philosoraptor, wonka, yuno, fine, bad, awesome, spiderman, stonks, pigeon, panik-kalm-panik, db (novio distraído), kermit, same, change, toohigh, grumpycat'), ['plantillas']),

  mk('cumple', 'Días que faltan para tu cumpleaños', '<día/mes>  (ej 25/12)', ({ args, reply }) => {
    const m = /^(\d{1,2})[\/-](\d{1,2})$/.exec(args[0] || '');
    if (!m) return reply('Ejemplo: .cumple 25/12');
    const now = new Date();
    let t = new Date(now.getFullYear(), +m[2] - 1, +m[1]);
    if (t < new Date(now.getFullYear(), now.getMonth(), now.getDate())) t = new Date(now.getFullYear() + 1, +m[2] - 1, +m[1]);
    const d = Math.round((t - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    reply(d === 0 ? '🎂 ¡Hoy es tu cumpleaños! 🎉' : `🎂 Faltan *${d}* días para tu cumpleaños.`);
  }),
];

// ── Hashes ──
for (const algo of ['md5', 'sha1', 'sha256', 'sha512']) {
  list.push(mk(algo, `Hash ${algo.toUpperCase()}`, '<texto>', ({ q, reply }) =>
    reply(q ? `🔒 ${algo.toUpperCase()}:\n${crypto.createHash(algo).update(q).digest('hex')}` : 'Escribe un texto')));
}

// ── Traductores rápidos: .aingles hola → hello ──
const LANGS = { espanol: 'es', ingles: 'en', frances: 'fr', portugues: 'pt', italiano: 'it', aleman: 'de', japones: 'ja', coreano: 'ko', chino: 'zh', ruso: 'ru', arabe: 'ar', turco: 'tr', holandes: 'nl', polaco: 'pl', hindi: 'hi', latin: 'la', catalan: 'ca', sueco: 'sv' };
list.push(mk('traducir', 'Traduce un texto (código de idioma + texto)', '<idioma> <texto>', async ({ args, quotedText, reply }) => {
  const to = args[0] && args[0].length <= 5 && args.length > 1 ? args.shift().toLowerCase() : 'es';
  const text = args.join(' ') || quotedText;
  if (!text) return reply('Ejemplo: .tr en hola como estas');
  reply(`🌍 *${to}*: ${await S.translate(text, to)}`);
}, ['tr', 'translate']));
for (const [name, code] of Object.entries(LANGS)) {
  list.push(mk(`a${name}`, `Traduce al ${name}`, '<texto>', async ({ q, quotedText, reply }) => {
    const text = q || quotedText;
    if (!text) return reply(`Ejemplo: .a${name} buenos días`);
    reply(`🌍 ${await S.translate(text, code)}`);
  }));
}

module.exports = list;
