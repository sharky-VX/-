// ═══════════════════════════════════════════════
//  NSFW oculto (.menu2) — SHARKNEX
//  Reacciones GIF + buscadores 10 links + botones + descarga
// ═══════════════════════════════════════════════
const axios = require('axios');
const fs = require('fs');
const U = require('../lib/utils');
const media = require('../lib/media');
const db = require('../lib/db');
const config = require('../config');
const { sans, C } = require('../lib/deco');
const { registry } = require('../lib/loader');
const yt = require('../lib/ytdlp');

const mk = (name, desc, usage, run, aliases = []) => ({
  name, aliases, desc, usage, category: 'nsfw', hidden: true, run,
});

const tag = (j) => '@' + String(j).split('@')[0].split(':')[0];
const pendingNsfw = new Map();

const nsfwGifCache = new Map();
async function sendAnimated(c, url, text, mentions = []) {
  const { sock, from, m } = c;
  const u = String(url || '');
  if (/\.mp4(\?|$)/i.test(u)) {
    try {
      const b = await U.getBuffer(u, { timeout: 20000 });
      return sock.sendMessage(from, { video: b, caption: text, gifPlayback: true, mimetype: 'video/mp4', mentions }, { quoted: m });
    } catch {}
  }
  if (nsfwGifCache.has(u)) {
    return sock.sendMessage(from, { video: nsfwGifCache.get(u), caption: text, gifPlayback: true, mimetype: 'video/mp4', mentions }, { quoted: m });
  }
  let buf;
  try { buf = await U.getBuffer(u, { timeout: 15000 }); }
  catch { throw new Error('No pude descargar el media.'); }
  let mp4 = null;
  try { mp4 = await media.toMp4Fast(buf, 'gif'); }
  catch { try { mp4 = await media.toMp4(buf, 'gif'); } catch {} }
  if (mp4) {
    if (nsfwGifCache.size >= 80) nsfwGifCache.delete(nsfwGifCache.keys().next().value);
    nsfwGifCache.set(u, mp4);
    return sock.sendMessage(from, { video: mp4, caption: text, gifPlayback: true, mimetype: 'video/mp4', mentions }, { quoted: m });
  }
  try {
    return await sock.sendMessage(from, { image: buf, mimetype: 'image/gif', caption: text, mentions }, { quoted: m });
  } catch {
    return sock.sendMessage(from, { text: text + '\n\n(No pude animar el GIF)', mentions }, { quoted: m });
  }
}

async function sendMedia(c, url, caption, mentions = [], forceGif = false) {
  if (!url || !String(url).startsWith('http')) throw new Error('Sin contenido.');
  // Preferir siempre GIF animado (como el bot del ejemplo)
  if (forceGif || /\.(gif|webm|mp4)(\?|$)/i.test(url) || /gif|nekobot|waifu|rule34/i.test(url)) {
    try { return await sendAnimated(c, url, caption, mentions); } catch (e) {
      console.error('sendAnimated fail:', e.message || e);
    }
  }
  try {
    const buf = await U.getBuffer(url, { timeout: 35000 });
    // Ultimo intento: convertir cualquier imagen a "gif" mp4
    if (forceGif) {
      try { return await sendAnimated(c, url, caption, mentions); } catch {}
    }
    return await c.sock.sendMessage(c.from, { image: buf, caption, mentions }, { quoted: c.m });
  } catch (e) {
    return c.sock.sendMessage(c.from, { text: caption + '\n\n(No pude cargar el media)', mentions }, { quoted: c.m });
  }
}

async function tryUrl(fn) {
  try {
    const u = await fn();
    if (u && String(u).startsWith('http')) return u;
  } catch {}
  return null;
}

async function listMediaLinks(tags, n) {
  n = n || 10;
  const out = [];
  const tries = [tags, (tags || '') + ' video', (tags || '') + ' animated', 'maplestar'];
  const seen = new Set();
  for (const tagQ of tries) {
    if (!tagQ || out.length >= n) break;
    try {
      const { data } = await axios.get('https://api.rule34.xxx/index.php', {
        params: { page: 'dapi', s: 'post', q: 'index', json: 1, limit: Math.max(n * 2, 20), tags: String(tagQ).trim() },
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 25000,
      });
      if (!Array.isArray(data)) continue;
      for (const p of data) {
        if (out.length >= n) break;
        const u = p.file_url || p.sample_url;
        if (!u || seen.has(u)) continue;
        seen.add(u);
        out.push({
          title: String(p.tags || tagQ || 'media').split(' ').slice(0, 5).join(' '),
          url: u,
          sample: p.sample_url || u,
        });
      }
    } catch (e) { console.error('listMediaLinks', tagQ, e.message || e); }
  }
  return out;
}

const SRC = {
  // Anime/hentai GIF que SÍ responden (purrbot.site)
  // GET https://purrbot.site/api/img/nsfw/<cat>/gif → { link }
  purr: async (cat) => {
    const d = await U.getJson('https://purrbot.site/api/img/nsfw/' + cat + '/gif');
    if (d?.error) throw new Error('purrbot error');
    return d?.link || d?.url;
  },
  // SFW purrbot por si hace falta fallback visual anime
  purrSfw: async (cat) => {
    const d = await U.getJson('https://purrbot.site/api/img/sfw/' + cat + '/gif');
    return d?.link || d?.url;
  },
};

async function getNsfw() {
  const fns = Array.prototype.slice.call(arguments);
  let last = '';
  for (let i = 0; i < fns.length; i++) {
    try {
      const u = await fns[i]();
      if (u && String(u).startsWith('http')) return u;
    } catch (e) {
      last = U.friendlyError(e);
      console.error('NSFW API', i, last);
    }
  }
  throw new Error(last || 'Ninguna API de anime/hentai respondio. Revisa internet e intenta de nuevo.');
}

async function searchXnxx(query, limit) {
  limit = limit || 10;
  const links = [];
  const seen = new Set();

  // 1) yt-dlp xnxxsearch (titulos reales)
  try {
    const rows = await yt.search(query, limit, 'xnxxsearch').catch(() => []);
    for (const r of rows || []) {
      if (!r.url || seen.has(r.url)) continue;
      if (!/xnxx\.com/i.test(r.url)) continue;
      seen.add(r.url);
      links.push({
        title: String(r.title || 'Video').replace(/\s+/g, ' ').trim().slice(0, 80),
        url: r.url,
        duration: r.duration || '',
        quality: r.height ? (r.height + 'p') : '720p',
      });
    }
  } catch (e) { console.error('xnxx ytdlp:', e?.message || e); }

  // 2) Scrape HTML xnxx
  if (links.length < limit) {
    try {
      const { data: html } = await axios.get('https://www.xnxx.com/search/' + encodeURIComponent(query), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 25000,
        responseType: 'text',
      });
      const h = String(html);
      // bloques thumb-block
      const blockRe = /<div[^>]*class="[^"]*thumb-block[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
      let bm;
      while ((bm = blockRe.exec(h)) && links.length < limit) {
        const block = bm[1];
        const href = block.match(/href="(\/video-[^"]+)"/i);
        if (!href) continue;
        const url = 'https://www.xnxx.com' + href[1].split('#')[0];
        if (seen.has(url)) continue;
        seen.add(url);
        let title = '';
        const t1 = block.match(/title="([^"]{3,120})"/i);
        const t2 = block.match(/<a[^>]+href="\/video-[^"]+"[^>]*>\s*([^<]{3,120})\s*</i);
        title = (t1 && t1[1]) || (t2 && t2[1]) || '';
        title = title.replace(/\s+/g, ' ').trim();
        if (!title || /^xnxx$/i.test(title)) {
          // slug from url
          const slug = href[1].split('/').pop() || '';
          title = decodeURIComponent(slug).replace(/[-_]+/g, ' ').slice(0, 80) || 'Video xnxx';
        }
        let duration = '';
        const d1 = block.match(/(\d{1,2}\s*min(?:\s*\d{1,2}\s*sec)?)/i);
        const d2 = block.match(/data-duration="(\d+)"/i);
        if (d1) duration = d1[1].replace(/\s+/g, ' ');
        else if (d2) duration = Number(d2[1]);
        let quality = '';
        const q1 = block.match(/(\d{3,4})p/i);
        if (q1) quality = q1[1] + 'p';
        links.push({ title: title.slice(0, 80), url, duration, quality: quality || '720p' });
      }
      // fallback regex simple
      if (links.length < 3) {
        const re = /href="(\/video-[a-z0-9]+\/[^"]+)"[^>]*title="([^"]+)"/gi;
        let m;
        while ((m = re.exec(h)) && links.length < limit) {
          const url = 'https://www.xnxx.com' + m[1];
          if (seen.has(url)) continue;
          seen.add(url);
          links.push({ title: m[2].replace(/\s+/g, ' ').trim().slice(0, 80), url, duration: '', quality: '720p' });
        }
      }
    } catch (e) { console.error('xnxx html:', e?.message || e); }
  }
  return links.slice(0, limit);
}

async function searchXvideos(query, limit) {
  limit = limit || 10;
  const links = [];
  const seen = new Set();
  try {
    const rows = await yt.search(query, limit, 'xvideossearch').catch(() => []);
    for (const r of rows || []) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      links.push({
        title: String(r.title || 'Video').slice(0, 80),
        url: r.url,
        duration: r.duration || '',
        quality: r.height ? (r.height + 'p') : '720p',
      });
    }
  } catch (e) { console.error('xvideos ytdlp:', e?.message || e); }
  if (links.length < limit) {
    try {
      const { data: html } = await axios.get('https://www.xvideos.com/?k=' + encodeURIComponent(query), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
        timeout: 20000, responseType: 'text',
      });
      const re = /href="(\/video\.[^"]+)"[^>]*title="([^"]+)"/gi;
      let m;
      while ((m = re.exec(String(html))) && links.length < limit) {
        const url = 'https://www.xvideos.com' + m[1];
        if (seen.has(url)) continue;
        seen.add(url);
        links.push({ title: m[2].slice(0, 80), url, duration: '', quality: '720p' });
      }
    } catch (e) { console.error('xvideos html:', e?.message || e); }
  }
  return links.slice(0, limit);
}

async function searchHentaila(query, limit) {
  limit = limit || 10;
  const links = [];
  try {
    const { data: html } = await axios.get('https://hentaila.com/search?q=' + encodeURIComponent(query), {
      headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000, responseType: 'text',
    });
    const re = /href="(\/media\/[a-z0-9-]+)"/gi;
    let m;
    const seen = new Set();
    while ((m = re.exec(String(html))) && links.length < limit) {
      const path = m[1];
      if (seen.has(path)) continue;
      seen.add(path);
      const slug = path.replace('/media/', '').replace(/-/g, ' ');
      links.push({ title: slug.slice(0, 60), url: 'https://hentaila.com' + path });
    }
  } catch (e) { console.error('hentaila', e.message || e); }
  if (!links.length) {
    links.push({ title: query, url: 'https://hentaila.com/search?q=' + encodeURIComponent(query) });
  }
  return links.slice(0, limit);
}

function formatDur(sec) {
  if (sec == null || sec === '') return '';
  if (typeof sec === 'string' && /min|sec|:/i.test(sec)) return sec;
  const n = Number(sec);
  if (!n || n < 0) return '';
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  if (m >= 1) return m + 'min' + (s ? (' ' + s + 'sec') : '');
  return s + 'sec';
}

function formatLinkList(title, query, links, prefix) {
  const lines = [
    '✦❖° *RESULTADOS*',
    '',
  ];
  links.slice(0, 10).forEach((l, i) => {
    const dur = formatDur(l.duration || l.dur);
    const qual = l.quality || l.height ? (String(l.quality || (l.height + 'p'))) : '';
    lines.push('↳ *' + (i + 1) + '.* ' + String(l.title || 'Video').slice(0, 70));
    const meta = [];
    if (dur) meta.push('Duración: ' + dur);
    if (qual) meta.push('Calidad: ' + qual);
    if (meta.length) lines.push('   · ' + meta.join(' · '));
    lines.push('');
  });
  lines.push('_Elige un video con los botones_');
  return lines.join('\n');
}

async function sendLinkButtons(c, title, query, links) {
  if (!links.length) {
    return c.reply(C.quote + 'Sin resultados.');
  }
  // Un solo mensaje · max 3 resultados · 3 botones (como el ejemplo)
  const list = links.slice(0, 3);
  pendingNsfw.set(c.from, { links: links.slice(0, 10), at: Date.now(), query, source: title });
  const pfx = c.prefix || '.';

  const lines = ['✦❖° *RESULTADOS*', ''];
  list.forEach((l, i) => {
    const n = i + 1;
    const dur = formatDur(l.duration || l.dur);
    const qual = l.quality || (l.height ? (l.height + 'p') : '') || '720p';
    lines.push('↳ *' + n + '.* ' + String(l.title || 'Video').slice(0, 80));
    if (dur) lines.push('   · Duración: ' + dur + ' · Calidad: ' + qual);
    else lines.push('   · Calidad: ' + qual);
    lines.push('');
  });
  lines.push('_Elige un video con los botones_');
  const text = lines.join('\n');

  const btns = list.map((l, i) => ({
    buttonId: pfx + 'nsfwpick ' + (i + 1),
    buttonText: { displayText: 'Video ' + (i + 1) },
    type: 1,
  }));

  // 1) Botones verdaderos
  try {
    await c.sock.sendMessage(c.from, {
      text,
      footer: 'SHARKNEX',
      buttons: btns,
      headerType: 1,
    }, { quoted: c.m });
    return;
  } catch (e) {
    console.error('nsfw buttons:', e?.message || e);
  }

  // 2) Interactive
  try {
    const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
    const buttons = list.map((l, i) => ({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: 'Video ' + (i + 1),
        id: pfx + 'nsfwpick ' + (i + 1),
      }),
    }));
    const msg = generateWAMessageFromContent(c.from, {
      viewOnceMessage: {
        message: {
          interactiveMessage: proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({ text }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: 'SHARKNEX' }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons }),
          }),
        },
      },
    }, { userJid: c.sock.user?.id, quoted: c.m });
    await c.sock.relayMessage(c.from, msg.message, { messageId: msg.key.id });
    return;
  } catch (e) {
    console.error('nsfw flow:', e?.message || e);
  }

  // 3) Texto (sin botones el cliente no los soporta)
  await c.reply(text + '\n\n' + list.map((_, i) => pfx + 'nsfwpick ' + (i + 1)).join(' · '));
}


/** Extrae URL directa de video desde paginas xnxx / xvideos */
async function extractDirectVideoUrl(pageUrl) {
  const u = String(pageUrl || '');
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    const { data: html } = await axios.get(u, {
      timeout: 25000,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': /xvideos/i.test(u) ? 'https://www.xvideos.com/' : 'https://www.xnxx.com/',
      },
      maxRedirects: 5,
    });
    const h = String(html);
    const tryMatch = (re) => {
      const m = h.match(re);
      if (!m) return null;
      let found = m[1] || m[0];
      found = String(found).replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
      if (!/^https?:\/\//i.test(found)) return null;
      if (/\.(js|css|jpg|jpeg|png|gif|webp)(\?|$)/i.test(found)) return null;
      return found;
    };
    return (
      tryMatch(/html5player\.setVideoUrlHigh\(['"]([^'"]+)['"]\)/i) ||
      tryMatch(/html5player\.setVideoUrlLow\(['"]([^'"]+)['"]\)/i) ||
      tryMatch(/setVideoUrlHigh\(['"]([^'"]+)['"]\)/i) ||
      tryMatch(/setVideoUrlLow\(['"]([^'"]+)['"]\)/i) ||
      tryMatch(/html5player\.setVideoHLS\(['"]([^'"]+)['"]\)/i) ||
      tryMatch(/"contentUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/i) ||
      tryMatch(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/i)
    );
  } catch (e) {
    console.error('extractDirect:', e?.message || e);
  }
  return null;
}

async function downloadUrlBuffer(url, referer) {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxContentLength: 80 * 1024 * 1024,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      Referer: referer || url,
      Accept: '*/*',
    },
  });
  return Buffer.from(data);
}

function isRealVideo(buf) {
  if (!buf || buf.length < 50 * 1024) return false;
  try {
    if (buf.slice(4, 8).toString('ascii') === 'ftyp') return true;
  } catch {}
  if (buf[0] === 0x1a && buf[1] === 0x45) return true;
  const head = buf.slice(0, 120).toString('utf8').toLowerCase();
  if (head.includes('<!doctype') || head.includes('<html') || head.includes('{')) return false;
  return buf.length > 300 * 1024;
}

async function ensurePlayableMp4(buf, hintExt) {
  if (!buf || buf.length < 1000) return null;
  // Ya es MP4 (caja ftyp)
  try {
    if (buf.slice(4, 8).toString('ascii') === 'ftyp') return buf;
  } catch {}
  // Convertir webm/mkv/gif/etc a mp4 reproducible en WhatsApp
  const ext = hintExt || 'webm';
  try {
    if (media.toMp4Fast) {
      const out = await media.toMp4Fast(buf, ext);
      if (out && out.length > 1000) return out;
    }
  } catch (e) { console.error('nsfw toMp4Fast:', e?.message || e); }
  try {
    const out = await media.toMp4(buf, ext);
    if (out && out.length > 1000) return out;
  } catch (e) { console.error('nsfw toMp4:', e?.message || e); }
  return null;
}

async function sendPickedVideo(c, item, n) {
  const title = item.title || 'video';
  const pageUrl = item.url;
  await c.reply(C.quote + 'Descargando *' + n + '* — ' + String(title).slice(0, 40) + '...');

  const cap = [
    '   ❀ 𓆩 ' + sans('nsfw') + ' 𓆪 ❀',
    '  ✦ ' + String(title).slice(0, 90),
    '   ❀',
  ].join('\n');

  async function sendMp4(buf) {
    if (!isRealVideo(buf)) {
      console.error('nsfw reject bad buffer', buf && buf.length);
      return false;
    }
    let out = buf;
    // Si no es mp4, convertir
    if (buf.slice(4, 8).toString('ascii') !== 'ftyp') {
      const conv = await ensurePlayableMp4(buf, 'webm');
      if (conv && isRealVideo(conv)) out = conv;
    }
    try {
      if (out.length > 64 * 1024 * 1024) {
        await c.sock.sendMessage(c.from, {
          document: out,
          mimetype: 'video/mp4',
          fileName: 'video_' + n + '.mp4',
          caption: cap,
        }, { quoted: c.m });
      } else {
        await c.sock.sendMessage(c.from, {
          video: out,
          mimetype: 'video/mp4',
          fileName: 'video.mp4',
          caption: cap,
        }, { quoted: c.m });
      }
      return true;
    } catch (e) {
      console.error('nsfw send:', e?.message || e);
      try {
        await c.sock.sendMessage(c.from, {
          document: out,
          mimetype: 'video/mp4',
          fileName: 'video_' + n + '.mp4',
          caption: cap,
        }, { quoted: c.m });
        return true;
      } catch (e2) {
        console.error('nsfw doc:', e2?.message || e2);
        return false;
      }
    }
  }

  // 1) Scrape URL directa del player (xnxx/xvideos)
  try {
    const direct = await extractDirectVideoUrl(pageUrl);
    if (direct) {
      console.log('nsfw direct url', direct.slice(0, 80));
      if (/\.m3u8(\\?|$)/i.test(direct)) {
        // HLS: yt-dlp sobre la URL del m3u8
        try {
          const d = await yt.download(direct, { audio: false, height: 720, maxMB: 64, maxDuration: 480 });
          try {
            const buf = fs.readFileSync(d.file);
            if (await sendMp4(buf)) return;
          } finally { try { d.cleanup(); } catch {} }
        } catch (e) { console.error('nsfw m3u8:', e?.message || e); }
      } else {
        const buf = await downloadUrlBuffer(direct, pageUrl);
        if (await sendMp4(buf)) return;
      }
    }
  } catch (e) {
    console.error('nsfw extract path:', e?.message || e);
  }

  // 2) yt-dlp sobre la pagina (a veces funciona en xvideos/ph)
  try {
    if (yt.valid(pageUrl)) {
      const d = await yt.download(pageUrl, { audio: false, height: 720, maxMB: 64, maxDuration: 480 });
      try {
        const buf = fs.readFileSync(d.file);
        if (await sendMp4(buf)) return;
      } finally { try { d.cleanup(); } catch {} }
    }
  } catch (e) {
    console.error('nsfw ytdlp page:', e?.message || e);
  }

  // 3) CDN sample/file_url (maplestar/rule34)
  if (item.sample && item.sample !== pageUrl) {
    try {
      const buf = await downloadUrlBuffer(item.sample, pageUrl);
      if (await sendMp4(buf)) return;
    } catch (e) { console.error('nsfw sample:', e?.message || e); }
  }

  return c.reply(
    C.quote + 'No pude obtener un video valido (XNXX a veces bloquea).\nPrueba *Video 1/3* otro o .xvideos / .ph\n' + pageUrl
  );
}

const FACES = {
  anal: ['( ͡° ͜ʖ ͡°)', '(¬‿¬)', '(つ≧▽≦)つ'],
  blowjob: ['( ͡° ͜ʖ ͡°)', '(˘ʃƪ˘)', '(๑>ᴗ<๑)'],
  boobjob: ['(◕‿◕)♡', '( ͡° ͜ʖ ͡°)', '(≧∀≦)'],
  cum: ['( ͡° ͜ʖ ͡°)', '(≧▽≦)', '(¬‿¬)'],
  cummouth: ['( ͡° ͜ʖ ͡°)', '(˘ʃƪ˘)', '(≧∀≦)'],
  cumshot: ['(≧▽≦)', '( ͡° ͜ʖ ͡°)', '(つ≧▽≦)つ'],
  fuck: ['( ͡° ͜ʖ ͡°)', '(つ≧▽≦)つ', '(¬‿¬)', '(≧∀≦)', '(◕‿◕)♡'],
  grabboobs: ['( ͡° ͜ʖ ͡°)', '(˘ʃƪ˘)', '(≧▽≦)'],
  grope: ['(¬‿¬)', '( ͡° ͜ʖ ͡°)', '(つ≧▽≦)つ'],
  handjob: ['( ͡° ͜ʖ ͡°)', '(˘ʃƪ˘)', '(≧∀≦)'],
  lickass: ['( ͡° ͜ʖ ͡°)', '(≧▽≦)', '(¬‿¬)'],
  lickdick: ['(˘ʃƪ˘)', '( ͡° ͜ʖ ͡°)', '(≧∀≦)'],
  lickpussy: ['( ͡° ͜ʖ ͡°)', '(≧▽≦)', '(つ≧▽≦)つ'],
  sixnine: ['( ͡° ͜ʖ ͡°)', '(≧∀≦)', '(¬‿¬)'],
  spank: ['(¬‿¬)', '( ͡° ͜ʖ ͡°)', '(≧▽≦)'],
  suckboobs: ['(˘ʃƪ˘)', '( ͡° ͜ʖ ͡°)', '(◕‿◕)♡'],
  undress: ['( ͡° ͜ʖ ͡°)', '(≧∀≦)', '(つ≧▽≦)つ'],
  yuri: ['(◕‿◕)♡', '(≧▽≦)', '(˘ʃƪ˘)'],
  default: ['(つ≧▽≦)つ', '( ͡° ͜ʖ ͡°)', '(≧∀≦)', '(¬‿¬)'],
};
const faceOf = (name) => {
  const arr = FACES[name] || FACES.default;
  return arr[Math.floor(Math.random() * arr.length)];
};

const REACTS = [
  // [cmd, frasesConTarget[], frasesSolo[], aliases, sources]
  ['anal', [
    'hizo anal a', 'se la metio por detras a', 'no tuvo piedad con',
    'la rompio por detras a', 'se la embistio a', 'le dio por el culo a',
    'lo dejo temblando a', 'lo uso sin piedad a',
  ], [
    'entro en modo anal', 'se busco accion por detras', 'esta en modo salvaje',
  ], [], [() => SRC.purr('anal'), () => SRC.purr('fuck')]],

  ['blowjob', [
    'hizo blowjob a', 'se arrodillo por', 'le chupo todo a',
    'le dio una mamada a', 'le limpio la polla a', 'no solto la boca de',
    'le hizo un oral intenso a', 'se trago todo de',
  ], [
    'esta mamando', 'practica oral solo/a', 'modo mamada activado',
  ], ['mamar', 'bj'], [() => SRC.purr('blowjob'), () => SRC.purr('cum')]],

  ['boobjob', [
    'hizo rusa a', 'uso las tetas con', 'apreto fuerte a',
    'le hizo una rusa a', 'apreto las tetas contra', 'envolvio con el pecho a',
  ], [
    'hizo una rusa', 'uso las tetas', 'modo boobjob',
  ], ['rusa'], [() => SRC.purr('fuck'), () => SRC.purr('neko')]],

  ['cum', [
    'hizo cum a', 'se vino en', 'lleno de leche a', 'termino dentro de',
    'no aguanto y se vino sobre', 'exploto dentro de', 'lo dejo todo blanco a',
    'descargo todo en', 'se corrio sobre',
  ], [
    'se corrio solo', 'termino en el aire', 'modo corrida',
  ], ['eyacular'], [() => SRC.purr('cum'), () => SRC.purr('blowjob')]],

  ['cummouth', [
    'hizo cum en la boca de', 'le dejo la boca llena a', 'termino en la cara de',
    'le dio de beber a', 'cerro la boca de', 'le dejo la lengua blanca a',
  ], [
    'corrida en boca', 'trago todo', 'modo facial',
  ], [], [() => SRC.purr('cum'), () => SRC.purr('blowjob')]],

  ['cumshot', [
    'le pego un cumshot a', 'disparo todo sobre', 'lo banó en leche a',
    'le pinto la cara a', 'termino encima de',
  ], [
    'disparo al aire', 'cumshot solo',
  ], [], [() => SRC.purr('cum'), () => SRC.purr('fuck')]],

  ['fuck', [
    'se empotro con', 'cogio duro a', 'folló sin parar a',
    'lo penetro con fuerza a', 'le dio sin piedad a', 'se la metio completa a',
    'lo uso como quiso a', 'no paro de coger con', 'lo dejo temblando a',
    'le parto el lomo a', 'lo destrozo en la cama a', 'lo embistio a',
    'hizo el delicioso con', 'lo montó a', 'se la cojió a',
  ], [
    'esta follando', 'modo salvaje activado', 'necesita accion ya',
    'se puso caliente solo/a',
  ], ['coger'], [() => SRC.purr('fuck'), () => SRC.purr('anal')]],

  ['grabboobs', [
    'le agarro las tetas a', 'no solto el pecho de', 'apreto fuerte el pecho de',
    'manoseo las tetas de', 'le apreto las tetas a',
  ], [
    'agarra tetas', 'modo pechos',
  ], [], [() => SRC.purr('neko'), () => SRC.purr('fuck')]],

  ['grope', [
    'le manoseo a', 'paso las manos por', 'toco sin permiso a',
    'recorrio el cuerpo de', 'no dejo zona libre a',
  ], [
    'manosea', 'manos inquietas',
  ], [], [() => SRC.purr('neko'), () => SRC.purr('yuri')]],

  ['handjob', [
    'hizo handjob a', 'le hizo la paja a', 'le masturbo a',
    'le subio y bajo a', 'termino a mano a',
  ], [
    'hizo una paja', 'mano activa',
  ], [], [() => SRC.purr('solo'), () => SRC.purr('blowjob')]],

  ['lickass', [
    'le lamio el culo a', 'no dejo seco a', 'le limpio con la lengua a',
    'se enterro detras de',
  ], [
    'lame culo', 'modo rimjob',
  ], ['lamercullo'], [() => SRC.purr('anal'), () => SRC.purr('pussylick')]],

  ['lickdick', [
    'le lamio la polla a', 'recorrio con la lengua a', 'le chupo despacio a',
    'le dio lenguetazos a',
  ], [
    'lame polla', 'lengua ocupada',
  ], ['lamerpolla'], [() => SRC.purr('blowjob'), () => SRC.purr('cum')]],

  ['lickpussy', [
    'le lamio el coño a', 'se bajo a comerse a', 'le hizo oral a',
    'no salio de entre las piernas de', 'le dejo temblando a',
  ], [
    'lame', 'modo oral',
  ], [], [() => SRC.purr('pussylick'), () => SRC.purr('yuri')]],

  ['sixnine', [
    'hizo el 69 con', 'se enredo en 69 con', 'se puso boca abajo con',
    'compartio placer mutuo con',
  ], [
    'modo 69', '69 en solitario (osado)',
  ], ['69'], [() => SRC.purr('pussylick'), () => SRC.purr('fuck')]],

  ['spank', [
    'le dio una nalgada a', 'azote el culo de', 'le dejo la marca a',
    'le pego en el culo a', 'no paro de nalguear a',
  ], [
    'nalgada', 'modo disciplina',
  ], ['nalgada'], [() => SRC.purr('fuck'), () => SRC.purr('neko')]],

  ['suckboobs', [
    'le chupo las tetas a', 'no dejo el pecho de', 'le chupo los pezones a',
    'se quedo pegado al pecho de',
  ], [
    'chupa tetas', 'modo pezones',
  ], ['chupartetas'], [() => SRC.purr('neko'), () => SRC.purr('yuri')]],

  ['undress', [
    'encuero a', 'le quito la ropa a', 'dejo en pelotas a',
    'lo dejo en ropa interior a', 'lo desnudo sin permiso a',
  ], [
    'se desnudo', 'modo strip',
  ], ['encuerar'], [() => SRC.purr('neko'), () => SRC.purr('solo')]],

  ['yuri', [
    'hizo tijeras con', 'se froto con', 'modo yuri con',
    'se enredo con', 'compartio calor con',
  ], [
    'modo yuri', 'tijeras solas',
  ], ['tijeras'], [() => SRC.purr('yuri'), () => SRC.purr('pussylick')]],
];

const list = [];

for (const [name, withArr, soloArr, aliases, sources] of REACTS) {
  list.push(mk(name, 'NSFW GIF: ' + name, '[@usuario | responder]', async (c) => {
    const target = (c.mentioned && c.mentioned[0]) || (c.quoted && c.quoted.sender);
    const who = c.pushName || 'Usuario';
    const withT = Array.isArray(withArr) ? withArr[Math.floor(Math.random() * withArr.length)] : withArr;
    const solo = Array.isArray(soloArr) ? soloArr[Math.floor(Math.random() * soloArr.length)] : soloArr;
    const face = faceOf(name);
    const mentions = [];
    let text;
    if (target) {
      mentions.push(c.sender, target);
      text = '*' + who + '* ' + withT + ' ' + tag(target) + '\n' + face;
    } else {
      mentions.push(c.sender);
      text = '*' + who + '* ' + solo + '\n' + face;
    }
    try { await c.react('⚡'); } catch {}
    const url = await getNsfw(...sources);
    return sendMedia(c, url, text, mentions, true);
  }, aliases));
}

list.push(mk('danbooru', 'Busca en Danbooru', '<tag>', async (c) => {
  const tags = (c.q || 'rating:explicit').trim();
  const { data } = await axios.get('https://danbooru.donmai.us/posts.json', {
    params: { tags, limit: 20 }, headers: { 'User-Agent': 'SharkyBot/4' }, timeout: 20000,
  });
  if (!Array.isArray(data) || !data.length) return c.reply('Sin resultados en Danbooru.');
  const p = data[Math.floor(Math.random() * data.length)];
  return sendMedia(c, p.file_url || p.large_file_url, C.quote + sans('danbooru') + ' · ' + tags);
}, ['dbooru']));

list.push(mk('gelbooru', 'Busca en Gelbooru', '<tag>', async (c) => {
  const tags = (c.q || 'hentai rating:explicit').trim();
  const url = await getNsfw(() => SRC.gel(tags));
  return sendMedia(c, url, C.quote + sans('gelbooru') + ' · ' + tags);
}, ['gbooru']));

list.push(mk('rule34', 'Rule34: 10 media + botones', '<tag>', async (c) => {
  const tags = (c.q || 'hentai animated').trim();
  await c.react('🔞');
  const links = await listMediaLinks(tags, 10);
  if (!links.length) return c.reply('Sin resultados en Rule34.');
  await sendLinkButtons(c, 'rule34', tags, links);
}, ['r34', 'r34vid']));

list.push(mk('xnxx', 'XNXX: mejores + botones', '<query>', async (c) => {
  if (!c.q) return c.reply(C.quote + 'Ej: ' + c.prefix + 'xnxx hentai');
  await c.react('🔞');
  const links = await searchXnxx(c.q.trim(), 10);
  await sendLinkButtons(c, 'xnxx', c.q.trim(), links);
}, ['xxx']));

list.push(mk('xvideos', 'XVideos: mejores + botones', '<query>', async (c) => {
  if (!c.q) return c.reply(C.quote + 'Ej: ' + c.prefix + 'xvideos hentai');
  await c.react('🔞');
  const links = await searchXvideos(c.q.trim(), 10);
  await sendLinkButtons(c, 'xvideos', c.q.trim(), links);
}, ['xv']));

list.push(mk('ph', 'Pornhub: 10 links + botones', '<query>', async (c) => {
  if (!c.q) return c.reply(C.quote + 'Ej: ' + c.prefix + 'ph hentai');
  await c.react('🔞');
  let links = [];
  try {
    const rows = await yt.search('pornhub:' + c.q.trim(), 10).catch(() => []);
    for (const r of rows || []) if (r.url) links.push({ title: (r.title || 'ph').slice(0, 70), url: r.url, duration: r.duration || '', quality: r.height ? (r.height + 'p') : (r.quality || ''), views: r.views || '' });
  } catch {}
  while (links.length < 10) {
    const i = links.length + 1;
    links.push({
      title: 'pornhub #' + i + ' · ' + c.q,
      url: 'https://www.pornhub.com/video/search?search=' + encodeURIComponent(c.q.trim()) + (i > 1 ? '&page=' + i : ''),
    });
  }
  await sendLinkButtons(c, 'pornhub', c.q.trim(), links.slice(0, 10));
}, ['pornhub']));

list.push(mk('hentaila', 'HentaiLA: mejores + botones', '<titulo>', async (c) => {
  if (!c.q) return c.reply(C.quote + 'Ej: ' + c.prefix + 'hentaila overflow');
  await c.react('🔞');
  const links = await searchHentaila(c.q.trim(), 10);
  await sendLinkButtons(c, 'hentaila', c.q.trim(), links);
}, ['hla']));

list.push(mk('maplestar', 'Maplestar: mejores + botones', '<nombre>', async (c) => {
  const q = (c.q || '').trim();
  await c.react('🔞');
  const tags = q ? ('maplestar ' + q + ' video') : 'maplestar video animated';
  let links = await listMediaLinks(tags, 10);
  if (!links.length) links = await listMediaLinks('maplestar animated', 10);
  if (!links.length) links = await listMediaLinks('maplestar', 10);
  // Preferir URLs de video
  links = links.sort((a, b) => {
    const av = /\.(mp4|webm)(\?|$)/i.test(a.url) ? 0 : 1;
    const bv = /\.(mp4|webm)(\?|$)/i.test(b.url) ? 0 : 1;
    return av - bv;
  });
  if (!links.length) return c.reply(C.quote + 'Sin resultados Maplestar.');
  await sendLinkButtons(c, 'maplestar', q || 'maplestar', links);
}, ['maple']));

list.push(mk('nsfwpick', 'Descarga el video del boton o numero', '<numero>', async (c) => {
  const pack = pendingNsfw.get(c.from);
  if (!pack || !pack.links || !pack.links.length) {
    return c.reply(C.quote + 'No hay busqueda. Usa .xnxx / .xxx / .maplestar / .hentaila');
  }
  if (Date.now() - pack.at > 600000) {
    pendingNsfw.delete(c.from);
    return c.reply(C.quote + 'Lista expirada. Busca de nuevo.');
  }
  const n = parseInt(c.args[0] || c.q, 10);
  if (!n || n < 1 || n > pack.links.length) {
    return c.reply(C.quote + 'Elige 1-' + pack.links.length);
  }
  await sendPickedVideo(c, pack.links[n - 1], n);
}, ['nspick', 'picknsfw', 'elegirnsfw', 'video']));

list.push(mk('nsfwtoggle', 'Activa o desactiva NSFW en el grupo', 'on|off', async (c) => {
  if (!c.isGroup) return c.reply(C.quote + 'Solo en grupos.');
  if (!(await c.isAdmin()) && !c.isOwner) return c.reply(C.quote + 'Solo admins.');
  const v = (c.args[0] || '').toLowerCase();
  if (!['on', 'off'].includes(v)) {
    const on = db.chat(c.from).nsfwOn !== false;
    return c.reply(C.quote + 'NSFW del grupo: *' + (on ? 'ON' : 'OFF') + '*\nUso: ' + c.prefix + 'nsfw on | off');
  }
  db.chat(c.from).nsfwOn = v === 'on';
  db.save();
  return c.reply(C.quote + 'NSFW ' + (v === 'on' ? 'activado' : 'desactivado') + ' en este grupo.');
}, ['nsfw']));

list.push(mk('menu2', 'Menu oculto NSFW (18+)', '', async (c) => {
  const pfx = c.prefix || '.';
  const cmds = registry.list
    .filter((p) => p.category === 'nsfw' && p.name !== 'menu2')
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const lines = [
    '   ❀ 𓆩 ' + sans('CATEGORIA NSFW') + ' 𓆪 ❀',
    'Solo mayores de 18',
    '',
  ];
  for (const p of cmds) {
    const al = (p.aliases || []).slice(0, 2).map((a) => pfx + a).join(' · ');
    lines.push(pfx + p.name + (al ? ' · ' + al : ''));
    if (p.desc) lines.push('> ' + String(p.desc).slice(0, 50));
    lines.push('');
  }
  lines.push('   ❀');
  return c.reply(lines.join('\n'));
}, ['labiblia', 'nsfwmenu', 'menunsfw']));

module.exports = list;
