const yt = require('../lib/ytdlp');
const social = require('../lib/social');
const U = require('../lib/utils');
const config = require('../config');
const { card, wrap, sans, C } = require('../lib/deco');
const music = require('../lib/music');

// ═══════════════════════════════════════════════
//  Descargas. Regla general: NO hace falta enlace.
//   .play bad bunny        → busca en YouTube
//   .tiktok gatos graciosos → busca en TikTok
//   .pinterest gatos 5      → busca imágenes
//  Si pegas un enlace (o respondes a un mensaje con enlace) también funciona.
//  Siempre manda primero una tarjeta decorada con la portada y los datos.
// ═══════════════════════════════════════════════
const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '?');
const num = (n) => {
  if (n === undefined || n === null || isNaN(n)) return '';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
};
const MAX = () => config.maxFileMB * 1024 * 1024;

const getLink = (ctx) => ctx.args.find(U.isUrl) || (ctx.quotedText.match(/https?:\/\/\S+/) || [])[0];
// texto de búsqueda = lo que escribió, sin el enlace
const getQuery = (ctx) => ctx.args.filter((a) => !U.isUrl(a)).join(' ').trim() || (!getLink(ctx) ? ctx.quotedText.trim().slice(0, 200) : '');

// Tarjeta con portada (si la portada falla, solo texto)
async function sendCard(ctx, thumb, caption) {
  try {
    if (thumb) return await ctx.sendImage(thumb, caption);
  } catch (e) { /* sigue con texto */ }
  return ctx.reply(caption);
}

// Envía un archivo local (yt-dlp) o una URL directa
async function sendFileOrUrl(ctx, src, audio, title) {
  const { sock, from, m } = ctx;
  let content;
  if (src.file) {
    content = audio
      ? { audio: { url: src.file }, mimetype: 'audio/mpeg', fileName: `${title || 'audio'}.mp3` }
      : { video: { url: src.file }, mimetype: 'video/mp4', caption: `💙 ${title || ''}`.trim() };
  } else {
    // URL directa (TikTok): se descarga primero para respetar el límite de tamaño
    const buf = await U.getBuffer(src.url, { timeout: 90000, maxContentLength: MAX(), headers: { 'User-Agent': 'Mozilla/5.0' } });
    content = audio
      ? { audio: buf, mimetype: 'audio/mpeg', fileName: `${title || 'audio'}.mp3` }
      : { video: buf, mimetype: 'video/mp4', caption: `💙 ${title || ''}`.trim() };
  }
  await sock.sendMessage(from, content, { quoted: m });
}

// ── YouTube y cualquier enlace soportado por yt-dlp ──
async function ytFlow(ctx, { audio, height = 720, prefix = 'ytsearch', label = 'YouTube' }) {
  const link = getLink(ctx);
  const q = getQuery(ctx);
  if (!link && !q) {
    return ctx.reply(`🎶 Dime qué buscar o pega un enlace.\nEjemplo: ${ctx.prefix}${ctx.command} bad bunny monaco`);
  }
  await ctx.react('🔎');
  let url = link, meta = null;
  if (!url) {
    const [v] = await yt.search(q, 1, prefix);
    if (!v) return ctx.reply('❌ No encontré resultados.');
    url = v.url; meta = v;
  }
  // información y descarga al mismo tiempo (más rápido)
  await ctx.react('⏳');
  const [info, d] = await Promise.all([
    meta ? Promise.resolve(meta) : yt.info(url).catch(() => null),
    yt.download(url, { audio, height }),
  ]);
  try {
    const v = info || {};
    const cap = card(audio ? 'Música' : 'Video', [
      ['🎵', 'Título', v.title],
      ['🎤', 'Canal', v.channel],
      ['⏱️', 'Duración', v.duration ? dur(v.duration) : ''],
      ['👁️', 'Vistas', num(v.views)],
      ['🔗', 'Enlace', v.url || url],
    ], `${audio ? 'Aquí va tu canción' : 'Aquí va tu video'}, ${label} 💙`);
    await sendCard(ctx, v.thumb, cap);
    await sendFileOrUrl(ctx, { file: d.file }, audio, v.title);
    await ctx.react('✅');
  } finally {
    d.cleanup();
  }
}


// ── Spotify: busca la canción (portada y datos) y manda el audio completo ──
async function spotifyFlow(ctx) {
  const link = getLink(ctx);
  let q = getQuery(ctx);
  if (link && /spotify\.com/i.test(link)) q = (await music.fromSpotifyLink(link)) || q;
  if (!q) return ctx.reply(`🎧 Dime la canción o pega un enlace de Spotify.\nEjemplo: ${ctx.prefix}${ctx.command} bad bunny monaco`);
  await ctx.react('🔎');
  const [t] = await music.searchTracks(q, 1);
  if (!t) return ctx.reply('❌ No encontré esa canción.');
  await ctx.react('⏳');
  const [yv] = await yt.search(`${t.artist} ${t.title} audio`, 1);
  if (!yv) return ctx.reply('❌ Encontré la canción pero no pude conseguir el audio.');
  const d = await yt.download(yv.url, { audio: true });
  try {
    const cap = card('Spotify', [
      ['🎵', 'Título', t.title], ['🎤', 'Artista', t.artist], ['💿', 'Álbum', t.album],
      ['📅', 'Año', t.year], ['🎼', 'Género', t.genre], ['⏱️', 'Duración', t.duration ? dur(t.duration) : ''],
      ['🔥', 'Popularidad', t.popularity !== undefined ? t.popularity + '/100' : ''], ['🔗', 'Enlace', t.url],
    ], `Datos de ${t.source} · audio de YouTube 💙`);
    await sendCard(ctx, t.cover || yv.thumb, cap);
    await sendFileOrUrl(ctx, { file: d.file }, true, `${t.artist} - ${t.title}`);
    await ctx.react('✅');
  } finally { d.cleanup(); }
}

async function spotifySearch(ctx) {
  const q = getQuery(ctx);
  if (!q) return ctx.reply(`🔎 Ejemplo: ${ctx.prefix}${ctx.command} bad bunny`);
  const res = await music.searchTracks(q, 8);
  if (!res.length) return ctx.reply('❌ Sin resultados.');
  const rows = res.map((t, i) => [`${i + 1}`, `${t.title} — ${t.artist}`, `💿 ${t.album || '-'} · 📅 ${t.year || '-'} · ⏱️ ${t.duration ? dur(t.duration) : '?'}`]);
  await sendCard(ctx, res[0].cover, card('Búsqueda de música', rows, `Descarga con ${ctx.prefix}spotify <nombre> 💙`));
}

// ── TikTok (con búsqueda por texto) ──
async function tiktokFlow(ctx, audioOnly) {
  const link = getLink(ctx);
  const q = getQuery(ctx);
  if (!link && !q) {
    return ctx.reply(wrap('Dime que buscar o pega un enlace.\nEjemplo: ' + ctx.prefix + 'tt cosplay nino', 'tiktok'));
  }
  await ctx.react('🔎');
  const fs = require('fs');
  const ytdlp = require('../lib/ytdlp');

  async function bufFromDirect(url) {
    if (!url) return null;
    try {
      const buf = await U.getBuffer(url, {
        timeout: 45000,
        maxContentLength: 50 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://www.tiktok.com/',
          Origin: 'https://www.tiktok.com',
        },
      });
      if (buf && buf.length > 8000) return buf;
    } catch (e) {
      console.error('tt direct:', e && e.message ? e.message : e);
    }
    return null;
  }

  async function bufFromPage(pageUrl) {
    if (!pageUrl) return null;
    try {
      const v = await social.tiktokByUrl(pageUrl);
      if (v && v.video) {
        const b = await bufFromDirect(v.video);
        if (b) return { buf: b, meta: v };
      }
    } catch (e) {
      console.error('tt tikwm url:', e && e.message ? e.message : e);
    }
    try {
      const got = await ytdlp.download(pageUrl, { audio: audioOnly, height: 480, maxMB: 40, maxDuration: 180 });
      try {
        const buf = fs.readFileSync(got.file);
        if (buf && buf.length > 8000) return { buf: buf, meta: { title: pageUrl, author: '' } };
      } finally {
        try { got.cleanup(); } catch (e) {}
      }
    } catch (e) {
      console.error('tt ytdlp:', e && e.message ? e.message : e);
    }
    return null;
  }

  if (link) {
    await ctx.react('⏳');
    const got = await bufFromPage(link);
    if (!got) return ctx.reply(wrap('No pude descargar ese TikTok (prueba otro enlace).', 'tiktok'));
    const v = got.meta || {};
    const cap = [
      '   ❀ 𓆩 ' + sans('tiktok') + ' 𓆪 ❀',
      '',
      '  ✦ Titulo   ── ' + String(v.title || 'TikTok').slice(0, 100),
      v.author ? ('  ✦ Autor    ── ' + v.author) : '',
      v.plays != null ? ('  ✦ Vistas   ── ' + num(v.plays)) : '',
      v.likes != null ? ('  ✦ Likes    ── ' + num(v.likes)) : '',
      '  ✦ Calidad  ── HD sin marca',
      '',
      '   ❀',
    ].filter(Boolean).join('\n');
    if (audioOnly) {
      await ctx.sock.sendMessage(ctx.from, { audio: got.buf, mimetype: 'audio/mpeg', ptt: false }, { quoted: ctx.m });
    } else {
      await ctx.sock.sendMessage(ctx.from, { video: got.buf, caption: cap, mimetype: 'video/mp4' }, { quoted: ctx.m });
    }
    await ctx.react('✅');
    return;
  }

  let list = [];
  try {
    list = await social.tiktokSearch(q, 10);
  } catch (e) {
    console.error('tt search:', e && e.message ? e.message : e);
  }
  if (!list.length) {
    try {
      const hits = await ytdlp.search(q, 6, 'tiktoksearch');
      list = (hits || []).map(function (h) {
        return { title: h.title, author: h.channel || '', url: h.url, video: null };
      });
    } catch (e) {
      console.error('tt search2:', e && e.message ? e.message : e);
    }
  }
  if (!list.length) return ctx.reply(wrap('Sin resultados para: *' + q + '*', 'tiktok'));

  const words = String(q).toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; });
  list = list
    .map(function (v) {
      const hay = (String(v.title || '') + ' ' + String(v.author || '') + ' ' + String(v.user || '')).toLowerCase();
      let score = 0;
      for (let i = 0; i < words.length; i++) if (hay.indexOf(words[i]) >= 0) score += 2;
      return { v: v, score: score };
    })
    .sort(function (a, b) { return b.score - a.score; })
    .map(function (x) { return x.v; });

  await ctx.react('⏳');
  const target = list.slice(0, 8);
  const jobs = target.map(async function (v) {
    let pageUrl = v.url || '';
    if (!pageUrl && v.user && v.id) pageUrl = 'https://www.tiktok.com/@' + v.user + '/video/' + v.id;
    let buf = await bufFromDirect(v.video);
    let meta = v;
    if (!buf && pageUrl) {
      const got = await bufFromPage(pageUrl);
      if (got) {
        buf = got.buf;
        meta = Object.assign({}, v, got.meta || {});
      }
    }
    if (!buf) return null;
    return { buf: buf, meta: meta };
  });

  const settled = await Promise.all(jobs);
  const ok = settled.filter(Boolean).slice(0, 4);
  if (!ok.length) {
    return ctx.reply(wrap('Encontre resultados pero no pude bajar los videos.\nPrueba enlace: ' + ctx.prefix + 'tt <url>', 'tiktok'));
  }

  for (let i = 0; i < ok.length; i++) {
    const item = ok[i];
    const v = item.meta;
    const cap = [
      '   ❀ 𓆩 ' + sans('tiktok') + ' 𓆪 ❀',
      '',
      '  ✦ ' + String(v.title || 'TikTok').slice(0, 110),
      v.author ? ('  ✦ Autor    ── ' + v.author) : '',
      '  ✦ Busqueda ── ' + q,
      '  ✦ Video    ── ' + (i + 1) + ' / ' + ok.length,
      '  ✦ Calidad  ── HD sin marca',
      '',
      '   ❀',
    ].filter(Boolean).join('\n');
    try {
      await ctx.sock.sendMessage(ctx.from, { video: item.buf, caption: cap, mimetype: 'video/mp4' }, { quoted: ctx.m });
    } catch (e) {
      console.error('tt send:', e && e.message ? e.message : e);
    }
  }
  await ctx.react('✅');
}

// ── Pinterest / imágenes: .pinterest gatos 5  (máx. 10, por defecto 7) ──
// Collage: una sola imagen con todas (si el album nativo falla)
async function makeCollage(buffers) {
  const Jimp = require('jimp');
  const n = Math.min(buffers.length, 10);
  if (n === 1) return buffers[0];
  const cols = n <= 4 ? 2 : n <= 9 ? 3 : 5;
  const rows = Math.ceil(n / cols);
  const cell = 360;
  const canvas = new Jimp(cols * cell, rows * cell, 0x0d0d0dff);
  for (let i = 0; i < n; i++) {
    try {
      const img = await Jimp.read(buffers[i]);
      img.cover(cell - 4, cell - 4);
      const x = (i % cols) * cell + 2;
      const y = Math.floor(i / cols) * cell + 2;
      canvas.composite(img, x, y);
    } catch (e) {
      console.error('collage cell:', e?.message || e);
    }
  }
  return canvas.quality(82).getBufferAsync(Jimp.MIME_JPEG);
}

// Envia medias JUNTAS: album nativo → collage (NUNCA 10 mensajes sueltos)
async function sendAlbum(ctx, items, caption) {
  if (!items || !items.length) return false;
  const sock = ctx.sock;
  const from = ctx.from;
  const quoted = ctx.m;
  const cap = String(caption || '');
  const bufs = items.map((x) => x.image || x).filter((b) => b && b.length > 500);
  if (!bufs.length) return false;

  // 1) Album nativo Baileys (imagenes completas juntas)
  try {
    const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
    const albumMsg = generateWAMessageFromContent(from, {
      albumMessage: {
        expectedImageCount: bufs.length,
        expectedVideoCount: 0,
      },
    }, { userJid: sock.user?.id });
    await sock.relayMessage(from, albumMsg.message, { messageId: albumMsg.key.id });

    for (let i = 0; i < bufs.length; i++) {
      const media = await prepareWAMessageMedia(
        { image: bufs[i] },
        { upload: sock.waUploadToServer }
      );
      const img = media.imageMessage;
      if (i === 0 && cap) img.caption = cap;
      img.contextInfo = {
        ...(img.contextInfo || {}),
        messageAssociation: {
          associationType: 1,
          parentMessageKey: albumMsg.key,
        },
      };
      const node = generateWAMessageFromContent(from, { imageMessage: img }, { userJid: sock.user?.id });
      await sock.relayMessage(from, node.message, { messageId: node.key.id });
    }
    return true;
  } catch (e) {
    console.error('album native:', e && e.message ? e.message : e);
  }

  // 2) API album (algunas builds de Baileys)
  try {
    await sock.sendMessage(from, {
      album: bufs.map((b, i) => (i === 0 ? { image: b, caption: cap } : { image: b })),
    }, { quoted });
    return true;
  } catch (e) {
    console.error('album api:', e && e.message ? e.message : e);
  }

  // 3) Envio en rafaga (mismo quoted) — ultimo recurso para no perder imagenes
  try {
    await sock.sendMessage(from, { image: bufs[0], caption: cap }, { quoted });
    for (let i = 1; i < bufs.length; i++) {
      await sock.sendMessage(from, { image: bufs[i] }, { quoted });
    }
    return true;
  } catch (e) {
    console.error('album burst:', e && e.message ? e.message : e);
  }
  return false;
}


async function imagesFlow(ctx, source) {
  const link = getLink(ctx);
  if (link) return ytFlow(ctx, { audio: false, label: source });
  const args = ctx.args.slice();
  let n = 10;
  if (/^\d{1,2}$/.test(args[args.length - 1] || '')) n = parseInt(args.pop(), 10);
  n = U.clamp(n, 1, 10);
  const q = args.join(' ').trim();
  if (!q) return ctx.reply(wrap('Dime que buscar.\nEjemplo: ' + ctx.prefix + 'pin anime aesthetic', 'pinterest'));
  await ctx.react('🔎');
  let imgs = [];
  try { imgs = await social.imageSearch(q, n); } catch (e) { console.error('pin search:', e && e.message ? e.message : e); }
  if (!imgs || !imgs.length) return ctx.reply(wrap('Sin imagenes para: ' + q, 'pinterest'));

  const cap = [
    '   ❀ 𓆩 ' + sans('pinterest') + ' 𓆪 ❀',
    '',
    '  ✦ Busqueda   ── ' + q,
    '  ✦ Resultados ── ' + imgs.length + ' imagenes',
    '  ✦ Modo       ── album',
    '',
    '   ❀',
  ].join('\n');

  const items = imgs.map(function (buf) { return { image: buf }; });
  const ok = await sendAlbum(ctx, items, cap);
  if (!ok) {
    try {
      const collage = await makeCollage(imgs);
      await ctx.sock.sendMessage(ctx.from, { image: collage, caption: cap }, { quoted: ctx.m });
    } catch (e) {
      console.error('pin fallback:', e && e.message ? e.message : e);
      return ctx.reply(wrap('No pude enviar el album.', 'pinterest'));
    }
  }
  await ctx.react('✅');
}


const cmd = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'downloads', run });

const list = [
  cmd('play', 'Busca una canción en YouTube y la envía (audio)', '<canción>', (c) => ytFlow(c, { audio: true }), ['musica']),
  cmd('play2', 'Busca en YouTube y envía el video', '<búsqueda>', (c) => ytFlow(c, { audio: false }), ['playvid', 'video']),
  cmd('ytmp3', 'Audio MP3 de YouTube (nombre o enlace)', '<nombre o url>', (c) => ytFlow(c, { audio: true }), ['yta']),
  cmd('ytmp4', 'Video MP4 de YouTube (nombre o enlace)', '<nombre o url>', (c) => ytFlow(c, { audio: false }), ['ytv']),
  cmd('ytmp4hd', 'Video MP4 en 1080p (pesa más)', '<nombre o url>', (c) => ytFlow(c, { audio: false, height: 1080 }), ['ytvhd']),
  cmd('ytmp4low', 'Video MP4 en 360p (liviano)', '<nombre o url>', (c) => ytFlow(c, { audio: false, height: 360 }), ['ytvlow']),

  cmd('yts', 'Buscar videos en YouTube', '<búsqueda>', async (ctx) => {
    if (!ctx.q) return ctx.reply('🔎 Ejemplo: .yts lofi hip hop');
    const res = await yt.search(ctx.q, 6);
    if (!res.length) return ctx.reply('❌ Sin resultados');
    const rows = res.map((v, i) => [`${i + 1}`, v.title, `⏱️ ${dur(v.duration)} · 🎤 ${v.channel}\n│    🔗 ${v.url}`]);
    await sendCard(ctx, res[0].thumb, card('YouTube', rows, `Usa ${ctx.prefix}play <nombre> para descargar 💙`));
  }, ['ytsearch', 'buscar']),

  cmd('ytinfo', 'Información de un video', '<url>', async (ctx) => {
    const link = getLink(ctx);
    if (!link) return ctx.reply('🔗 Pega un enlace.');
    const v = await yt.info(link);
    await sendCard(ctx, v.thumb, card('Información', [
      ['🎵', 'Título', v.title], ['🎤', 'Canal', v.channel], ['⏱️', 'Duración', dur(v.duration)],
      ['👁️', 'Vistas', num(v.views)], ['🔗', 'Enlace', v.url],
    ]));
  }, ['urlinfo']),

  cmd('ytthumb', 'Miniatura de un video', '<url>', async (ctx) => {
    const link = getLink(ctx);
    if (!link) return ctx.reply('🔗 Pega un enlace.');
    const v = await yt.info(link);
    if (!v.thumb) return ctx.reply('❌ Sin miniatura');
    await ctx.sendImage(v.thumb, `🖼️ ${v.title}`);
  }, ['miniatura']),

  cmd('dl', 'Descarga video de cualquier enlace soportado', '<url>', (c) => {
    if (!getLink(c)) return c.reply('🔗 Pega un enlace de video (TikTok, Instagram, Facebook, X, Reddit...).');
    return ytFlow(c, { audio: false, label: 'tu enlace' });
  }, ['descargar', 'download']),

  cmd('dlaudio', 'Descarga solo el audio de cualquier enlace', '<url>', (c) => {
    if (!getLink(c)) return c.reply('🔗 Pega un enlace.');
    return ytFlow(c, { audio: true, label: 'tu enlace' });
  }, ['dla']),

  cmd('spotify', 'Busca en Spotify y manda la canción con portada', '<canción o enlace>', spotifyFlow, ['spoti', 'sp', 'spotifydl']),
  cmd('spotifysearch', 'Busca canciones, artistas y álbumes', '<búsqueda>', spotifySearch, ['spsearch', 'buscarmusica']),

  // ── TikTok con búsqueda por texto ──
  cmd('tiktok', 'TikTok: busca y manda hasta 4 videos en album', '<búsqueda o url>', (c) => tiktokFlow(c, false), ['tt', 'ttdl']),
  cmd('tiktokmp3', 'Audio de TikTok: búsqueda o enlace', '<búsqueda o url>', (c) => tiktokFlow(c, true), ['ttmp3', 'ttaudio']),

  // ── Imágenes ──
  cmd('pinterest', 'Imágenes de Pinterest (album de hasta 10)', '<búsqueda>', (c) => imagesFlow(c, 'Pinterest'), ['pin', 'imagenes']),

  // ── SoundCloud: búsqueda por nombre ──
  cmd('soundcloud', 'Música de SoundCloud: nombre o enlace', '<nombre o url>', (c) => ytFlow(c, { audio: true, prefix: 'scsearch', label: 'SoundCloud' }), ['sc']),
];

// ── Otras plataformas: pegan enlace (no permiten buscar) ──
const platforms = {
  instagram: ['ig', 'insta'], facebook: ['fb'], twitter: ['x', 'tw'], reddit: [], vimeo: [], dailymotion: ['dm'],
  twitch: [], bilibili: [], likee: [], streamable: [], bandcamp: [], mixcloud: [], tumblr: [], rumble: [], odysee: [],
  vk: [], imgur: [], '9gag': [],
};
for (const [name, aliases] of Object.entries(platforms)) {
  const label = name[0].toUpperCase() + name.slice(1);
  const need = (c) => c.reply(`🔗 Pega el enlace de ${label} (o responde a un mensaje que lo tenga).\nEjemplo: ${c.prefix}${name} https://...`);
  list.push(
    cmd(name, `Descarga video de ${label}`, '<url>', (c) => (getLink(c) ? ytFlow(c, { audio: false, label }) : need(c)), aliases),
    cmd(`${name}mp3`, `Descarga el audio de ${label}`, '<url>', (c) => (getLink(c) ? ytFlow(c, { audio: true, label }) : need(c)))
  );
}

module.exports = list;
