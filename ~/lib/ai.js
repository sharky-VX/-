const axios = require('axios');
const config = require('../config');
const U = require('./utils');

// ═══════════════════════════════════════════════
//  Motor de IA. Orden de intentos:
//   1) Tu API key (config.ai.key) — cualquier servicio compatible con OpenAI
//   2) Pollinations (gratis, sin key, puede fallar)
// ═══════════════════════════════════════════════
const memory = new Map(); // memoria de conversación por chat

const first = (d) => d?.choices?.[0]?.message?.content;

async function withKey(messages, o) {
  const { key, baseUrl, model } = config.ai;
  const r = await axios.post(
    baseUrl.replace(/\/$/, '') + '/chat/completions',
    { model, messages, temperature: o.temperature ?? 0.7, max_tokens: o.max ?? 1200 },
    { headers: { Authorization: 'Bearer ' + key }, timeout: 30000 }
  );
  return first(r.data);
}

async function pollinationsPost(messages, o = {}) {
  const r = await axios.post(
    'https://text.pollinations.ai/openai',
    { model: o.model || 'openai', messages, private: true, max_tokens: o.max ?? 700 },
    { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
  );
  return first(r.data);
}

async function pollinationsGet(messages, o = {}) {
  const sys = messages.find((m) => m.role === 'system')?.content || '';
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const r = await axios.get('https://text.pollinations.ai/' + encodeURIComponent(last.slice(0, 1500)), {
    params: { system: sys.slice(0, 700), model: o.model || 'openai', private: 'true' },
    timeout: 30000,
    responseType: 'text',
    transformResponse: (x) => x,
  });
  const t = typeof r.data === 'string' ? r.data : '';
  return /^\s*\{\s*"error"/.test(t) ? null : t;
}

// Orden: tu clave (si la hay) → después los servicios gratis A LA VEZ (gana el que responda primero)
async function chat(messages, o = {}) {
  const errs = [];
  const run = async (name, fn) => {
    try {
      const t = await fn(messages, o);
      if (t && String(t).trim()) return String(t).trim();
      throw new Error('vacío');
    } catch (e) {
      errs.push(`${name}: ${e.response?.status || e.code || e.message}`);
      throw e;
    }
  };
  if (config.ai.key) {
    try { return await run('tu API key', withKey); } catch { /* sigue con los gratis */ }
  }
  const race = [run('pollinations', pollinationsPost), run('pollinations-get', pollinationsGet)];
  try { return await Promise.any(race); } catch { /* ambos fallaron */ }
  if (o.model && o.model !== 'openai') {
    try { return await run('pollinations-default', (m, oo) => pollinationsPost(m, { ...oo, model: 'openai' })); } catch { /* nada */ }
  }
  throw new Error(`La IA no respondió (${errs.join(' | ') || 'sin respuesta'}). Pon una API key gratis en config.js → ai.key (Groq o Gemini).`);
}

// Pregunta suelta con un "system prompt" propio
const ask = (prompt, system = config.ai.system, o = {}) =>
  chat([{ role: 'system', content: system }, { role: 'user', content: String(prompt).slice(0, 6000) }], o);

// Conversación con memoria (por chat)
async function talk(chatId, text, system = config.ai.system, o = {}) {
  const hist = memory.get(chatId) || [];
  hist.push({ role: 'user', content: String(text).slice(0, 4000) });
  const out = await chat([{ role: 'system', content: system }, ...hist], o);
  hist.push({ role: 'assistant', content: out });
  while (hist.length > config.ai.memoryTurns * 2) hist.shift();
  memory.set(chatId, hist);
  return out;
}
const reset = (chatId) => { for (const k of [...memory.keys()]) if (k === chatId || k.endsWith('|' + chatId)) memory.delete(k); };

// Imágenes con IA (Pollinations, sin key)
async function image(prompt, { width = 1024, height = 1024, model = 'flux' } = {}) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(String(prompt).slice(0, 800))}?width=${width}&height=${height}&nologo=true&model=${model}&seed=${U.rand(1, 999999)}`;
  const buf = await U.getBuffer(url, { timeout: 120000 });
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf[0] === 0x89 && buf[1] === 0x50;
  if (!jpg && !png) throw new Error('El generador de imágenes no devolvió una imagen. Intenta de nuevo en un minuto.');
  return buf;
}

// ── TTS: voz de Miku (nota de voz en español) ──
// Usa VoiceRSS (gratis, sin key para uso básico) o ElevenLabs si hay key
async function tts(text, opts = {}) {
  const clean = String(text).replace(/\*|_|~|`/g, '').replace(/\[\[.*?\]\]/g, '').slice(0, 300);

  // 1) ElevenLabs con key (mejor calidad)
  if (config.tts?.elevenlabsKey) {
    try {
      const voiceId = config.tts.elevenlabsVoiceId || 'pNInz6obpgDQGcFmaJgB'; // voz femenina
      const r = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        { text: clean, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
        { headers: { 'xi-api-key': config.tts.elevenlabsKey, 'Content-Type': 'application/json' }, responseType: 'arraybuffer', timeout: 30000 }
      );
      return Buffer.from(r.data);
    } catch (e) { console.error('ElevenLabs TTS:', e?.message); }
  }

  // 2) StreamElements TTS (gratis, sin key, muy confiable)
  try {
    const voice = config.tts?.streamElementsVoice || 'es-ES-Standard-A';
    const r = await axios.get(
      `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(clean)}`,
      { responseType: 'arraybuffer', timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const buf = Buffer.from(r.data);
    if (buf.length > 500) return buf;
  } catch (e) { console.error('StreamElements TTS:', e?.message); }

  // 3) VoiceRSS con key del config (si pusiste una key propia)
  if (config.tts?.voicerssKey) {
    try {
      const r = await axios.get('https://api.voicerss.org/', {
        params: { key: config.tts.voicerssKey, hl: 'es-mx', src: clean, c: 'OGG', f: '16khz_16bit_stereo', ssml: 'false', b64: 'false', v: 'Penelope' },
        responseType: 'arraybuffer',
        timeout: 20000,
      });
      const buf = Buffer.from(r.data);
      if (buf.length > 200 && buf.slice(0, 5).toString() !== 'ERROR') return buf;
    } catch (e) { console.error('VoiceRSS TTS:', e?.message); }
  }

  // 4) gTTS vía Google (último fallback)
  try {
    const encoded = encodeURIComponent(clean);
    const r = await axios.get(
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=es&total=1&idx=0&textlen=${clean.length}&client=tw-ob`,
      { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    );
    const buf = Buffer.from(r.data);
    if (buf.length > 500) return buf;
  } catch (e) { console.error('gTTS fallback:', e?.message); }

  return null;
}

module.exports = { chat, ask, talk, reset, image, tts };
