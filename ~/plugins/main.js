const os = require('os');
const fs = require('fs');
const axios = require('axios');
const config = require('../config');
const { registry } = require('../lib/loader');
const db = require('../lib/db');
const prefixes = require('../lib/prefix');
const U = require('../lib/utils');

// ── Banner (imagen o VIDEO) ──
// El banner elegido con .setbanner se guarda aparte (db.data.banner) en una ruta que SÍ se puede escribir;
// el de fábrica (media/banner.jpg) nunca se modifica (en Termux el zip lo deja de solo lectura).
const path = require('path');
let bannerCache = null; // { buf, type }
let thumbCache = null;
const resetBanner = () => { bannerCache = null; thumbCache = null; };
const banner = (subNum) => {
  // Sub bot con banner propio
  if (subNum) {
    const sub = db.data.subbots?.[subNum];
    if (sub?.bannerFile) { try { return { buf: fs.readFileSync(sub.bannerFile), type: sub.bannerType || 'image' }; } catch {} }
  }
  if (bannerCache) return bannerCache;
  const cur = db.data.banner;
  if (cur?.file) { try { bannerCache = { buf: fs.readFileSync(cur.file), type: cur.type || 'image' }; return bannerCache; } catch {} }
  try { bannerCache = { buf: fs.readFileSync(config.banner), type: 'image' }; } catch {}
  return bannerCache;
};
// Guarda el archivo probando varias carpetas (por si alguna es de solo lectura)
function safeWrite(name, buf) {
  const dirs = [path.join(process.cwd(), 'media'), path.join(process.cwd(), 'tmp'), path.join(process.cwd(), 'data'), os.tmpdir(), os.homedir()];
  let lastErr;
  for (const d of dirs) {
    try {
      fs.mkdirSync(d, { recursive: true });
      const f = path.join(d, name);
      try { fs.unlinkSync(f); } catch {}
      fs.writeFileSync(f, buf);
      try { fs.chmodSync(f, 0o644); } catch {}
      return f;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('No pude escribir en ninguna carpeta');
}
const sniff = (b) => {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8) return 'image';
  if (b[0] === 0x89 && b.slice(1, 4).toString() === 'PNG') return 'image';
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'image';
  if (b.slice(0, 3).toString() === 'GIF') return 'gif';
  if (b.slice(4, 8).toString() === 'ftyp') return 'video';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video'; // webm / mkv
  return null;
};

const norm = (s) => U.strip(String(s || '').toLowerCase()).replace(/[^a-z0-9]/g, '');
const ALIAS = { ia: 'ai', juegos: 'games', musica: 'downloads', descargas: 'downloads', grupos: 'group', diversion: 'fun' };

// "descargas", "ia", "downloads"... → clave de categoría
function catKey(arg) {
  const a = norm(arg);
  if (!a) return null;
  if (ALIAS[a]) return ALIAS[a];
  for (const [k, v] of Object.entries(config.categories)) {
    if (norm(k) === a || norm(v.title) === a || (a.length >= 4 && norm(v.title).startsWith(a))) return k;
  }
  return null;
}

// ── Menú estilo Miku (sin emojis; se arma solo con los plugins cargados) ──
const { sans, C } = require('../lib/deco');

const LINE = '━━━━━━━━━━━━━━━━━━━━';
const SAYS = [
  'Hola, hoy canto solo para ti',
  'Que bueno verte, elige tu cancion',
  'Turquesa y puerros listos, que hacemos hoy',
  'La-la-la, el menu esta servido',
];
const catName = (c) => (config.categories[c]?.title || c);
const lastPage = new Map(); // última página del menú vista en cada chat
const byName = (a, b) => a.name.localeCompare(b.name, 'es');

// Entradas de cada categoría: orden alfabético y con su significado
function entriesOf(list, pfx, full) {
  const sorted = list.slice().sort(byName);
  if (full) {
    return sorted.map((p) => {
      const names = [p.name, ...(p.aliases || []).slice(0, 2)].map((n) => pfx + n).join(' / ');
      const usage = p.usage ? ` ${String(p.usage).replace(/\s+/g, ' ')}` : '';
      return `│ ${C.bul} *${names}*${usage}\n${p.desc ? `│    ˚ʚ ${sans(String(p.desc).slice(0, 70))} ɞ˚\n` : ''}│\n`;
    });
  }
  const lines = [];
  let line = '';
  for (const p of sorted) {
    const item = `${pfx}${p.name}`;
    if (line && (line + '  ' + item).length > 34) { lines.push(`│ ${C.bul} *${line}*\n`); line = ''; }
    line = line ? `${line}  ${item}` : item;
  }
  if (line) lines.push(`│ ${C.bul} *${line}*\n`);
  return lines;
}

function collect(only) {
  const cats = {};
  let hidden = 0;
  for (const p of registry.list) {
    if (p.hidden) { hidden++; continue; }
    (cats[p.category] ||= []).push(p);
  }
  const order = Object.keys(config.categories).filter((c) => cats[c]);
  Object.keys(cats).forEach((c) => { if (!order.includes(c)) order.push(c); });
  const pfx = prefixes.list().find(Boolean) ?? '';
  const full = config.menuDesc !== false;
  const list = order.filter((c) => !only || c === only).map((c) => ({ key: c, title: catName(c), entries: entriesOf(cats[c], pfx, full), count: cats[c].length }));
  return { list, total: registry.list.length - hidden, pfx };
}

function makeHeader(pushName, total, list, start, showIndex, subNum) {
  const subData = subNum ? (db.data.subbots?.[subNum] || {}) : {};
  const displayName = (subNum && subData.displayName) ? subData.displayName : (db.data.botName || config.botName);
  let h =
    `${C.top}\n` +
    `        ${sans(displayName.toUpperCase())}\n` +
    `${C.ftop}\n` +
    `${C.fcat}\`${sans('Informacion')}\`\n` +
    `│ ${C.bul} *${sans('Bot')}* ⟫ ${displayName}\n` +
    `│ ${C.bul} *${sans('Prefijos')}* ⟫ [ ${prefixes.list().map((p) => p || 'none').join(' ')} ]\n` +
    `│ ${C.bul} *${sans('Dueño')}* ⟫ ${config.owner.name}\n` +
    `│ ${C.bul} *${sans('Modo')}* ⟫ ${db.data.mode || config.mode}\n` +
    `│ ${C.bul} *${sans('Comandos')}* ⟫ ${total}\n` +
    `${C.fbot}\n\n` +
    `${C.quote}${sans(`Hola ${pushName || 'amig@'}, ${U.pick(SAYS).toLowerCase()}`)}`;
  if (showIndex) {
    h += `\n\n${C.ftop}\n${C.fcat}\`${sans('Indice de paginas')}\`\n`;
    for (const c of list) h += `│ ${C.bul} ${c.title.toLowerCase()} ┈┈ *${start[c.key] || 0}*\n`;
    h += `${C.fbot}\n${C.quote}${sans('Salta con')} .menu <${sans('pagina')}>`;
  }
  return h;
}

// Reparte las categorías en páginas
function layout(header, list, maxFirst, maxRest) {
  const reserve = 150; // espacio para el pie "Página x/y"
  const small = `${C.quote}${sans('Menu de Miku')}`;
  const pages = [];
  const lim = () => (pages.length === 0 ? maxFirst : maxRest) - reserve;
  const start = {};
  let cur = header + '\n\n';
  let inFrame = false;
  const openFrame = (c, cont) => {
    cur += `${C.ftop}\n${C.fcat}\`${sans(`${c.title.toLowerCase()}${cont ? ' (cont.)' : ''}`)}\`\n`;
    inFrame = true;
  };
  const closeFrame = () => { if (inFrame) { cur += `${C.fbot}\n\n`; inFrame = false; } };
  const flush = () => { closeFrame(); pages.push(cur.trimEnd()); cur = small + '\n\n'; };
  for (const c of list) {
    const need = 80 + (c.entries[0] || '').length + C.fbot.length;
    if (cur.length > small.length + 4 && cur.length + need > lim()) flush();
    start[c.key] = pages.length + 1;
    openFrame(c, false);
    for (const e of c.entries) {
      if (cur.length + e.length + C.fbot.length + 2 > lim()) { flush(); openFrame(c, true); }
      cur += e;
    }
    closeFrame();
  }
  pages.push(cur.trimEnd());
  return { pages, start };
}

// Estilo "ad": el banner va DENTRO del mensaje (miniatura incrustada) y se ve sin descargar nada.
// Estilo "foto": foto normal con el menú en el pie.
const menuStyle = () => db.data.menuStyle || config.menuStyle || 'ad';
// Página 1 = foto con el menú en el pie (límite chico). Páginas 2+ = texto normal (aguanta mucho más).
const pageSize = () => (menuStyle() === 'ad'
  ? [config.menuMaxCharsAd || 6000, config.menuMaxCharsAd || 6000]
  : [config.menuMaxChars || 2800, config.menuMaxCharsAd || 6000]);

function buildPages(pushName, only, subNum) {
  const { list, total } = collect(only);
  const [maxFirst, maxRest] = pageSize();
  const showIndex = !only;
  let start = {};
  let out = null;
  for (let i = 0; i < 4; i++) {
    const header = makeHeader(pushName, total, list, start, showIndex, subNum);
    out = layout(header, list, maxFirst, maxRest);
    if (JSON.stringify(out.start) === JSON.stringify(start)) break;
    start = out.start;
  }
  return out.pages;
}

// Miniatura liviana (640x336) para que el banner viaje dentro del mensaje
async function getThumb(subNum) {
  if (!subNum && thumbCache) return thumbCache;
  const b = banner(subNum);
  if (!b || b.type !== 'image') return null;
  try {
    const t = await require('../lib/media').imageFx(b.buf, (i) => i.cover(640, 336).quality(72), 'image/jpeg');
    if (!subNum) thumbCache = t;
    return t;
  } catch { return b.buf; }
}

async function sendMenu(sock, from, m, caption, buttons, page, total) {
  // Sub bot con nombre/banner propio
  const subNum = sock.isSub ? sock.subNumber : null;
  const subData = subNum ? (db.data.subbots?.[subNum] || {}) : {};
  const botNameDisplay = (subNum && subData.displayName) ? subData.displayName : (db.data.botName || config.menuName || 'SHARKNEX');
  const attempts = [];
  if (menuStyle() === 'ad' && banner(subNum)?.type === 'image') {
    const thumb = await getThumb(subNum);
    if (thumb) {
      const ad = { title: botNameDisplay, body: `Pagina ${page} de ${total}`, thumbnail: thumb, mediaType: 1, renderLargerThumbnail: true, showAdAttribution: false, sourceUrl: config.links.owner };
      if (buttons.length) attempts.push({ text: caption, footer: 'Miku', buttons, headerType: 1, contextInfo: { externalAdReply: ad } });
      attempts.push({ text: caption, contextInfo: { externalAdReply: ad } });
    }
  }
  const b = banner(subNum);
  if (b && page === 1) {
    if (b.type === 'video') attempts.push({ video: b.buf, caption, gifPlayback: true, mimetype: 'video/mp4' }, { video: b.buf, caption, mimetype: 'video/mp4' });
    else attempts.push({ image: b.buf, caption });
  }
  attempts.push({ text: caption });
  for (const content of attempts) {
    try { await sock.sendMessage(from, content, { quoted: m }); return; }
    catch (e) { console.error('Menú: falló un formato, pruebo el siguiente:', e?.message || e); }
  }
}

const mem = () => U.fmtBytes(process.memoryUsage().rss);

const list = [
  {
    name: 'menu',
    aliases: ['help', 'ayuda', 'comandos', 'allmenu', 'start', 'menucompleto'],
    category: 'main',
    desc: 'Menú completo con banner',
    usage: '[página | categoría | comando]',
    run: async ({ sock, m, from, q, pushName, reply, prefix }) => {
      const arg = (q || '').trim();
      const catHit = arg && !/^\d+$/.test(arg) ? catKey(arg) : null;
      const found = !catHit && arg && registry.map.get(U.strip(arg.toLowerCase()).replace(/^[.!/#]/, ''));
      if (found) {
        return reply(
          `*${prefix}${found.name}*\nCategoria: ${found.category}\nSignifica: ${found.desc || '-'}\nUso: ${prefix}${found.name} ${found.usage || ''}\nAlias: ${(found.aliases || []).join(', ') || '-'}`
        );
      }
      const pageReq = /^\d{1,3}$/.test(arg) ? parseInt(arg) : 0;
      const only = pageReq ? null : catHit;
      const subNum = sock.isSub ? sock.subNumber : null;
      const pages = buildPages(pushName, only, subNum);
      const total = pages.length;
      const page = Math.min(Math.max(pageReq || 1, 1), total);
      lastPage.set(from, page);
      const foot = total > 1
        ? `\n${C.quote}${sans('Pagina')} ${page}/${total}` + (page < total ? `\n${C.quote}${prefix}sig ${sans('para la siguiente')}` : `\n${C.quote}${sans('fin del menu')}`)
        : '';
      const caption = pages[page - 1] + foot;

      const buttons = [];
      if ((db.data.menuButtons ?? config.menuButtons ?? false) && total > 1) {
        if (page < total) buttons.push({ buttonId: `${prefix}menu ${page + 1}`, buttonText: { displayText: 'Siguiente >>' }, type: 1 });
        if (page > 1) buttons.push({ buttonId: `${prefix}menu ${page - 1}`, buttonText: { displayText: '<< Anterior' }, type: 1 });
      }
      console.log(`[MENU] pagina ${page}/${total} estilo ${menuStyle()}${buttons.length ? ' +botones' : ''}`);
      await sendMenu(sock, from, m, caption, buttons, page, total);
    },
  },

  {
    name: 'ping',
    aliases: ['p', 'latencia'],
    category: 'main',
    desc: 'Velocidad real del bot (latencia medida, no inventada)',
    run: async ({ sock, m, from, startedAt }) => {
      const procMs = Date.now() - startedAt;
      const t0 = process.hrtime.bigint();
      const sent = await sock.sendMessage(from, { text: '🏓 Midiendo...' }, { quoted: m });
      const rtt = Number(process.hrtime.bigint() - t0) / 1e6;
      const delivery = m.messageTimestamp ? Math.max(0, Date.now() - Number(m.messageTimestamp) * 1000) : null;
      const cpus = os.cpus() || [];
      let load = '';
      try { load = os.loadavg().map((x) => x.toFixed(2)).join(' / '); } catch {}
      const text =
        `🏓 *PONG!*\n\n` +
        `⚡ Latencia WhatsApp (envío → confirmación): *${rtt.toFixed(0)} ms*\n` +
        `🧠 Procesamiento interno: *${procMs} ms*\n` +
        (delivery !== null ? `📡 Retraso de entrega del mensaje: *${(delivery / 1000).toFixed(2)} s*\n` : '') +
        `\n💾 RAM del bot: ${mem()}\n` +
        `💽 RAM libre del sistema: ${U.fmtBytes(os.freemem())} / ${U.fmtBytes(os.totalmem())}\n` +
        `🖥️ CPU: ${cpus[0]?.model || 'ARM'} (${cpus.length || '?'} núcleos)\n` +
        (load ? `📈 Carga: ${load}\n` : '') +
        `⏱️ Activo: ${U.fmtTime(process.uptime())}`;
      await sock.sendMessage(from, { text, edit: sent.key });
    },
  },

  {
    name: 'speedtest',
    aliases: ['speed'],
    category: 'main',
    desc: 'Test real de velocidad de internet del teléfono donde corre el bot',
    run: async ({ reply }) => {
      await reply('📶 Midiendo velocidad (unos segundos)...');
      let t = Date.now();
      await axios.get('https://speed.cloudflare.com/__down?bytes=0', { timeout: 15000 });
      const ping = Date.now() - t;
      t = Date.now();
      const r = await axios.get('https://speed.cloudflare.com/__down?bytes=15000000', { responseType: 'arraybuffer', timeout: 60000 });
      const down = (r.data.byteLength * 8) / ((Date.now() - t) / 1000) / 1e6;
      const buf = Buffer.alloc(5_000_000, 1);
      t = Date.now();
      await axios.post('https://speed.cloudflare.com/__up', buf, { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 60000 });
      const up = (buf.length * 8) / ((Date.now() - t) / 1000) / 1e6;
      reply(`📶 *SPEEDTEST*\n\n🏓 Ping: *${ping} ms*\n⬇️ Descarga: *${down.toFixed(2)} Mbps*\n⬆️ Subida: *${up.toFixed(2)} Mbps*\n\n_Servidor: Cloudflare_`);
    },
  },

  { name: 'runtime', aliases: ['uptime', 'activo'], category: 'main', desc: 'Tiempo activo del bot', run: ({ reply }) => reply(`⏱️ Activo desde hace *${U.fmtTime(process.uptime())}*`) },

  {
    name: 'owner', aliases: ['creador', 'dueno'], category: 'main', desc: 'Contacto del owner',
    run: ({ sock, from, m }) => {
      const n = config.owner.number;
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${config.owner.name}\nTEL;type=CELL;waid=${n}:+${n}\nEND:VCARD`;
      return sock.sendMessage(from, { contacts: { displayName: config.owner.name, contacts: [{ vcard }] } }, { quoted: m });
    },
  },

  {
    name: 'botinfo', aliases: ['info', 'estado'], category: 'main', desc: 'Información del bot',
    run: ({ reply }) =>
      reply(`🦈 *${config.botName}*\n\n👑 Owner: ${config.owner.name}\n📚 Comandos: ${registry.list.length}\n📨 Comandos usados: ${db.data.stats.commands}\n👥 Usuarios: ${Object.keys(db.data.users).length}\n🤖 IA: ${config.ai.key ? 'tu API key' : 'Pollinations (sin key)'}\n🟢 Node: ${process.version}\n💻 ${os.platform()} ${os.arch()}\n⏱️ Activo: ${U.fmtTime(process.uptime())}`),
  },

  {
    name: 'sysinfo', aliases: ['sistema'], category: 'main', desc: 'Recursos del sistema',
    run: ({ reply }) =>
      reply(`💻 *SISTEMA*\n\n🖥️ ${os.type()} ${os.release()}\n🧠 CPU: ${os.cpus()[0]?.model || 'ARM'} x${os.cpus().length}\n💾 RAM: ${U.fmtBytes(os.totalmem() - os.freemem())} / ${U.fmtBytes(os.totalmem())}\n📦 RAM del bot: ${mem()}\n⏱️ Sistema activo: ${U.fmtTime(os.uptime())}`),
  },

  { name: 'prefijos', aliases: ['prefix', 'prefijo'], category: 'main', desc: 'Muestra los prefijos del bot', run: ({ reply }) => reply(`Prefijos: ${prefixes.list().map((p) => p || 'none (sin prefijo)').join('   ')}`) },

  {
    name: 'api', category: 'main', desc: 'Información de la API REST del bot', owner: true,
    run: ({ reply }) =>
      reply(`🌐 *API REST*\nURL: http://${config.api.host}:${config.api.port}/api/ping\nClave: ${config.api.key}\n\nEndpoints: ai, imagine, weather, translate, wiki, country, pokemon, anime, crypto, dolar, currency, ip, qr, short, define, search, info, download, commands`),
  },

  {
    name: 'reportar', aliases: ['report', 'bug', 'sugerir'], category: 'main', desc: 'Envia un reporte o sugerencia al owner (queda guardado, el owner lo lee con .reportes)', usage: '<mensaje>',
    run: async ({ q, pushName, senderNum, reply, prefix }) => {
      if (!q) return reply(`Escribe tu reporte. Ej: ${prefix}reportar el comando ${prefix}play falla`);
      (db.data.reports ||= []).push({ t: Date.now(), n: senderNum, name: pushName, text: q.slice(0, 1000) });
      if (db.data.reports.length > 100) db.data.reports.shift();
      db.save();
      reply('Reporte guardado para el owner. Gracias.');
    },
  },
];

list.push({
  name: 'sig', aliases: ['siguiente', 'next'], category: 'main', desc: 'Siguiente página del menú', usage: '',
  run: (c) => registry.map.get('menu').run({ ...c, q: String((lastPage.get(c.from) || 1) + 1) }),
});
list.push({
  name: 'botones', category: 'main', owner: true, desc: 'Activa/desactiva los botones del menú', usage: 'on | off',
  run: (c) => {
    const on = /^(on|si|sí|1|activar)$/i.test(c.args[0] || '');
    const off = /^(off|no|0|desactivar)$/i.test(c.args[0] || '');
    if (!on && !off) return c.reply(`Botones del menú: *${(db.data.menuButtons ?? config.menuButtons) ? 'ON' : 'OFF'}*\nUso: ${c.prefix}botones on | off`);
    db.data.menuButtons = on;
    db.save();
    return c.reply(`✅ Botones del menú ${on ? 'activados' : 'desactivados'}.`);
  },
});
list.push({
  name: 'pagina', aliases: ['página', 'page', 'pag'], category: 'main', desc: 'Siguiente página del menú', usage: '<número>',
  run: (c) => registry.map.get('menu').run({ ...c, q: String(parseInt(c.q) || 2) }),
});

list.push({
  name: 'menustyle', aliases: ['estilomenu'], category: 'main', owner: true,
  desc: 'Cambia cómo se envía el menú: ad (banner incrustado, sin descargar) o foto', usage: 'ad | foto',
  run: (c) => {
    const a = (c.args[0] || '').toLowerCase();
    if (!['ad', 'foto'].includes(a)) return c.reply(`Estilo actual: *${menuStyle()}*\nUso: ${c.prefix}menustyle ad | foto\n\n• ad → el banner viaja dentro del mensaje, se ve sin descargar nada\n• foto → foto normal con el menú en el pie`);
    db.data.menuStyle = a;
    db.save();
    return c.reply(`Estilo del menú: *${a}*`);
  },
});
list.push({
  name: 'setbanner', aliases: ['cambiarbanner', 'setmenu', 'setvideo'], category: 'main', owner: true,
  desc: 'Cambia el banner del menu: imagen, GIF o VIDEO (responde a uno o pon un enlace)', usage: '<imagen | video | url>',
  run: async (c) => {
    let buf, kind;
    const url = c.args.find(U.isUrl);
    if (url) {
      if (!U.isPublicUrl(url)) return c.reply('Esa direccion no es publica.');
      buf = await U.getBuffer(url, { timeout: 60000, maxContentLength: 40 * 1024 * 1024 });
    } else {
      const f = await c.getMedia(['image', 'video']);
      if (!f) return c.reply(`Envia una imagen o un video con *${c.prefix}setbanner* en el texto, o responde a uno, o pon un enlace.`);
      buf = f.buffer;
    }
    kind = sniff(buf);
    if (!kind || buf.length < 2000) return c.reply('Eso no parece una imagen ni un video valido.');
    const M = require('../lib/media');
    let type = 'image';
    let ext = 'jpg';
    if (kind === 'image') {
      // se reduce y comprime para que cargue rapido (si no hay jimp se usa tal cual)
      try { buf = await M.imageFx(buf, (img) => img.scaleToFit(1280, 1280).quality(85), 'image/jpeg'); } catch {}
    } else {
      type = 'video'; ext = 'mp4';
      // video/GIF: se comprime a mp4 corto, sin audio y liviano (el banner viaja en cada menu)
      try {
        buf = await M.runFf(buf, 'mp4', (i, o) => ['-i', i, '-t', '12', '-vf', "scale='min(720,iw)':-2:flags=lanczos,fps=24", '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', o], kind === 'gif' ? 'gif' : 'mp4');
      } catch (e) {
        if (kind !== 'video' || buf.length > 12 * 1024 * 1024 || sniff(buf) !== 'video' || buf.slice(4, 8).toString() !== 'ftyp') return c.reply(`No pude procesar el video (${String(e.message).slice(0, 120)}). Instala ffmpeg o manda un mp4 de menos de 12 MB.`);
      }
    }
    let file;
    try { file = safeWrite(`custom-banner.${ext}`, buf); }
    catch (e) { return c.reply(`No pude guardar el banner (${String(e.message).slice(0, 120)}). Revisa los permisos de la carpeta del bot.`); }
    if (db.data.banner?.file && db.data.banner.file !== file) { try { fs.unlinkSync(db.data.banner.file); } catch {} }
    db.data.banner = { file, type };
    db.save();
    resetBanner();
    const caption = `Banner actualizado (${type === 'video' ? 'video' : 'imagen'}, ${U.fmtBytes(buf.length)}). Asi se vera en el menu.`;
    if (type === 'video') await c.sock.sendMessage(c.from, { video: buf, caption, gifPlayback: true }, { quoted: c.m });
    else await c.sendImage(buf, caption);
  },
});
list.push({
  name: 'delbanner', aliases: ['resetbanner', 'bannerdefault'], category: 'main', owner: true,
  desc: 'Vuelve al banner original del menu', usage: '',
  run: (c) => {
    if (db.data.banner?.file) { try { fs.unlinkSync(db.data.banner.file); } catch {} }
    delete db.data.banner;
    db.save();
    resetBanner();
    return c.reply('Banner original restaurado.');
  },
});
list.push({
  name: 'setprefix', aliases: ['setprefijo', 'cambiarprefijo'], category: 'main', owner: true,
  desc: 'Cambia el prefijo del bot (puedes usar none = sin prefijo)', usage: '<prefijo> | none | multi',
  run: (c) => {
    const a = c.args;
    const show = () => prefixes.list().map((p) => p || 'none').join('   ');
    if (!a.length) return c.reply(`Prefijo actual: *${show()}*\n\n- ${c.prefix}setprefix #  -> solo servira #\n- ${c.prefix}setprefix . !  -> varios\n- ${c.prefix}setprefix none  -> sin prefijo (escribes "menu" y ya) ademas de los normales\n- ${c.prefix}setprefix # none  -> # y tambien sin prefijo\n- ${c.prefix}setprefix multi  -> vuelve a los de fabrica (${config.prefixes.join(' ')})\n\nSi lo olvidas, escribe solo: prefijo`);
    if (/^(multi|reset|todos|default)$/i.test(a[0])) { prefixes.reset(); return c.reply(`Prefijos restaurados: ${config.prefixes.join('   ')}`); }
    const isNone = (x) => /^(none|ninguno|sin|nada|noprefix)$/i.test(x);
    const wantsNone = a.some(isNone);
    const syms = a.filter((x) => !isNone(x));
    const bad = syms.find((x) => x.length > 3 || /[\p{L}\p{N}\s]/u.test(x));
    if (bad || a.length > 6) return c.reply('El prefijo debe ser 1 a 3 simbolos (sin letras ni numeros). Ej: *#*  o  *.*  o  *!*  — o la palabra *none* para no usar prefijo.');
    const list = [...new Set(syms.length ? syms : config.prefixes)];
    if (wantsNone) list.push('');
    prefixes.set(list);
    return c.reply(`Listo. Prefijos ahora: *${list.map((p) => p || 'none').join('   ')}*\n${wantsNone ? 'Modo SIN PREFIJO activado: escribe por ejemplo "menu" o "ping" sin simbolo. (Las palabras normales de charla no activan comandos.)\n' : ''}Si lo olvidas, escribe solo: prefijo`);
  },
});

// Atajos: .menuia  .menudescargas  .menugrupos ...
for (const [key, meta] of Object.entries(config.categories)) {
  const names = [...new Set([`menu${norm(key)}`, `menu${norm(meta.title)}`, ...(key === 'ai' ? ['menuia'] : [])])];
  list.push({
    name: names[0], aliases: names.slice(1), category: 'main', hidden: true, desc: `Menú de ${meta.title}`,
    run: (c) => registry.map.get('menu').run({ ...c, q: key }),
  });
}

module.exports = list;
