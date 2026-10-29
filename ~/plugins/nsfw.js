// ═══════════════════════════════════════════════
//  NSFW (oculto) — solo se ve con .menu2
//  APIs: waifu.pics · nekobot · hmtai · rule34
//  HentaiLA / Maplestar (búsqueda + links)
//  SHARKNEX v4
// ═══════════════════════════════════════════════
const U = require('../lib/utils');
const media = require('../lib/media');
const db = require('../lib/db');
const config = require('../config');
const { sans, C } = require('../lib/deco');
const { registry } = require('../lib/loader');

const mk = (name, desc, usage, run, aliases = []) => ({
  name,
  aliases,
  desc,
  usage,
  category: 'nsfw',
  hidden: true, // no aparece en el menú normal
  run,
});

const tag = (j) => '@' + j.split('@')[0].split(':')[0];

// ── Envío de GIF animado (igual que anime.js) ──
async function sendAnimated(c, url, text, mentions = []) {
  const { sock, from, m } = c;
  const buf = await U.getBuffer(url, { timeout: 35000 });
  const height = Number(db.data.gifHeight || config.gifHeight || 1080);
  let mp4 = null, why = '';
  try { mp4 = await media.toMp4HD(buf, height, 'gif'); }
  catch (e) {
    why = String(e?.message || e);
    if (!/ffmpeg no est/i.test(why)) {
      try { mp4 = await media.toMp4(buf, 'gif'); } catch (e2) { why = String(e2?.message || e2); }
    }
  }
  if (mp4) {
    return sock.sendMessage(from, {
      video: mp4, caption: text, gifPlayback: true, mimetype: 'video/mp4', mentions,
    }, { quoted: m });
  }
  try {
    return await sock.sendMessage(from, {
      image: buf, mimetype: 'image/gif', caption: text, mentions,
    }, { quoted: m });
  } catch {
    return sock.sendMessage(from, { text: `${text}\n\nNo pude animar el GIF.`, mentions }, { quoted: m });
  }
}

async function sendImageOrGif(c, url, caption) {
  if (!url) throw new Error('La API no devolvió imagen.');
  if (/\.gif(\?|$)/i.test(url) || /gif/i.test(url)) {
    return sendAnimated(c, url, caption, []);
  }
  const buf = await U.getBuffer(url, { timeout: 30000 });
  return c.sock.sendMessage(c.from, { image: buf, caption }, { quoted: c.m });
}

// ── Fuentes de APIs (gratis, sin key) ──
const SOURCES = {
  // waifu.pics NSFW
  waifu: async (tag) => {
    const d = await U.getJson(`https://api.waifu.pics/nsfw/${tag}`);
    return d?.url || null;
  },
  // nekobot
  nekobot: async (type) => {
    const d = await U.getJson(`https://nekobot.xyz/api/image?type=${type}`);
    return d?.message || null;
  },
  // hmtai REST (si está arriba)
  hmtai: async (cat) => {
    try {
      const d = await U.getJson(`https://hmtai.hatsunia.cfd/nsfw/${cat}`);
      return d?.url || d || null;
    } catch {
      return null;
    }
  },
  // rule34 (random por tag)
  rule34: async (tags = 'hentai') => {
    const d = await U.getJson(`https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=20&tags=${encodeURIComponent(tags)}`);
    if (!Array.isArray(d) || !d.length) return null;
    const post = d[Math.floor(Math.random() * d.length)];
    return post?.file_url || post?.sample_url || null;
  },
};

// Intenta varias fuentes en orden hasta que una responda
async function fetchNsfw(primary, fallbacks = []) {
  const tries = [primary, ...fallbacks];
  for (const fn of tries) {
    try {
      const url = await fn();
      if (url && typeof url === 'string' && url.startsWith('http')) return url;
    } catch {}
  }
  throw new Error('Ninguna API respondió. Intenta de nuevo en unos segundos.');
}

// ── Comandos de GIF / imagen NSFW ──
// [nombre, descripción, función que devuelve url, aliases]
const CMDS = [
  // waifu.pics principales
  ['fap', 'GIF de fap / masturbación', () => SOURCES.waifu('blowjob').catch(() => SOURCES.nekobot('pgif')), ['masturbacion', 'masturbar']],
  ['blowjob', 'GIF de blowjob', () => SOURCES.waifu('blowjob'), ['bj', 'oral']],
  ['waifunsfw', 'Waifu NSFW', () => SOURCES.waifu('waifu'), ['hwaifu']],
  ['nekonsfw', 'Neko NSFW', () => SOURCES.waifu('neko'), ['hneko']],
  ['trap', 'Trap NSFW', () => SOURCES.waifu('trap'), ['femboy']],
  // nekobot (más variedad de GIFs)
  ['anal', 'GIF anal', () => SOURCES.nekobot('anal'), []],
  ['hentai', 'Imagen / GIF hentai', () => SOURCES.nekobot('hentai'), ['h']],
  ['boobs', 'Tetas', () => SOURCES.nekobot('boobs'), ['tits', 'tetas']],
  ['ass', 'Culo', () => SOURCES.nekobot('ass'), ['culo', 'nalgas']],
  ['pussy', 'Pussy', () => SOURCES.nekobot('pussy'), ['coño']],
  ['cum', 'Cum', () => SOURCES.nekobot('cum'), ['leche']],
  ['ahegao', 'Ahegao', () => SOURCES.nekobot('ahegao'), []],
  ['tentacle', 'Tentáculos', () => SOURCES.nekobot('tentacle'), ['tentaculos']],
  ['yuri', 'Yuri NSFW', () => SOURCES.nekobot('yuri'), ['lesbian']],
  ['pgif', 'GIF porno anime random', () => SOURCES.nekobot('pgif'), ['gifnsfw', 'pornogif']],
  ['thigh', 'Muslos', () => SOURCES.nekobot('hthigh'), ['muslos']],
  ['midriff', 'Midriff / ombligo', () => SOURCES.nekobot('hmidriff'), []],
  ['kitsune', 'Kitsune NSFW', () => SOURCES.nekobot('hkitsune'), []],
  // rule34 genérico
  ['rule34', 'Rule34 por tags', async (c) => {
    const tags = c.q?.trim() || 'hentai animated';
    return SOURCES.rule34(tags);
  }, ['r34']],
  // hmtai fallbacks
  ['ero', 'Ero / soft nsfw', () => SOURCES.hmtai('ero').then(u => u || SOURCES.waifu('waifu')), []],
  ['orgy', 'Orgy', () => SOURCES.hmtai('orgy').then(u => u || SOURCES.nekobot('hentai')), []],
  ['manga', 'Página de doujin / manga', () => SOURCES.hmtai('manga').then(u => u || SOURCES.rule34('manga')), []],
];

const list = CMDS.map(([name, desc, getter, aliases]) =>
  mk(name, desc, name === 'rule34' ? '<tags opcional>' : '', async (c) => {
    let url;
    if (name === 'rule34') {
      url = await getter(c);
    } else {
      url = await fetchNsfw(getter, []);
    }
    if (!url) throw new Error('La API no devolvió contenido.');
    const caption = `${C.quote}${sans(name)}`;
    return sendImageOrGif(c, url, caption);
  }, aliases)
);

// ── HentaiLA: búsqueda de series (envía portada + link) ──
list.push(mk('hentaila', 'Busca serie en HentaiLA', '<nombre>', async (c) => {
  if (!c.q) return c.reply(`${C.quote}Escribe el nombre. Ej: ${c.prefix}hentaila sexfriend`);
  try {
    // Búsqueda simple vía página pública (scraping ligero)
    const q = encodeURIComponent(c.q.trim());
    const res = await require('axios').get(`https://hentaila.com/search?q=${q}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000,
      responseType: 'text',
    }).catch(() => null);
    if (!res?.data) throw new Error('HentaiLA no respondió');
    const m = String(res.data).match(/href="(\/media\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i)
      || String(res.data).match(/\/media\/([a-z0-9-]+)/i);
    if (!m) return c.reply('No encontré resultados en HentaiLA.');
    const slug = m[1]?.startsWith('/') ? m[1] : `/media/${m[1]}`;
    const cover = m[2] || `https://cdn.hentaila.com/covers/${m[1]}.jpg`;
    const url = `https://hentaila.com${slug}`;
    const caption = `${C.ftop}\n${C.fcat}\`${sans('hentaila')}\`\n│ ✦ *Busqueda:* ${c.q}\n│ ✦ *Link:* ${url}\n${C.fbot}`;
    try {
      const buf = await U.getBuffer(cover);
      await c.sock.sendMessage(c.from, { image: buf, caption }, { quoted: c.m });
    } catch {
      await c.reply(caption);
    }
  } catch (e) {
    return c.reply(`Error con HentaiLA: ${String(e.message || e).slice(0, 120)}`);
  }
}, ['hla', 'hentai.la']));

// ── Maplestar: link a su contenido (Patreon / conocidos) ──
list.push(mk('maplestar', 'Info + links de Maplestar (animaciones)', '', async (c) => {
  const text = [
    C.ftop,
    `${C.fcat}\`${sans('maplestar')}\``,
    '│ ✦ Creador de animaciones hentai de alta calidad',
    '│ ✦ Patreon: https://www.patreon.com/Maplestar',
    '│ ✦ Busca sus works en X / Telegram (maplestar)',
    '│ ✦ No hay API pública oficial de randoms',
    C.fbot,
    `${C.quote}Usa .rule34 maplestar o .hentaila para series`,
  ].join('\n');
  return c.reply(text);
}, ['maple']));

// ── Naranja / Azul / Roja (alias a fuentes distintas) ──
// "Naranja" → waifu.pics | "Azul" → nekobot | "Roja" → rule34
list.push(mk('naranja', 'Fuente Naranja (waifu.pics NSFW random)', '', async (c) => {
  const tags = ['waifu', 'neko', 'blowjob', 'trap'];
  const tag = tags[Math.floor(Math.random() * tags.length)];
  const url = await SOURCES.waifu(tag);
  return sendImageOrGif(c, url, `${C.quote}${sans('naranja')} · ${tag}`);
}, ['orange']));
list.push(mk('azul', 'Fuente Azul (nekobot random)', '', async (c) => {
  const types = ['hentai', 'pgif', 'anal', 'boobs', 'ass', 'pussy'];
  const t = types[Math.floor(Math.random() * types.length)];
  const url = await SOURCES.nekobot(t);
  return sendImageOrGif(c, url, `${C.quote}${sans('azul')} · ${t}`);
}, ['blue']));
list.push(mk('roja', 'Fuente Roja (rule34 random)', '', async (c) => {
  const url = await SOURCES.rule34('hentai animated -loli -shota');
  return sendImageOrGif(c, url, `${C.quote}${sans('roja')}`);
}, ['red', 'roja']));

// ── Menú oculto: .menu2 ──
list.push(mk('menu2', 'Menú oculto NSFW (solo adultos)', '', async (c) => {
  const pfx = c.prefix || '.';
  const cmds = registry.list
    .filter((p) => p.category === 'nsfw' && p.name !== 'menu2')
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const lines = [
    C.ftop,
    `${C.fcat}\`${sans('menu nsfw')}\``,
    `│ ${C.bul} *Solo mayores de 18*`,
    `│ ${C.bul} Categoría oculta · no aparece en .menu`,
    '│',
  ];

  for (const p of cmds) {
    const aliases = (p.aliases || []).slice(0, 2).map((a) => pfx + a).join(' / ');
    const names = aliases ? `${pfx}${p.name} / ${aliases}` : `${pfx}${p.name}`;
    lines.push(`│ ${C.bul} *${names}*`);
    if (p.desc) lines.push(`│    ˚ʚ ${sans(String(p.desc).slice(0, 55))} ɞ˚`);
    lines.push('│');
  }

  lines.push(C.fbot);
  lines.push(`${C.quote}${sans('Fuentes: waifu.pics · nekobot · rule34 · HentaiLA')}`);
  lines.push(`${C.quote}${sans('Naranja = waifu · Azul = nekobot · Roja = rule34')}`);

  return c.reply(lines.join('\n'));
}, ['nsfwmenu', 'menunsfw', 'menu18']));

module.exports = list;
