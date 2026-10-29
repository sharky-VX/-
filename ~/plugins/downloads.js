const yt = require('../lib/ytdlp');
const social = require('../lib/social');
const U = require('../lib/utils');
const config = require('../config');
const { card } = require('../lib/deco');
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
  if (!link && !q) return ctx.reply(`🎵 Dime qué buscar o pega un enlace.\nEjemplo: ${ctx.prefix}${ctx.command} gatitos graciosos`);
  await ctx.react('🔎');
  let v = null;
  try {
    v = link ? await social.tiktokByUrl(link) : (await social.tiktokSearch(q, 5))[0];
  } catch (e) {
    if (!link) throw e;
    // con enlace, si la API falla, usa yt-dlp
    return ytFlow(ctx, { audio: audioOnly, label: 'TikTok' });
  }
  await ctx.react('⏳');
  const cap = card(audioOnly ? 'TikTok · Audio' : 'TikTok · Video', [
    ['📝', 'Título', (v.title || '').slice(0, 120)],
    ['🎤', 'Autor', `${v.author}${v.user ? ' (@' + v.user + ')' : ''}`],
    ['⏱️', 'Duración', v.duration ? dur(v.duration) : ''],
    ['👁️', 'Vistas', num(v.plays)],
    ['❤️', 'Likes', num(v.likes)],
    ['💬', 'Comentarios', num(v.comments)],
    ['🎼', 'Sonido', v.musicTitle],
    ['🔗', 'Enlace', v.url],
  ], audioOnly ? 'Aquí va el audio 💙' : 'Aquí va tu video sin marca de agua 💙');
  await sendCard(ctx, v.cover, cap);
  if (audioOnly) await sendFileOrUrl(ctx, { url: v.audio }, true, v.musicTitle || v.title);
  else await sendFileOrUrl(ctx, { url: v.video }, false, v.title);
  await ctx.react('✅');
}

// ── Pinterest / imágenes: .pinterest gatos 5  (máx. 10, por defecto 7) ──
async function imagesFlow(ctx, source) {
  const link = getLink(ctx);
  if (link) return ytFlow(ctx, { audio: false, label: source }); // pin con video
  const args = [...ctx.args];
  let n = config.imagesDefault || 7;
  if (/^\d{1,2}$/.test(args[args.length - 1] || '')) n = parseInt(args.pop());
  n = U.clamp(n, 1, config.imagesMax || 10);
  const q = args.join(' ').trim();
  if (!q) return ctx.reply(`🖼️ Dime qué imágenes quieres.\nEjemplo: ${ctx.prefix}${ctx.command} gatos aesthetic ${n}`);
  await ctx.react('🔎');
  const imgs = await social.imageSearch(q, n);
  const cap = card(source, [
    ['🔎', 'Búsqueda', q],
    ['🖼️', 'Imágenes', `${imgs.length}`],
  ], `Aquí tienes tus imágenes 💙`);
  for (let i = 0; i < imgs.length; i++) {
    await ctx.sendImage(imgs[i], i === 0 ? cap : `💙 ${i + 1}/${imgs.length}`);
    if (i < imgs.length - 1) await U.sleep(700);
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
  cmd('tiktok', 'Video de TikTok: escribe lo que quieres o pega el enlace', '<búsqueda o url>', (c) => tiktokFlow(c, false), ['tt', 'ttdl']),
  cmd('tiktokmp3', 'Audio de TikTok: búsqueda o enlace', '<búsqueda o url>', (c) => tiktokFlow(c, true), ['ttmp3', 'ttaudio']),

  // ── Imágenes ──
  cmd('pinterest', 'Imágenes de Pinterest (7 por defecto, máx. 10)', '<búsqueda> [cantidad]', (c) => imagesFlow(c, 'Pinterest'), ['pin', 'imagenes']),

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
