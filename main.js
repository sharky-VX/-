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
    if (line && (line + '  ' + item).length > 34) { lines.push(`  ➩ *${line}*\n`); line = ''; }
    line = line ? `${line}  ${item}` : item;
  }
  if (line) lines.push(`  ➩ *${line}*\n`);
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
  return { list, total: registry.list.length, pfx }; // total real; hidden solo se ocultan del listado
}

function makeHeader(pushName, total, list, start, showIndex, subNum) {
  const subData = subNum ? (db.data.subbots?.[subNum] || {}) : {};
  const displayName = (subNum && subData.displayName) ? subData.displayName : (db.data.botName || config.botName || 'SHARKNEX');
  const mode = (db.data.mode || config.mode || 'public');
  const seen = new Set();
  const pfxList = prefixes.list()
    .map((p) => (p === '' || p == null ? 'none' : String(p).trim()))
    .filter((p) => { if (!p && p !== 'none') return false; if (seen.has(p)) return false; seen.add(p); return true; })
    .join(' / ') || '. / ! / # / none';
  let h =
    `𓆩 ${sans(String(displayName).toUpperCase())}𝕏 𓆪

   ✦ ${sans('Bot')}      ── ${displayName}
   ✦ ${sans('Prefijos')} ── ${pfxList}
   ✦ ${sans('Owner')}    ── ${config.owner?.name || 'Sharky'}
   ✦ ${sans('Modo')}     ── ${mode}
   ✦ ${sans('CMDS')}     ── ${total}

> 𓆩✰𓆪 Hola ${pushName || 'usuario'}, bienvenido a la elite.
> 𓆩☪︎𓆪 "No me hagas trabajar extra... pero si es necesario, sere rapida y letal." ── Ellen Joe
> 📢 Ver canal: ${(config.links && config.links.channel) || ''}`;
  if (showIndex) {
    h += `

   ❀ 𓆩 ${sans('INDICE DE PAGINAS')} 𓆪 ❀
`;
    for (const c of list) {
      const num = String(start[c.key] || 1).padStart(2, '0');
      const title = c.title.toLowerCase();
      const pad = Math.max(1, 24 - [...title].length);
      h += `  ➩ *${title}*${' '.repeat(pad)}✦ ${num}
`;
    }
    h += `
> 𓆩✰𓆪 Salta con .menu <pagina> ‖ Usa .next 𓆩☪︎𓆪`;
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
    const ttl = sans((c.title || '').toUpperCase() + (cont ? ' (CONT.)' : ''));
    cur += '\n   ❀ 𓆩 ' + ttl + ' 𓆪 ❀\n\n';
    inFrame = true;
  };
  const closeFrame = () => { if (inFrame) { cur += `
`; inFrame = false; } };
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


// ── Canal WhatsApp (botón "Ver canal" + nombre arriba) ──
let channelMetaCache = null; // { jid, name, invite } solo strings
function channelInviteCode() {
  const url = (config.links && config.links.channel) || '';
  const m = String(url).match(/channel\/([A-Za-z0-9_]+)/);
  return m ? m[1] : '';
}
function plainStr(v, fallback) {
  if (v == null) return fallback || '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text;
    if (typeof v.name === 'string') return v.name;
    if (typeof v.id === 'string') return v.id;
  }
  return fallback || '';
}
async function resolveChannel(sock) {
  if (channelMetaCache && channelMetaCache.jid) return channelMetaCache;
  const invite = channelInviteCode();
  const fallbackName = plainStr(
    (config.links && config.links.channelName) || ((config.botName || 'SHARKNEX') + ' · Channel')
  );
  if (!invite) return { jid: '', name: fallbackName, invite: '' };
  try {
    if (typeof sock.newsletterMetadata === 'function') {
      const meta = await sock.newsletterMetadata('invite', invite);
      const jid = plainStr(meta?.id || meta?.jid || '', '');
      const name = plainStr(meta?.name || meta?.subject || meta?.thread_metadata?.name, fallbackName);
      if (jid) {
        channelMetaCache = { jid, name, invite };
        console.log('[CANAL]', jid, name);
        return channelMetaCache;
      }
    }
  } catch (e) {
    console.error('Canal:', e?.message || e);
  }
  channelMetaCache = { jid: '', name: fallbackName, invite };
  return channelMetaCache;
}

async function sendMenu(sock, from, m, caption, buttons, page, total) {
  const subNum = sock.isSub ? sock.subNumber : null;
  const subData = subNum ? (db.data.subbots?.[subNum] || {}) : {};
  const botNameDisplay = (subNum && subData.displayName) ? subData.displayName : (db.data.botName || config.menuName || 'SHARKNEX');
  const style = menuStyle();
  const b = banner(subNum);
  const text = typeof caption === 'string' ? caption : String(caption || '');
  const attempts = [];

  // Estilo AD: miniatura del banner del bot dentro del mensaje
  if (style === 'ad' && b && b.type === 'image') {
    let thumb = null;
    try { thumb = await getThumb(subNum); } catch {}
    if (thumb && Buffer.isBuffer(thumb)) {
      const ad = {
        title: String(botNameDisplay),
        body: 'Pagina ' + page + ' de ' + total,
        thumbnail: thumb,
        mediaType: 1,
        renderLargerThumbnail: true,
        showAdAttribution: false,
        sourceUrl: String((config.links && (config.links.owner || config.links.channel)) || ''),
      };
      attempts.push({ text, contextInfo: { externalAdReply: ad } });
    }
  }

  // Estilo FOTO: banner del bot + menu (pagina 1)
  if (b && b.buf && page === 1) {
    if (b.type === 'video') {
      attempts.push({ video: b.buf, caption: text, gifPlayback: true, mimetype: 'video/mp4' });
      attempts.push({ video: b.buf, caption: text, mimetype: 'video/mp4' });
    } else {
      attempts.push({ image: b.buf, caption: text });
    }
  }

  // Texto siempre (paginas siguientes o si falla la foto)
  attempts.push({ text });

  for (const content of attempts) {
    try {
      await sock.sendMessage(from, content, { quoted: m });
      return;
    } catch (e) {
      console.error('Menu formato fallo:', e?.message || e);
    }
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
        ? `\n> 𓆩✰𓆪 PAGINA ${page} / ${total}` + (page < total ? `\n${C.quote}.next para avanzar 𓆩☪︎𓆪` : `\n> 𓆩✰𓆪 fin del menu 𓆩☪︎𓆪`)
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
    desc: 'Velocidad real del bot (latencia medida)',
    run: async ({ sock, m, from }) => {
      const t0 = process.hrtime.bigint();
      const sent = await sock.sendMessage(from, { text: 'Midiendo...' }, { quoted: m });
      const rtt = Number(process.hrtime.bigint() - t0) / 1e6;
      const text =
        `❀ *Pong*
> ⴵ ${rtt.toFixed(0)} ms`;
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
    if (bad || a.length > 6) return c.reply('El prefijo debe ser 1 a 3 simbolos (sin letras ni numeros). Ej: *#*  o  *.*  o  *!*  — o la palabra *none*.');
    // Solo "none" → únicamente sin prefijo
    if (wantsNone && !syms.length) {
      prefixes.set(['']);
      return c.reply('Prefijo: *none*\nEscribe comandos sin simbolo: p  ·  ping  ·  menu  ·  hug');
    }
    // Solo simbolos → únicamente esos (no mezcla con factory)
    const list = [...new Set(syms)];
    if (wantsNone) list.push('');
    prefixes.set(list);
    return c.reply('Prefijos ahora: *' + list.map((p) => p || 'none').join(' / ') + '*\nSolo responde a estos. Multi: ' + c.prefix + 'setprefix multi');
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
