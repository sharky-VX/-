const axios = require('axios');

const UA = 'SharkyBot/2.0 (WhatsApp bot; +https://wa.me)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const strip = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const isUrl = (s) => /^https?:\/\/[^\s]+$/i.test(s || '');
const clamp = (n, a, b) => Math.min(Math.max(n, a), b);

// Bloquea localhost / redes privadas (evita que un usuario use tu teléfono para escanear tu red)
function isPublicUrl(u) {
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol)) return false;
    const h = x.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h === '::1' || h === '[::1]') return false;
    if (/^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

function fmtBytes(b) {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), 4);
  return (b / 1024 ** i).toFixed(2) + ' ' + u[i];
}

function fmtTime(s) {
  s = Math.floor(s);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return [d && d + 'd', h && h + 'h', m && m + 'm', x + 's'].filter(Boolean).join(' ');
}

// Parte un texto largo en trozos (por líneas) para enviarlo en varios mensajes
function chunkText(text, max = 3500) {
  const out = [];
  let cur = '';
  for (const line of String(text).split('\n')) {
    if ((cur + '\n' + line).length > max && cur) { out.push(cur); cur = ''; }
    if (line.length > max) {
      for (let i = 0; i < line.length; i += max) out.push(line.slice(i, i + max));
    } else {
      cur = cur ? cur + '\n' + line : line;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// Reintenta solo lo que vale la pena: fallos de red, timeouts, 429 y 5xx (un 404 no se reintenta)
async function withRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const st = e?.response?.status;
      const retry = !st ? !!(e?.code || e?.isAxiosError) : st === 429 || st >= 500;
      if (!retry || i === tries - 1) break;
      await sleep(600 * (i + 1));
    }
  }
  throw last;
}

async function getJson(url, opts = {}) {
  const r = await withRetry(() => axios.get(url, { timeout: 15000, ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) } }));
  return r.data;
}

async function getBuffer(url, opts = {}) {
  const r = await withRetry(() => axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    ...opts,
    headers: { 'User-Agent': 'Mozilla/5.0', ...(opts.headers || {}) },
  }), 2);
  return Buffer.from(r.data);
}

// Errores de red → mensaje claro en español (los demás se dejan tal cual)
function friendlyError(e) {
  const st = e?.response?.status;
  const code = e?.code;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(String(e?.message))) return 'El servicio externo tardó demasiado en responder. Intenta de nuevo en un momento.';
  if (['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ERR_NETWORK'].includes(code)) return 'No pude conectar con el servicio externo (revisa la conexión a internet o prueba más tarde).';
  if (st === 429) return 'El servicio está saturado (demasiadas peticiones). Espera un minuto y vuelve a probar.';
  if (st === 404) return 'No encontré eso en el servicio (404).';
  if (st === 403 || st === 401) return 'El servicio rechazó la petición (' + st + '). Puede requerir clave o estar bloqueado en tu región.';
  if (st >= 500) return `El servicio externo está caído (${st}). Prueba más tarde.`;
  return String(e?.message || e);
}

module.exports = { sleep, pick, rand, strip, isUrl, isPublicUrl, clamp, fmtBytes, fmtTime, chunkText, getJson, getBuffer, withRetry, friendlyError };
