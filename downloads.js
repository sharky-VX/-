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
    return ctx.reply('Dime que buscar o pega un enlace.\nEjemplo: ' + ctx.prefix + 'tt videos de carros');
  }
  await ctx.react('🔎');

  async function dlVideo(url) {
    if (!url) return null;
    try {
      const buf = await U.getBuffer(url, {
        timeout: 90000,
        maxContentLength: 50 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.tiktok.com/' },
      });
      if (buf && buf.length > 2000) return buf;
    } catch (e) {
      console.error('tt getBuffer:', e?.message || e);
    }
    return null;
  }

  // Enlace unico
  if (link) {
    let v = null;
    try { v = await social.tiktokByUrl(link); } catch (e) {
      console.error('tt byurl:', e?.message || e);
      try { return await ytFlow(ctx, { audio: audioOnly, label: 'TikTok' }); } catch (e2) {
        return ctx.reply(wrap('No pude bajar ese TikTok. Revisa el enlace.', 'tiktok'));
      }
    }
    await ctx.react('⏳');
    if (audioOnly) {
      const buf = await dlVideo(v.audio || v.video);
      if (!buf) return ctx.reply('No pude bajar el audio.');
      const cap = card('tiktok', ['Audio', String(v.title || '').slice(0, 100)]);
      await ctx.sock.sendMessage(ctx.from, { audio: buf, mimetype: 'audio/mpeg', ptt: false }, { quoted: ctx.m }).catch(async () => {
        await ctx.sock.sendMessage(ctx.from, { document: buf, mimetype: 'audio/mpeg', fileName: 'tiktok.mp3', caption: cap }, { quoted: ctx.m });
      });
      await ctx.react('✅');
      return;
    }
    const buf = await dlVideo(v.video);
    if (!buf) {
      try { return await ytFlow(ctx, { audio: false, label: 'TikTok' }); } catch {
        return ctx.reply('Encontre el video pero no pude descargarlo.');
      }
    }
    const cap = card('tiktok', [
      String(v.title || '').slice(0, 120),
      'Autor ── ' + (v.author || '') + (v.user ? ' (@' + v.user + ')' : ''),
      v.plays != null ? 'Vistas ── ' + num(v.plays) : '',
      v.url ? String(v.url) : '',
    ].filter(Boolean));
    await ctx.sock.sendMessage(ctx.from, { video: buf, caption: cap, mimetype: 'video/mp4' }, { quoted: ctx.m });
    await ctx.react('✅');
    return;
  }

  // Busqueda texto: hasta 4 videos
  let list = [];
  try {
    list = await social.tiktokSearch(q, 4);
  } catch (e) {
    console.error('tt search:', e?.message || e);
    // Fallback yt-dlp search tiktok
    try {
      const ytdlp = require('../lib/ytdlp');
      if (ytdlp && ytdlp.search) {
        const hits = await ytdlp.search('tiktok ' + q, 4);
        list = (hits || []).map((h) => ({ title: h.title, author: h.channel, video: null, url: h.url, _yt: true }));
      }
    } catch (e2) {
      console.error('tt ytdlp search:', e2?.message || e2);
    }
  }
  if (!list.length) return ctx.reply(wrap('Sin resultados para: ' + q, 'tiktok'));

  await ctx.react('⏳');
  const items = [];
  const infos = [];
  for (const v of list.slice(0, 4)) {
    try {
      let buf = null;
      if (v.video) buf = await dlVideo(v.video);
      if (!buf && v.url) {
        try {
          const got = await require('../lib/ytdlp').download(v.url, { audio: false });
          if (got && got.file) {
            buf = require('fs').readFileSync(got.file);
            try { got.cleanup && got.cleanup(); } catch {}
          }
        } catch {}
      }
      if (buf && buf.length > 2000) {
        items.push({ video: buf });
        infos.push(v);
      }
    } catch (e) {
      console.error('tt item:', e?.message || e);
    }
  }
  if (!items.length) return ctx.reply(wrap('Encontre resultados pero no pude descargar. Prueba un enlace directo.', 'tiktok'));

  const cap = card('tiktok', [
    'Busqueda ── ' + q,
    'Videos ── ' + items.length + ' (max 4)',
    ...infos.map((v, i) => (i + 1) + '. ' + String(v.title || 'video').slice(0, 45)),
  ]);

  const ok = await sendAlbum(ctx, items, cap);
  if (!ok) {
    await ctx.sock.sendMessage(ctx.from, { video: items[0].video, caption: cap, mimetype: 'video/mp4' }, { quoted: ctx.m });
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

  // 1) Album nativo (WhatsApp media group)
  try {
    const { generateWAMessageFromContent, generateWAMessage, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
    const { randomBytes } = require('crypto');
    const imageItems = items.filter((x) => !x.video);
    const videoItems = items.filter((x) => x.video);

    if (imageItems.length >= 1 && videoItems.length === 0) {
      const albumContent = generateWAMessageFromContent(from, {
        albumMessage: {
          expectedImageCount: imageItems.length,
          expectedVideoCount: 0,
        },
      }, {});
      await sock.relayMessage(from, albumContent.message, { messageId: albumContent.key.id });

      for (let i = 0; i < imageItems.length; i++) {
        const buf = imageItems[i].image || imageItems[i];
        const media = await prepareWAMessageMedia({ image: buf }, { upload: sock.waUploadToServer });
        const imgNode = media.imageMessage;
        if (i === 0 && cap) imgNode.caption = cap;
        imgNode.contextInfo = {
          ...(imgNode.contextInfo || {}),
          messageAssociation: {
            associationType: 1,
            parentMessageKey: albumContent.key,
          },
        };
        const msg = generateWAMessageFromContent(from, { imageMessage: imgNode }, {});
        await sock.relayMessage(from, msg.message, { messageId: msg.key.id });
        await U.sleep(200);
      }
      return true;
    }

    // Videos: intentar prop album
    if (videoItems.length) {
      await sock.sendMessage(from, {
        album: videoItems.map((it, i) => ({
          video: it.video,
          ...(i === 0 && cap ? { caption: cap } : {}),
        })),
      }, { quoted });
      return true;
    }
  } catch (e) {
    console.error('album nativo:', e?.message || e);
  }

  // 2) Prop album directo
  try {
    await sock.sendMessage(from, {
      album: items.map((it, i) => {
        if (it.video) return { video: it.video, ...(i === 0 && cap ? { caption: cap } : {}) };
        return { image: it.image || it, ...(i === 0 && cap ? { caption: cap } : {}) };
      }),
    }, { quoted });
    return true;
  } catch (e) {
    console.error('album prop:', e?.message || e);
  }

  // 3) Collage = UNA sola imagen con todas (no spam)
  try {
    const bufs = items.map((it) => it.image || it.video || it).filter((b) => Buffer.isBuffer(b));
    if (!bufs.length) return false;
    // Si hay videos, manda solo el primero con caption (no 4 sueltos)
    if (items.some((x) => x.video)) {
      await sock.sendMessage(from, { video: items[0].video, caption: cap, mimetype: 'video/mp4' }, { quoted });
      return true;
    }
    const collage = await makeCollage(bufs);
    await sock.sendMessage(from, { image: collage, caption: cap }, { quoted });
    return true;
  } catch (e) {
    console.error('collage:', e?.message || e);
    return false;
  }
}

async function imagesFlow(ctx, source) {
  const link = getLink(ctx);
  if (link) return ytFlow(ctx, { audio: false, label: source });
  const args = [...ctx.args];
  let n = 10;
  if (/^\d{1,2}$/.test(args[args.length - 1] || '')) n = parseInt(args.pop());
  n = U.clamp(n, 1, 10);
  const q = args.join(' ').trim();
  if (!q) return ctx.reply(wrap('Dime que buscar.\nEjemplo: ' + ctx.prefix + 'pin anime aesthetic', 'pinterest'));
  await ctx.react('🔎');
  const imgs = await social.imageSearch(q, n);
  const cap = card('pinterest', [
    'Busqueda ── ' + q,
    'Resultados ── ' + imgs.length + ' imagenes',
    'Estado ── Barrido exitoso',
  ]);
  const items = imgs.map((buf) => ({ image: buf }));
  const ok = await sendAlbum(ctx, items, cap);
  if (!ok) return ctx.reply(wrap('No pude enviar las imagenes. Intenta de nuevo.', 'pinterest'));
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
