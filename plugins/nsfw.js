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
  try {
    const rows = await yt.search('xnxx:' + query, limit).catch(() => []);
    for (const r of rows || []) if (r.url) links.push({ title: (r.title || 'video').slice(0, 60), url: r.url });
  } catch {}
  if (links.length < limit) {
    try {
      const { data: html } = await axios.get('https://www.xnxx.com/search/' + encodeURIComponent(query), {
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000, responseType: 'text',
      });
      const re = /href="(\/video-[a-z0-9]+\/[^"]+)"[^>]*>([^<]{0,80})/gi;
      let m;
      const seen = new Set(links.map((l) => l.url));
      while ((m = re.exec(String(html))) && links.length < limit) {
        const url = 'https://www.xnxx.com' + m[1];
        if (seen.has(url)) continue;
        seen.add(url);
        links.push({ title: (m[2] || 'xnxx').replace(/\s+/g, ' ').trim().slice(0, 60) || 'xnxx video', url });
      }
    } catch (e) { console.error('xnxx search', e.message || e); }
  }
  return links.slice(0, limit);
}

async function searchXvideos(query, limit) {
  limit = limit || 10;
  const links = [];
  try {
    const rows = await yt.search('xvideos:' + query, limit).catch(() => []);
    for (const r of rows || []) if (r.url) links.push({ title: (r.title || 'video').slice(0, 60), url: r.url });
  } catch {}
  if (links.length < limit) {
    try {
      const { data: html } = await axios.get('https://www.xvideos.com/?k=' + encodeURIComponent(query), {
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000, responseType: 'text',
      });
      const re = /href="(\/video\.[^"]+)"[^>]*title="([^"]+)"/gi;
      let m;
      const seen = new Set(links.map((l) => l.url));
      while ((m = re.exec(String(html))) && links.length < limit) {
        const url = 'https://www.xvideos.com' + m[1];
        if (seen.has(url)) continue;
        seen.add(url);
        links.push({ title: (m[2] || 'xvideos').slice(0, 60), url });
      }
    } catch (e) { console.error('xvideos search', e.message || e); }
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

function formatLinkList(title, query, links, prefix) {
  const lines = [
    '   ❀ 𓆩 ' + sans(title) + ' 𓆪 ❀',
    '',
    'Busqueda: ' + query,
    'Resultados: ' + links.length,
    '',
  ];
  links.forEach((l, i) => {
    lines.push((i + 1) + '. ' + (l.title || 'video').slice(0, 50));
    lines.push('   ' + l.url);
    lines.push('');
  });
  lines.push('> 𓆩✰𓆪 Botones abajo o ' + prefix + 'nsfwpick <n>');
  lines.push('   ❀');
  return lines.join('\n');
}

async function sendLinkButtons(c, title, query, links) {
  pendingNsfw.set(c.from, { links, at: Date.now(), query, source: title });
  const caption = formatLinkList(title, query, links, c.prefix || '.');
  const pfx = c.prefix || '.';
  const chunks = [];
  for (let i = 0; i < links.length; i += 3) {
    chunks.push(links.slice(i, i + 3).map((l, j) => ({ idx: i + j + 1, title: l.title, url: l.url })));
  }
  const firstBtns = (chunks[0] || []).map((l) => ({
    buttonId: pfx + 'nsfwpick ' + l.idx,
    buttonText: { displayText: 'Video ' + l.idx },
    type: 1,
  }));
  try {
    await c.sock.sendMessage(c.from, {
      text: caption,
      footer: 'SHARKNEX NSFW',
      buttons: firstBtns,
      headerType: 1,
    }, { quoted: c.m });
  } catch (e) {
    console.error('nsfw buttons:', e.message || e);
    await c.reply(caption);
  }
  for (let ci = 1; ci < chunks.length; ci++) {
    const btns = chunks[ci].map((l) => ({
      buttonId: pfx + 'nsfwpick ' + l.idx,
      buttonText: { displayText: 'Video ' + l.idx },
      type: 1,
    }));
    const labels = chunks[ci].map((l) => 'Video ' + l.idx).join(' · ');
    try {
      await c.sock.sendMessage(c.from, {
        text: '   ❀ 𓆩 ' + sans('mas videos') + ' 𓆪 ❀\n  ' + labels,
        footer: 'SHARKNEX',
        buttons: btns,
        headerType: 1,
      }, { quoted: c.m });
    } catch {
      await c.reply('Mas: ' + chunks[ci].map((l) => pfx + 'nsfwpick ' + l.idx).join(' · '));
    }
  }
}

async function sendPickedVideo(c, item, n) {
  const title = item.title || 'video';
  const urls = [item.url, item.sample].filter(Boolean);
  await c.reply(C.quote + 'Descargando *' + n + '* — ' + String(title).slice(0, 40) + '...');

  async function sendBuf(buf, kind) {
    if (!buf || buf.length < 800) return false;
    const cap = '   ❀ 𓆩 ' + sans('nsfw') + ' 𓆪 ❀\n  ✦ ' + String(title).slice(0, 80) + '\n   ❀';
    try {
      if (kind === 'video' || (buf[0] === 0x00 && buf[1] === 0x00)) {
        await c.sock.sendMessage(c.from, { video: buf, caption: cap, mimetype: 'video/mp4' }, { quoted: c.m });
        return true;
      }
      // gif/webm -> intentar video
      if (kind === 'gif') {
        try {
          const mp4 = await media.toMp4HD(buf, 720, 'gif').catch(() => media.toMp4(buf, 'gif'));
          if (mp4) {
            await c.sock.sendMessage(c.from, { video: mp4, caption: cap, gifPlayback: true, mimetype: 'video/mp4' }, { quoted: c.m });
            return true;
          }
        } catch {}
      }
      await c.sock.sendMessage(c.from, { image: buf, caption: cap }, { quoted: c.m });
      return true;
    } catch (e) {
      console.error('sendBuf nsfw:', e?.message || e);
      try {
        await c.sock.sendMessage(c.from, { document: buf, mimetype: kind === 'video' ? 'video/mp4' : 'application/octet-stream', fileName: 'nsfw_' + n + '.mp4', caption: cap }, { quoted: c.m });
        return true;
      } catch (e2) {
        console.error('sendDoc nsfw:', e2?.message || e2);
        return false;
      }
    }
  }

  for (const url of urls) {
    const isVid = /\.(mp4|webm|mkv|mov)(\?|$)/i.test(url) || /video\.(rule34|gelbooru|cdn)/i.test(url);
    const isImg = /\.(gif|jpe?g|png|webp)(\?|$)/i.test(url);
    // Direct CDN download
    try {
      const buf = await U.getBuffer(url, {
        timeout: 120000,
        maxContentLength: (Number(config.maxFileMB) || 80) * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://rule34.xxx/' },
      });
      if (buf && buf.length > 1000) {
        const ok = await sendBuf(buf, isVid ? 'video' : isImg && /\.gif/i.test(url) ? 'gif' : isImg ? 'image' : 'video');
        if (ok) return;
      }
    } catch (e) {
      console.error('nsfw direct:', e?.message || e);
    }
    // yt-dlp (paginas xnxx/xvideos/ph)
    try {
      if (!yt.valid(url)) continue;
      const d = await yt.download(url, {
        audio: false,
        height: 1080,
        maxMB: Number(config.maxFileMB) || 80,
        maxDuration: Number(config.maxDurationSec) || 600,
      });
      try {
        const buf = fs.readFileSync(d.file);
        const ok = await sendBuf(buf, 'video');
        if (ok) return;
      } finally {
        try { d.cleanup(); } catch {}
      }
    } catch (e) {
      console.error('nsfw ytdlp:', e?.message || e);
    }
  }

  return c.reply(
    C.quote + 'No pude descargar el archivo (bloqueo, peso o enlace invalido).\n\nAbre manualmente:\n' + (item.url || '')
  );
}

const REACTS = [
  // [cmd, frasesConTarget[], frasesSolo[], aliases, sources]
  ['anal', ['hizo anal a', 'se la metio por detras a', 'no tuvo piedad con'], ['modo anal'], [], [() => SRC.purr('anal'), () => SRC.purr('fuck')]],
  ['blowjob', ['hizo blowjob a', 'se arrodillo por', 'le chupo todo a'], ['esta mamando'], ['mamar', 'bj'], [() => SRC.purr('blowjob'), () => SRC.purr('cum')]],
  ['boobjob', ['hizo rusa a', 'uso las tetas con', 'apreto fuerte a'], ['hizo una rusa'], ['rusa'], [() => SRC.purr('fuck'), () => SRC.purr('neko')]],
  ['cum', ['hizo cum a', 'se vino en', 'lleno de leche a', 'termino dentro de', 'no aguanto y se vino sobre'], ['se corrio solo'], ['eyacular'], [() => SRC.purr('cum'), () => SRC.purr('blowjob')]],
  ['cummouth', ['hizo cum en la boca de', 'le dejo la boca llena a', 'termino en la cara de'], ['corrida en boca'], [], [() => SRC.purr('cum'), () => SRC.purr('blowjob')]],
  ['cumshot', ['hizo cumshot a', 'disparo todo sobre', 'mancho a'], ['disparo cum'], [], [() => SRC.purr('cum'), () => SRC.purr('solo')]],
  ['fap', ['se la jala pensando en', 'no para de tocarse por', 'se toca viendo a'], ['se esta jalando'], ['paja'], [() => SRC.purr('solo'), () => SRC.purr('cum')]],
  ['footjob', ['hizo footjob a', 'uso los pies con'], ['hizo footjob'], [], [() => SRC.purr('fuck'), () => SRC.purr('neko')]],
  ['fuck', ['se la follo a', 'no paro hasta cansar a', 'se empotro con', 'cogio duro a'], ['esta follando'], ['coger'], [() => SRC.purr('fuck'), () => SRC.purr('anal')]],
  ['grabboobs', ['le agarro las tetas a', 'no solto el pecho de'], ['agarra tetas'], [], [() => SRC.purr('neko'), () => SRC.purr('fuck')]],
  ['grope', ['le manoseo a', 'paso las manos por'], ['manosea'], [], [() => SRC.purr('neko'), () => SRC.purr('yuri')]],
  ['handjob', ['hizo handjob a', 'le hizo la paja a'], ['hizo una paja'], [], [() => SRC.purr('solo'), () => SRC.purr('blowjob')]],
  ['lickass', ['le lamió el culo a', 'no dejo seco a'], ['lame culo'], ['lamercullo'], [() => SRC.purr('anal'), () => SRC.purr('pussylick')]],
  ['lickdick', ['le lamió la polla a', 'recorrio con la lengua a'], ['lame polla'], ['lamerpolla'], [() => SRC.purr('blowjob'), () => SRC.purr('cum')]],
  ['lickpussy', ['le lamió el coño a', 'se bajo a comerse a'], ['lame'], [], [() => SRC.purr('pussylick'), () => SRC.purr('yuri')]],
  ['sixnine', ['hizo el 69 con', 'se enredo en 69 con'], ['modo 69'], ['69'], [() => SRC.purr('pussylick'), () => SRC.purr('fuck')]],
  ['spank', ['le dio una nalgada a', 'azote el culo de'], ['nalgada'], ['nalgada'], [() => SRC.purr('fuck'), () => SRC.purr('neko')]],
  ['suckboobs', ['le chupo las tetas a', 'no dejo el pecho de'], ['chupa tetas'], ['chupartetas'], [() => SRC.purr('neko'), () => SRC.purr('yuri')]],
  ['undress', ['encuero a', 'le quito la ropa a', 'dejo en pelotas a'], ['se desnudo'], ['encuerar'], [() => SRC.purr('neko'), () => SRC.purr('solo')]],
  ['yuri', ['hizo tijeras con', 'se froto con', 'modo yuri con'], ['modo yuri'], ['tijeras'], [() => SRC.purr('yuri'), () => SRC.purr('pussylick')]],
];

const list = [];

for (const [name, withArr, soloArr, aliases, sources] of REACTS) {
  list.push(mk(name, 'NSFW GIF: ' + name, '[@usuario | responder]', async (c) => {
    const target = (c.mentioned && c.mentioned[0]) || (c.quoted && c.quoted.sender);
    const who = c.pushName || 'Usuario';
    const withT = Array.isArray(withArr) ? withArr[Math.floor(Math.random() * withArr.length)] : withArr;
    const solo = Array.isArray(soloArr) ? soloArr[Math.floor(Math.random() * soloArr.length)] : soloArr;
    const mentions = [];
    let text;
    if (target) {
      mentions.push(c.sender, target);
      text = '*' + who + '* ' + withT + ' ' + tag(target);
    } else {
      mentions.push(c.sender);
      text = '*' + who + '* ' + solo;
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

list.push(mk('xnxx', 'XNXX: 10 links + botones', '<query>', async (c) => {
  if (!c.q) return c.reply(C.quote + 'Ej: ' + c.prefix + 'xnxx hentai');
  await c.react('🔞');
  const links = await searchXnxx(c.q.trim(), 10);
  await sendLinkButtons(c, 'xnxx', c.q.trim(), links);
}, ['xxx']));

list.push(mk('xvideos', 'XVideos: 10 links + botones', '<query>', async (c) => {
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
    for (const r of rows || []) if (r.url) links.push({ title: (r.title || 'ph').slice(0, 60), url: r.url });
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

list.push(mk('hentaila', 'HentaiLA: 10 links + botones', '<titulo>', async (c) => {
  if (!c.q) return c.reply(C.quote + 'Ej: ' + c.prefix + 'hentaila overflow');
  await c.react('🔞');
  const links = await searchHentaila(c.q.trim(), 10);
  await sendLinkButtons(c, 'hentaila', c.q.trim(), links);
}, ['hla']));

list.push(mk('maplestar', 'Maplestar: 10 media + botones', '<nombre>', async (c) => {
  const q = (c.q || '').trim();
  await c.react('🔞');
  const tags = q ? ('maplestar ' + q) : 'maplestar';
  let links = await listMediaLinks(tags, 10);
  if (!links.length) links = await listMediaLinks('maplestar animated', 10);
  if (!links.length) links = await listMediaLinks('maplestory', 10);
  if (!links.length) return c.reply(C.quote + 'Sin resultados Maplestar. Prueba: ' + c.prefix + 'maplestar girl');
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
