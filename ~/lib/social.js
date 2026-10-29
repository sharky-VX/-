const axios = require('axios');
const U = require('./utils');

// ═══════════════════════════════════════════════
//  APIs de redes sociales sin API key.
//  TikTok → tikwm.com (video sin marca de agua + audio + portada, y BÚSQUEDA)
//  Pinterest / imágenes → Pinterest (búsqueda web) con respaldo de Bing Imágenes
// ═══════════════════════════════════════════════
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const TIKWM = 'https://www.tikwm.com';
const abs = (u) => (!u ? '' : /^https?:/i.test(u) ? u : TIKWM + (u.startsWith('/') ? u : '/' + u));

// tikwm permite 1 petición por segundo: reintenta una vez
async function tikwm(path, params, post = false) {
  for (let i = 0; i < 2; i++) {
    const r = post
      ? await axios.post(TIKWM + path, new URLSearchParams(params).toString(), { timeout: 25000, headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } })
      : await axios.get(TIKWM + path, { params, timeout: 25000, headers: { 'User-Agent': UA } });
    const d = r.data;
    if (d && d.code === 0 && d.data) return d.data;
    if (/limit|second/i.test(d?.msg || '') && i === 0) { await U.sleep(1500); continue; }
    throw new Error(d?.msg || 'TikTok no respondió');
  }
}

const mapTik = (v) => {
  const user = v.author?.unique_id || v.author?.id || '';
  const id = v.id || v.video_id;
  return {
    id,
    title: v.title || 'TikTok',
    author: v.author?.nickname || user,
    user,
    duration: v.duration,
    plays: v.play_count,
    likes: v.digg_count,
    comments: v.comment_count,
    shares: v.share_count,
    cover: abs(v.origin_cover || v.cover),
    video: abs(v.hdplay || v.play),
    audio: abs(v.music || v.music_info?.play),
    musicTitle: v.music_info?.title,
    url: user && id ? `https://www.tiktok.com/@${user}/video/${id}` : '',
  };
};

async function tiktokByUrl(url) {
  return mapTik(await tikwm('/api/', { url, hd: 1 }));
}

async function tiktokSearch(q, n = 5) {
  const d = await tikwm('/api/feed/search', { keywords: q, count: Math.max(n, 5), cursor: 0, web: 1, hd: 1 }, true);
  const vids = (d.videos || []).map(mapTik).filter((v) => v.video);
  if (!vids.length) throw new Error('Sin resultados en TikTok');
  return vids.slice(0, n);
}

// ── Imágenes ──
async function pinterestApi(q, n) {
  const data = { options: { isPrefetch: false, query: q, scope: 'pins', no_fetch_context_on_resource: false }, context: {} };
  const r = await axios.get('https://www.pinterest.com/resource/BaseSearchResource/get/', {
    params: { source_url: `/search/pins/?q=${encodeURIComponent(q)}`, data: JSON.stringify(data), _: Date.now() },
    headers: { 'User-Agent': UA, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Pinterest-PWS-Handler': 'www/search/[scope].js' },
    timeout: 20000,
  });
  const res = r.data?.resource_response?.data?.results || [];
  return res
    .map((p) => p?.images?.orig?.url || p?.images?.['736x']?.url)
    .filter(Boolean)
    .slice(0, n * 3);
}

async function bingImages(q, n) {
  const r = await axios.get('https://www.bing.com/images/async', {
    params: { q, first: 0, count: 40, mmasync: 1, adlt: 'moderate' },
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' },
    timeout: 20000,
  });
  const out = [];
  const re = /murl&quot;:&quot;(.*?)&quot;/g;
  let m;
  while ((m = re.exec(r.data)) && out.length < n * 3) out.push(m[1].replace(/&amp;/g, '&'));
  return out;
}

// Devuelve hasta n imágenes (Buffers) ya descargadas y comprobadas
async function imageSearch(q, n = 7) {
  let urls = [];
  const errs = [];
  try { urls = await pinterestApi(q, n); } catch (e) { errs.push('pinterest'); }
  if (urls.length < n) {
    try { urls = [...new Set([...urls, ...(await bingImages(`${q} pinterest`, n))])]; } catch (e) { errs.push('bing'); }
  }
  if (!urls.length) throw new Error('No encontré imágenes (' + (errs.join(', ') || 'sin resultados') + ')');
  const imgs = [];
  for (let i = 0; i < urls.length && imgs.length < n; i += 4) {
    const batch = await Promise.all(
      urls.slice(i, i + 4).map(async (u) => {
        try {
          if (!U.isPublicUrl(u)) return null;
          const b = await U.getBuffer(u, { timeout: 15000, maxContentLength: 12 * 1024 * 1024, headers: { 'User-Agent': UA, Referer: 'https://www.pinterest.com/' } });
          const ok = (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || (b.slice(0, 4).toString() === 'RIFF');
          return ok && b.length > 5000 ? b : null;
        } catch { return null; }
      })
    );
    for (const b of batch) if (b && imgs.length < n) imgs.push(b);
  }
  if (!imgs.length) throw new Error('Encontré enlaces pero no pude descargar las imágenes');
  return imgs;
}

module.exports = { tiktokByUrl, tiktokSearch, imageSearch };
