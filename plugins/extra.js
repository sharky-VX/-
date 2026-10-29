const axios = require('axios');
const U = require('../lib/utils');
const ai = require('../lib/ai');
const { card } = require('../lib/deco');

// ═══════════════════════════════════════════════
//  MENÚ OCULTO (.menu2): categoría "extra" — no sale en .menu
//  Todo en HD / 4K. Las imágenes se mandan dos veces: vista rápida + archivo SIN comprimir.
// ═══════════════════════════════════════════════
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36';
const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'fun', run });
const ext = (b) => (b[0] === 0x89 ? 'png' : b.slice(0, 4).toString() === 'RIFF' ? 'webp' : 'jpg');
const isImg = (b) => b && b.length > 5000 && ((b[0] === 0xff && b[1] === 0xd8) || b[0] === 0x89 || b.slice(0, 4).toString() === 'RIFF');

// Manda la imagen comprimida (rápida) y luego el original como documento (calidad real)
async function sendHD(c, buf, caption, name) {
  await c.sendImage(buf, caption);
  await c.sendFile(buf, `${name}.${ext(buf)}`, ext(buf) === 'png' ? 'image/png' : 'image/jpeg');
}

// ── Fondos de pantalla (Wallhaven: API pública, solo contenido seguro) ──
async function wallhaven(c, { q, minRes, ratios, label, count = 2, name = 'fondo' }) {
  const query = q || c.q;
  if (!query) return c.reply(`🖼️ Dime el tema.\nEjemplo: ${c.prefix}${c.command} montañas`);
  await c.react('🔎');
  const params = { q: query, categories: '111', purity: '100', sorting: 'random', atleast: minRes };
  if (ratios) params.ratios = ratios;
  let d = await U.getJson('https://wallhaven.cc/api/v1/search', { params });
  let items = d.data || [];
  if (!items.length) { delete params.atleast; d = await U.getJson('https://wallhaven.cc/api/v1/search', { params }); items = d.data || []; }
  if (!items.length) return c.reply('❌ No encontré fondos con ese tema.');
  await c.react('⏳');
  let sent = 0;
  for (const it of items) {
    if (sent >= count) break;
    try {
      const buf = await U.getBuffer(it.path, { timeout: 60000, maxContentLength: 25 * 1024 * 1024 });
      if (!isImg(buf)) continue;
      const cap = sent === 0
        ? card(label, [['🔎', 'Tema', query], ['📐', 'Resolución', it.resolution], ['👁️', 'Vistas', it.views], ['❤️', 'Favoritos', it.favorites]], 'Archivo sin comprimir abajo 💙')
        : `💙 ${it.resolution}`;
      await sendHD(c, buf, cap, `${name}_${it.resolution}`);
      sent++;
    } catch { /* prueba la siguiente */ }
  }
  if (!sent) return c.reply('❌ No pude descargar los fondos, intenta de nuevo.');
  await c.react('✅');
}

const WALLS = [
  ['wall4k', 'Fondo 4K (3840x2160)', '<tema>', { minRes: '3840x2160', ratios: '16x9', label: 'Fondo 4K' }, ['fondo4k']],
  ['wallhd', 'Fondo Full HD horizontal', '<tema>', { minRes: '1920x1080', ratios: '16x9', label: 'Fondo HD' }, ['fondohd']],
  ['wallcel', 'Fondo vertical para celular', '<tema>', { minRes: '1080x1920', ratios: '9x16', label: 'Fondo celular' }, ['fondocel']],
  ['wallanime', 'Fondo anime en HD', '', { q: 'anime', minRes: '1920x1080', label: 'Fondo anime' }, ['fondoanime']],
  ['wallpaisaje', 'Paisajes en HD', '', { q: 'landscape', minRes: '1920x1080', label: 'Paisaje' }, ['paisaje']],
  ['wallespacio', 'Espacio y galaxias en 4K', '', { q: 'space galaxy', minRes: '3840x2160', label: 'Espacio 4K' }, ['espacio']],
  ['wallcarros', 'Carros en 4K', '', { q: 'cars', minRes: '3840x2160', label: 'Carros 4K' }, ['carros']],
  ['wallgatos', 'Gatos en HD', '', { q: 'cat', minRes: '1920x1080', label: 'Gatos' }, ['gatoshd']],
  ['wallminimal', 'Fondos minimalistas', '', { q: 'minimalist', minRes: '1920x1080', label: 'Minimalista' }, []],
  ['walloscuro', 'Fondos oscuros AMOLED', '', { q: 'dark black', minRes: '1920x1080', label: 'Oscuro' }, ['amoled']],
];

const list = WALLS.map(([name, desc, usage, o, aliases]) =>
  mk(name, desc, usage, (c) => wallhaven(c, { ...o, name }), aliases)
);

// ── Imágenes IA en alta resolución ──
const aiHD = (name, desc, w, h, aliases) =>
  mk(name, desc, '<descripción>', async (c) => {
    if (!c.q) return c.reply(`🎨 Dime qué imagen quieres.\nEjemplo: ${c.prefix}${name} un dragón de cristal`);
    await c.react('🎨');
    const buf = await ai.image(`${c.q}, ultra detailed, sharp focus, high quality`, { width: w, height: h });
    await sendHD(c, buf, card('Imagen IA', [['📝', 'Idea', c.q.slice(0, 120)], ['📐', 'Tamaño', `${w}x${h}`]], 'Archivo sin comprimir abajo 💙'), name);
    await c.react('✅');
  }, aliases);
list.push(
  aiHD('imagenhd', 'Imagen IA en Full HD (1920x1080)', 1920, 1080, ['imghd']),
  aiHD('imagen4k', 'Imagen IA en 4K (3840x2160)', 3840, 2160, ['img4k']),
  aiHD('imagencel', 'Imagen IA vertical HD para celular', 1080, 1920, ['imgcel'])
);

// ── Capturas de pantalla de páginas web en HD ──
list.push(mk('captura', 'Captura de una página web en HD', '<url>', async (c) => {
  const url = c.args.find(U.isUrl);
  if (!url) return c.reply('🔗 Ejemplo: .captura https://wikipedia.org');
  if (!U.isPublicUrl(url)) return c.reply('❌ Esa dirección no es pública.');
  await c.react('⏳');
  const buf = await U.getBuffer(`https://image.thum.io/get/width/1920/crop/1080/noanimate/${url}`, { timeout: 60000 });
  if (!isImg(buf)) return c.reply('❌ No pude capturar esa página.');
  await sendHD(c, buf, card('Captura', [['🔗', 'Página', url]], 'Vista HD 1920x1080 💙'), 'captura');
  await c.react('✅');
}, ['capturahd']));

// ── QR grande ──
list.push(mk('qrhd', 'Código QR grande de alta calidad', '<texto o enlace>', async (c) => {
  if (!c.q) return c.reply('Ejemplo: .qrhd https://mi-pagina.com');
  const buf = await U.getBuffer(`https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&margin=20&data=${encodeURIComponent(c.q)}`);
  await sendHD(c, buf, card('QR HD', [['📝', 'Contenido', c.q.slice(0, 100)]]), 'qr');
}, ['qrgrande']));

// ── Películas (póster en HD) ──
list.push(mk('peli', 'Busca una película con póster y datos', '<título>', async (c) => {
  if (!c.q) return c.reply('🎬 Ejemplo: .peli interestelar');
  const d = await U.getJson('https://itunes.apple.com/search', { params: { term: c.q, media: 'movie', limit: 3, country: 'US' } });
  const r = (d.results || [])[0];
  if (!r) return c.reply('❌ No encontré esa película.');
  const poster = (r.artworkUrl100 || '').replace('100x100bb', '1200x1200bb');
  const cap = card('Película', [
    ['🎬', 'Título', r.trackName], ['📅', 'Año', (r.releaseDate || '').slice(0, 4)], ['🎭', 'Género', r.primaryGenreName],
    ['⏱️', 'Duración', r.trackTimeMillis ? Math.round(r.trackTimeMillis / 60000) + ' min' : ''], ['🔞', 'Clasificación', r.contentAdvisoryRating],
    ['📖', 'Sinopsis', (r.longDescription || r.shortDescription || '').slice(0, 450)],
  ], 'Datos vía iTunes 💙');
  try { await c.sendImage(poster, cap); } catch { await c.reply(cap); }
}, ['pelicula', 'movie']));

// ── Anime HD de nekos.best (imágenes seguras de buena calidad) ──
list.push(mk('animehd', 'Imagen anime en alta calidad', '[neko|waifu|kitsune|husbando]', async (c) => {
  const type = ['neko', 'waifu', 'kitsune', 'husbando'].includes((c.args[0] || '').toLowerCase()) ? c.args[0].toLowerCase() : 'waifu';
  const d = await U.getJson(`https://nekos.best/api/v2/${type}`);
  const r = d.results?.[0];
  if (!r?.url) return c.reply('❌ No llegó la imagen, intenta otra vez.');
  const buf = await U.getBuffer(r.url, { timeout: 60000 });
  await sendHD(c, buf, card('Anime HD', [['🎨', 'Artista', r.artist_name], ['🔗', 'Fuente', r.source_url]], 'Archivo sin comprimir abajo 💙'), `anime_${type}`);
}, ['animeimg']));

// ── Menú oculto ──
list.push({
  name: 'menu2', aliases: ['extra', 'hd', 'menu4k'], category: 'main', desc: 'Menú oculto HD/4K', usage: '',
  run: async (c) => {
    const { registry } = require('../lib/loader');
    const { C, sans } = require('../lib/deco');
    const fs = require('fs');
    const config = require('../config');
    const items = registry.list.filter((p) => p.category === 'extra');
    let body = `${C.ftop}\n${C.fcat}\`${sans('Menú oculto · HD y 4K')}\`\n`;
    for (const p of items) {
      const names = [p.name, ...(p.aliases || []).slice(0, 1)].map((n) => c.prefix + n).join(' / ');
      body += `│ *${names}*${p.usage ? ' ' + p.usage.replace(/[<>]/g, '') : ''}\n│   ${sans(p.desc)}\n│\n`;
    }
    body += C.fbot;
    const cap = `${sans('Shh, este menu es secreto')}\n${C.quote}${sans('Las imagenes llegan dos veces: vista rapida y el archivo original sin comprimir')}.\n\n${body}`;
    let img; try { img = fs.readFileSync(config.banner); } catch {}
    try { await c.sock.sendMessage(c.from, img ? { image: img, caption: cap } : { text: cap }, { quoted: c.m }); }
    catch { await c.reply(cap); }
  },
});

module.exports = list;
