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

function safeMusicName(title, artist) {
  const base = [title, artist].filter(Boolean).join(' - ') || 'musica';
  return String(base)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'musica';
}

// Música: portada + audio con nombre real (se guarda en el telefono con ese nombre, no AUD-xxxxx)
async function toOpusPtt(mp3Buf) {
  const fs = require('fs');
  const path = require('path');
  const { execFile } = require('child_process');
  const os = require('os');
  const inFile = path.join(os.tmpdir(), 'snx_' + Date.now() + '_in.mp3');
  const outFile = path.join(os.tmpdir(), 'snx_' + Date.now() + '_out.ogg');
  try {
    fs.writeFileSync(inFile, mp3Buf);
    await new Promise((resolve, reject) => {
      execFile('ffmpeg', [
        '-y', '-i', inFile,
        '-c:a', 'libopus', '-b:a', '96k',
        '-vn', '-f', 'ogg', outFile,
      ], { timeout: 90000 }, (err) => (err ? reject(err) : resolve()));
    });
    const out = fs.readFileSync(outFile);
    if (out && out.length > 1000) return out;
  } catch (e) {
    console.error('toOpusPtt:', e && e.message ? e.message : e);
  } finally {
    try { fs.unlinkSync(inFile); } catch {}
    try { fs.unlinkSync(outFile); } catch {}
  }
  return null;
}

async function sendMusic(ctx, { file, buffer, title, artist, thumb }) {
  const { sock, from, m } = ctx;
  const fs = require('fs');
  const name = safeMusicName(title, artist);
  const cap = [
    '   ❀ 𓆩 ' + sans('musica') + ' 𓆪 ❀',
    '',
    '  ✦ Titulo   ── ' + (title || name),
    artist ? ('  ✦ Artista  ── ' + artist) : '',
    '',
    '   ❀',
  ].filter(Boolean).join('\n');

  let audioBuf = buffer;
  if (!audioBuf && file) {
    try { audioBuf = fs.readFileSync(file); } catch (e) {
      console.error('sendMusic read:', e && e.message ? e.message : e);
    }
  }
  if (!audioBuf || audioBuf.length < 2000) {
    return ctx.reply(wrap('No pude leer el audio.', 'musica'));
  }

  let thumbBuf = null;
  if (thumb) {
    try {
      thumbBuf = Buffer.isBuffer(thumb)
        ? thumb
        : await U.getBuffer(thumb, { timeout: 12000, maxContentLength: 2 * 1024 * 1024 });
      if (thumbBuf && thumbBuf.length < 1000) thumbBuf = null;
    } catch { thumbBuf = null; }
  }

  // Portada + info
  if (thumbBuf) {
    await sock.sendMessage(from, { image: thumbBuf, caption: cap }, { quoted: m }).catch(() => {});
  } else {
    await ctx.reply(cap).catch(() => {});
  }

  // Solo nota de voz (opus). Si no se puede convertir, audio normal (escuchable).
  try {
    const opus = await toOpusPtt(audioBuf);
    if (opus) {
      await sock.sendMessage(from, {
        audio: opus,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      }, { quoted: m });
      return;
    }
  } catch (e) {
    console.error('sendMusic ptt:', e && e.message ? e.message : e);
  }

  try {
    await sock.sendMessage(from, {
      audio: audioBuf,
      mimetype: 'audio/mpeg',
      ptt: false,
    }, { quoted: m });
  } catch (e) {
    console.error('sendMusic mp3:', e && e.message ? e.message : e);
    return ctx.reply(wrap('Fallo al enviar el audio.', 'musica'));
  }
}

// Envía un archivo local (yt-dlp) o una URL directa
async function sendFileOrUrl(ctx, src, audio, title, extra = {}) {
  const { sock, from, m } = ctx;
  if (audio) {
    let buffer = null;
    if (!src.file && src.url) {
      buffer = await U.getBuffer(src.url, { timeout: 90000, maxContentLength: MAX(), headers: { 'User-Agent': 'Mozilla/5.0' } });
    }
    return sendMusic(ctx, {
      file: src.file,
      buffer,
      title: extra.title || title || 'musica',
      artist: extra.artist || '',
      thumb: extra.thumb || null,
    });
  }
  let content;
  if (src.file) {
    content = { video: { url: src.file }, mimetype: 'video/mp4', caption: String(title || '').slice(0, 200), fileName: safeMusicName(title) + '.mp4' };
  } else {
    const buf = await U.getBuffer(src.url, { timeout: 90000, maxContentLength: MAX(), headers: { 'User-Agent': 'Mozilla/5.0' } });
    content = { video: buf, mimetype: 'video/mp4', caption: String(title || '').slice(0, 200) };
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
    if (audio) {
      await sendMusic(ctx, {
        file: d.file,
        title: v.title || q || 'musica',
        artist: v.channel || v.artist || '',
        thumb: v.thumb || v.thumbnail || null,
      });
    } else {
      const cap = [
        '   ❀ 𓆩 ' + sans('video') + ' 𓆪 ❀',
        '',
        '  ✦ Titulo   ── ' + (v.title || ''),
        v.channel ? ('  ✦ Canal    ── ' + v.channel) : '',
        v.duration ? ('  ✦ Duracion ── ' + dur(v.duration)) : '',
        '',
        '   ❀',
      ].filter(Boolean).join('\n');
      await ctx.sock.sendMessage(ctx.from, {
        video: { url: d.file },
        mimetype: 'video/mp4',
        caption: cap,
        fileName: safeMusicName(v.title || 'video') + '.mp4',
      }, { quoted: ctx.m });
    }
    await ctx.react('✅');
  } finally {
    d.cleanup();
  }
}


// ── Spotify: busca la canción (portada y datos) y manda el audio completo ──
async function spotifyFlow(ctx) {
  let q = getQuery(ctx);
  const link = getLink(ctx);
  if (link && /spotify\.com/i.test(link)) q = (await music.fromSpotifyLink(link)) || q;
  if (!q) return ctx.reply(wrap('Dime el nombre de la cancion.\nEjemplo: ' + ctx.prefix + 'spotify bad bunny', 'spotify'));
  await ctx.react('🔎');
  const t0 = await music.searchSpotify(q);
  if (!t0) return ctx.reply(wrap('No encontre eso en Spotify.', 'spotify'));
  const yq = (t0.artist ? t0.artist + ' ' : '') + t0.title + ' audio';
  const [yv] = await yt.search(yq, 1);
  if (!yv) return ctx.reply(wrap('Encontre la cancion pero no pude conseguir el audio.', 'spotify'));
  const d = await yt.download(yv.url, { audio: true });
  try {
    await sendMusic(ctx, {
      file: d.file,
      title: t0.title || yv.title,
      artist: t0.artist || yv.channel || '',
      thumb: t0.cover || yv.thumb || null,
    });
    await ctx.react('✅');
  } finally {
    try { d.cleanup && d.cleanup(); } catch {}
  }
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
        timeout: 60000,
        maxContentLength: 55 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
          Referer: 'https://www.tiktok.com/',
        },
      });
      if (buf && buf.length > 5000) return buf;
    } catch (e) {
      console.error('tt direct:', e && e.message ? e.message : e);
    }
    return null;
  }

  async function resolveOne(pageUrl, direct) {
    // 1) CDN directo (rapido, sin marca)
    let buf = await bufFromDirect(direct);
    if (buf) return buf;
    // 2) tikwm por URL de pagina
    if (pageUrl) {
      try {
        const v = await social.tiktokByUrl(pageUrl);
        if (v && v.video) {
          buf = await bufFromDirect(v.video);
          if (buf) return { buf: buf, meta: v };
        }
      } catch (e) {
        console.error('tt tikwm:', e && e.message ? e.message : e);
      }
    }
    // 3) yt-dlp
    if (pageUrl) {
      try {
        const got = await ytdlp.download(pageUrl, { audio: audioOnly, height: 480, maxMB: 45, maxDuration: 240 });
        try {
          buf = fs.readFileSync(got.file);
          if (buf && buf.length > 5000) return { buf: buf, meta: { title: pageUrl } };
        } finally {
          try { got.cleanup(); } catch (e) {}
        }
      } catch (e) {
        console.error('tt ytdlp:', e && e.message ? e.message : e);
      }
    }
    return null;
  }

  if (link) {
    await ctx.react('⏳');
    const got = await resolveOne(link, null);
    if (!got) return ctx.reply(wrap('No pude descargar ese TikTok.\nPrueba otro enlace o actualiza yt-dlp:\npip install -U yt-dlp', 'tiktok'));
    const buf = Buffer.isBuffer(got) ? got : got.buf;
    const v = Buffer.isBuffer(got) ? {} : (got.meta || {});
    const cap = [
      '   ❀ 𓆩 ' + sans('tiktok') + ' 𓆪 ❀',
      '',
      '  ✦ ' + String(v.title || 'TikTok').slice(0, 100),
      v.author ? ('  ✦ Autor ── ' + v.author) : '',
      '  ✦ Sin marca de agua',
      '',
      '   ❀',
    ].filter(Boolean).join('\n');
    if (audioOnly) {
      await sendMusic(ctx, {
        buffer: buf,
        title: (v && v.title) || 'TikTok',
        artist: (v && (v.author || v.user)) || '',
        thumb: (v && (v.cover || v.thumb)) || null,
      });
    } else {
      await ctx.sock.sendMessage(ctx.from, { video: buf, caption: cap, mimetype: 'video/mp4' }, { quoted: ctx.m });
    }
    await ctx.react('✅');
    return;
  }

  // Busqueda
  let list = [];
  try {
    list = await social.tiktokSearch(q, 8);
  } catch (e) {
    console.error('tt search social:', e && e.message ? e.message : e);
  }
  if (!list.length) {
    try {
      const hits = await ytdlp.tiktokSearch(q, 6);
      list = (hits || []).map(function (h) {
        return { title: h.title, author: h.channel || '', url: h.url, video: null };
      });
    } catch (e) {
      console.error('tt search ytdlp:', e && e.message ? e.message : e);
    }
  }
  if (!list.length) {
    return ctx.reply(wrap('Sin resultados para: *' + q + '*\nPrueba otras palabras o un enlace.', 'tiktok'));
  }

  // Relevancia
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
  const ok = [];
  // Secuencial: tikwm limita 1 req/s
  for (let i = 0; i < list.length && ok.length < 4; i++) {
    const v = list[i];
    let pageUrl = v.url || '';
    if (!pageUrl && v.user && v.id) pageUrl = 'https://www.tiktok.com/@' + v.user + '/video/' + v.id;
    try {
      const got = await resolveOne(pageUrl, v.video);
      if (!got) continue;
      const buf = Buffer.isBuffer(got) ? got : got.buf;
      const meta = Buffer.isBuffer(got) ? v : Object.assign({}, v, got.meta || {});
      ok.push({ video: buf, mimetype: 'video/mp4', meta: meta });
    } catch (e) {
      console.error('tt item:', e && e.message ? e.message : e);
    }
    if (ok.length < 4 && i < list.length - 1) await U.sleep(900);
  }

  if (!ok.length) {
    return ctx.reply(wrap('Encontre resultados pero no pude bajar los videos.\nPrueba: ' + ctx.prefix + 'tt <enlace de tiktok>', 'tiktok'));
  }

  const cap = [
    '   ❀ 𓆩 ' + sans('tiktok') + ' 𓆪 ❀',
    '',
    '  ✦ Busqueda   ── ' + q,
    '  ✦ Resultados ── ' + ok.length + ' videos',
    '  ✦ Sin marca',
    '',
    '   ❀',
  ].join('\n');

  // Intentar album; si no, UN solo video con la info (sin regar el chat)
  let albumOk = false;
  try { albumOk = await sendMediaAlbum(ctx, ok, cap); } catch (e) { albumOk = false; }
  if (!albumOk) {
    await ctx.sock.sendMessage(ctx.from, {
      video: ok[0].video,
      caption: cap,
      mimetype: 'video/mp4',
    }, { quoted: ctx.m });
  }
  await ctx.react('✅');
}

// ── Pinterest / imágenes: .pinterest gatos 5  (máx. 10, por defecto 7) ──
// Collage: una sola imagen con todas (si el album nativo falla)
async function makeCollage(buffers) {
  const Jimp = require('jimp');
  const n = Math.min(buffers.length, 10);
  if (n === 1) return buffers[0];
  // Grid limpio tipo album (2x2, 3x3, 2x5...)
  const cols = n <= 4 ? 2 : n <= 6 ? 3 : n <= 9 ? 3 : 5;
  const rows = Math.ceil(n / cols);
  const cell = 480; // buena calidad
  const gap = 6;
  const canvas = new Jimp(cols * cell + gap * (cols + 1), rows * cell + gap * (rows + 1), 0x111111ff);
  for (let i = 0; i < n; i++) {
    try {
      const img = await Jimp.read(buffers[i]);
      img.cover(cell, cell);
      const x = gap + (i % cols) * (cell + gap);
      const y = gap + Math.floor(i / cols) * (cell + gap);
      canvas.composite(img, x, y);
    } catch (e) {
      console.error('collage cell:', e && e.message ? e.message : e);
    }
  }
  return canvas.quality(92).getBufferAsync(Jimp.MIME_JPEG);
}

// Album nativo WhatsApp: VARIAS fotos completas en UN solo bloque (grid arriba + caption)
async function sendMediaAlbum(ctx, items, caption) {
  if (!items || !items.length) return false;
  const sock = ctx.sock;
  const jid = ctx.from;
  const cap = String(caption || '');
  const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
  const { randomBytes } = require('crypto');
  const Jimp = require('jimp');

  // Normalizar a JPEG limpio (evita fallos de asociacion)
  const medias = [];
  for (const it of items) {
    if (it.video && it.video.length > 2000) {
      medias.push({ type: 'video', data: it.video, mimetype: it.mimetype || 'video/mp4' });
      continue;
    }
    if (it.image && it.image.length > 500) {
      try {
        const img = await Jimp.read(it.image);
        if (img.bitmap.width > 1280) img.resize(1280, Jimp.AUTO);
        const buf = await img.quality(88).getBufferAsync(Jimp.MIME_JPEG);
        medias.push({ type: 'image', data: buf });
      } catch {
        medias.push({ type: 'image', data: it.image });
      }
    }
  }
  if (!medias.length) return false;

  const nImg = medias.filter((m) => m.type === 'image').length;
  const nVid = medias.filter((m) => m.type === 'video').length;

  try {
    // Padre album
    const album = generateWAMessageFromContent(jid, {
      albumMessage: {
        expectedImageCount: nImg,
        expectedVideoCount: nVid,
      },
    }, { userJid: sock.user.id });

    // Asegurar key de grupo
    album.key = {
      remoteJid: jid,
      fromMe: true,
      id: album.key.id,
    };

    await sock.relayMessage(jid, album.message, { messageId: album.key.id });
    await U.sleep(500);

    for (let i = 0; i < medias.length; i++) {
      const m = medias[i];
      const isVid = m.type === 'video';
      const prepared = await prepareWAMessageMedia(
        isVid ? { video: m.data } : { image: m.data },
        { upload: sock.waUploadToServer }
      );
      const field = isVid ? 'videoMessage' : 'imageMessage';
      const body = { ...prepared[field] };
      if (i === 0 && cap) body.caption = cap;
      if (isVid) body.mimetype = m.mimetype || 'video/mp4';

      body.contextInfo = {
        messageAssociation: {
          associationType: 1, // MEDIA_ALBUM
          parentMessageKey: {
            remoteJid: jid,
            fromMe: true,
            id: album.key.id,
          },
        },
      };

      const child = generateWAMessageFromContent(jid, { [field]: body }, { userJid: sock.user.id });
      child.key = {
        remoteJid: jid,
        fromMe: true,
        id: child.key.id,
      };

      await sock.relayMessage(jid, child.message, { messageId: child.key.id });
      // Delay para que el cliente arme el grid (como en el video: 1 foto, 2 fotos...)
      if (i < medias.length - 1) await U.sleep(650);
    }
    return true;
  } catch (e) {
    console.error('album fail:', e && e.message ? e.message : e);
    return false;
  }
}

async function sendAlbum(ctx, items, caption) {
  return sendMediaAlbum(ctx, items, caption);
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
    '  ✦ Busqueda    ── ' + q,
    '  ✦ Resultados  ── ' + imgs.length,
    '',
    '   ❀',
  ].join('\n');

  await ctx.react('⏳');
  const items = imgs.map((buf) => ({ image: buf }));

  // Album nativo: todas las fotos completas en UN bloque arriba
  let ok = await sendMediaAlbum(ctx, items, cap);
  if (!ok) {
    await U.sleep(800);
    ok = await sendMediaAlbum(ctx, items, cap);
  }
  if (!ok) {
    // Ultimo recurso: collage (1 mensaje) — nunca imagenes sueltas
    try {
      const collage = await makeCollage(imgs);
      await ctx.sock.sendMessage(ctx.from, { image: collage, caption: cap }, { quoted: ctx.m });
    } catch (e) {
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
