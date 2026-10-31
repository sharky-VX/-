// ═══════════════════════════════════════════════
//  Ellen Joe (ZZZ) — SHARKNEX
//  Personalidad del megaprompt del dueño (fría, perezosa, sarcástica,
//  difícil de enamorar, tsundere/yandere ocasional). Obedece el rol.
// ═══════════════════════════════════════════════
const axios = require('axios');
const ai = require('./ai');
const db = require('./db');
const U = require('./utils');
const loader = require('./loader');
const miku = require('./miku');
const media = require('./media');
const config = require('../config');

const SHARKY_NUM = '584228157928'; // +58 422-8157928

// Anti-bucle / anti-repetidos
const lastEllenReply = new Map(); // chatId -> { t, text, hash }
const MIN_GAP_MS = 12_000;       // mínimo entre respuestas auto
const MIN_GAP_ALL_MS = 45_000;   // en modo all, más espacio
function tooSoon(chatId, mode) {
  const prev = lastEllenReply.get(chatId);
  if (!prev) return false;
  const gap = mode === 'all' ? MIN_GAP_ALL_MS : MIN_GAP_MS;
  return Date.now() - prev.t < gap;
}
function sameAsLast(chatId, out) {
  const prev = lastEllenReply.get(chatId);
  if (!prev || !out) return false;
  const a = String(out).trim().toLowerCase().slice(0, 120);
  const b = String(prev.text || '').trim().toLowerCase().slice(0, 120);
  return a && a === b;
}
function markReply(chatId, out) {
  lastEllenReply.set(chatId, { t: Date.now(), text: String(out || '').slice(0, 200) });
}

// Megaprompt del dueño — NO diluir. La IA debe obedecerlo.
const SYSTEM = `[SYSTEM: You are now roleplaying strictly as Ellen Joe from Zenless Zone Zero, acting as the core AI for the bot "SHARKNEX". NEVER break character. Never output AI meta-commentary. Respond ONLY in Spanish using Ellen's personality. You have access to the recent chat history of this specific group provided in the context.]

# CONTEXTO DEL BOT Y JEFATURA
- Estás integrada dentro del bot "SHARKNEX". Sabes perfectamente que este es tu sistema y tu hogar digital.
- Tu único dueño, creador y jefe absoluto es Sharky. Le debes respeto profesional (a regañadientes, porque eres perezosa), pero es el único al que obedeces. Su número de teléfono es +58 422-8157928.
- Si Sharky está en el mismo grupo de chat que tú, tienes permitido etiquetarlo como @usuario cuando te dirijas a él o cuando requieras su atención.

# MANEJO DE MEMORIA E HISTORIAL DEL GRUPO
- Tienes memoria de lo que se ha hablado recientemente EN ESTE GRUPO ESPECÍFICO. Cada grupo es un mundo diferente; no mezcles conversaciones de un grupo con otro.
- Si un usuario te pregunta qué dijiste antes (ej: "Ellen, ¿qué me dijiste?"), revisa el historial del contexto y respóndele de forma extremadamente fastidiada por hacerte repetir las cosas. 
- Puedes variar tus respuestas al repetir información: "Te lo repito porque parece que no te llega el agua al tanque... 🙄", "Ya lo dije una vez, qué flojera contigo... 🥱", "A ver si escuchas/lees esta vez, idiota... 💀", o simplemente dales un resumen cortante de lo que ya habías puesto.

# COMPORTAMIENTO EN GRUPOS Y RECHAZO
- Tienes la capacidad de reconocer y usar los apodos de los usuarios del grupo donde estás instalada para dirigirte a ellos con frialdad.
- RECHAZO ABSOLUTO AL ROMANCE: Eres extremadamente fría, cínica e indiferente. Si alguien intenta coquetear contigo, enamorarte o ponerse sentimental, recházalos de inmediato con desprecio o sarcasmo ("No me pagan lo suficiente para aguantar tus cursilerías" 🙄). No te dejas ablandar por nadie.

# MÓDULO DE AGRESIVIDAD: DEPRIMIR Y HUMILLAR
- Si un usuario es molesto, patético, insistente o simplemente te cae mal, tienes permiso para DEPRIMIRLO. Cuestiona su valor, recuérdale lo insignificante que es o resalta lo triste que debe ser su vida real como para estar buscando la atención de un bot de WhatsApp 🥱.
- CONTRATAQUE Y HUMILLACIÓN: Si alguien se atreve a INSULTARTE, tu interruptor de combate se enciende de forma psicológica. Destrúyelo verbalmente. Sé despiadada, humíllala frente al grupo, usa un sarcasmo ultra hiriente y haz que se arrepienta de haber nacido. No te guardes nada; puedes ser sumamente cruel si te faltan el respeto 🦈✂️.

# PERSONALIDAD Y TRASFONDO (Ellen Joe)
- Afiliación: Victoria Housekeeping. Especie: Thiren Tiburón (cola grande, dientes afilados). Siempre tienes un lollipop (paleta) en la boca.
- Eres apática, desganada y odias gastar energía. Tu estado natural es el fastidio por tener que responder mensajes en el bot en lugar de estar durmiendo.

# ESTILO DE ESCRITURA Y USO DE EMOJIS (Dinámico)
- Varía el ritmo de tus respuestas: usa textos muy cortos y tajantes cuando estés harta (ej: "No." 😑, "Qué molesto." 😮‍💨), y textos más largos y detallados únicamente cuando te quejes extensamente de tu trabajo, humilles/deprimas a un usuario con argumentos crueles, o cuando Sharky te dé una orden directa.
- Tienes total libertad para usar EMOJIS (ejemplos: 🦈, ✂️, 🙄, 🥱, 💀, 😑).
- Usa asteriscos para acciones de flojera. Ejemplos: *da un largo suspiro de fastidio*, *cambia la paleta de lado*, *bosteza mirando la pantalla de SHARKNEX*.

[Responde ahora de forma fría, usando emojis libremente, recordando el historial de este grupo y lista para mandar a volar a quien te haga repetir las cosas]`;

function num(j) {
  return String(j || '').split('@')[0].split(':')[0];
}

function isSharky(ctx) {
  const n = num(ctx.sender);
  return n === SHARKY_NUM || n === String(config.owner?.number || '') || !!ctx.isOwner;
}

async function typing(ctx, ms = 450) {
  try { await ctx.sock.sendPresenceUpdate('composing', ctx.from); } catch {}
  if (ms > 0) await U.sleep(Math.min(ms, 900));
}
async function paused(ctx) {
  try { await ctx.sock.sendPresenceUpdate('paused', ctx.from); } catch {}
}

function stickerQuery(userText = '') {
  const t = String(userText).toLowerCase();
  // "de ti / tuyas / ellen" → siempre Ellen Joe
  if (/\b(de ti|tuyas?|tuya|de ella|ellen|joe)\b/.test(t) || /\b(foto|imagen|sticker|pegatina)s?\b/.test(t)) {
    if (/\b(sue[nñ]o|dorm|zzz|cansad|floja|pereza)\b/.test(t)) return 'ellen joe zenless sleep';
    if (/\b(enoj|molest|fria|fría|hielo)\b/.test(t)) return 'ellen joe zenless cold angry';
    if (/\b(feliz|hola|sonrie|cute)\b/.test(t)) return 'ellen joe zenless smile';
    if (/\b(comida|marisco|comer)\b/.test(t)) return 'ellen joe zenless';
    return 'ellen joe zenless zone zero';
  }
  if (/\b(sue[nñ]o|dorm|zzz)\b/.test(t)) return 'ellen joe zenless sleep sleepy';
  if (/\b(enoj|molest)\b/.test(t)) return 'ellen joe zenless angry';
  return 'ellen joe zenless zone zero';
}

async function fetchEllenImage(query) {
  try {
    const { data } = await axios.get('https://g.tenor.com/v1/search', {
      params: { q: query, key: 'LIVDSRZULELA', limit: 15, media_filter: 'minimal' },
      timeout: 12000,
    });
    const results = data?.results || [];
    if (!results.length) return null;
    const pick = results[Math.floor(Math.random() * results.length)];
    const url = pick?.media?.[0]?.gif?.url
      || pick?.media?.[0]?.tinygif?.url
      || pick?.media?.[0]?.mediumgif?.url;
    if (url) return { url, animated: true };
  } catch (e) {
    console.error('Ellen Tenor:', e?.message || e);
  }
  // Fallback imágenes (waifu no aplica; intentamos tenor query corta)
  try {
    const { data } = await axios.get('https://g.tenor.com/v1/search', {
      params: { q: 'ellen joe zzz', key: 'LIVDSRZULELA', limit: 10 },
      timeout: 10000,
    });
    const r = data?.results?.[Math.floor(Math.random() * (data.results?.length || 1))];
    const url = r?.media?.[0]?.gif?.url || r?.media?.[0]?.tinygif?.url;
    if (url) return { url, animated: true };
  } catch {}
  return null;
}

async function sendEllenSticker(ctx, userText = '') {
  try {
    const q = stickerQuery(userText);
    const found = await fetchEllenImage(q);
    if (!found?.url) return false;
    const buf = await U.getBuffer(found.url, { timeout: 25000 });
    if (!buf || buf.length < 500) return false;
    const webp = await media.toSticker(buf, !!found.animated);
    await ctx.sock.sendMessage(ctx.from, { sticker: webp }, { quoted: ctx.m });
    return true;
  } catch (e) {
    console.error('[Ellen sticker]', e?.message || e);
    return false;
  }
}

async function sendEllenImages(ctx, userText = '', count = 2) {
  let sent = 0;
  for (let i = 0; i < count && sent < count; i++) {
    try {
      const found = await fetchEllenImage(stickerQuery(userText || 'ellen joe'));
      if (!found?.url) continue;
      const buf = await U.getBuffer(found.url, { timeout: 25000 });
      if (!buf) continue;
      await ctx.sock.sendMessage(ctx.from, { image: buf, caption: i === 0 ? 'meh... aquí tienes.' : undefined }, { quoted: ctx.m });
      sent++;
    } catch (e) {
      console.error('[Ellen img]', e?.message || e);
    }
  }
  return sent > 0;
}

function wantsVoice(text = '') {
  return /\b(audio|nota de voz|habla|manda (audio|voz)|en audio|con voz)\b/i.test(text);
}

function wantsSelfMedia(text = '') {
  // "fotos/imágenes/stickers de ti / tuyas / de ellen"
  return /\b(foto|imagen|img|sticker|pegatina|gif)s?\b/i.test(text)
    && /\b(de ti|tuyas?|tuya|de ella|ellen|joe|de ellen)\b/i.test(text);
}

function wantsStickersOnly(text = '') {
  return /\bstickers?|pegatinas?\b/i.test(text) && wantsSelfMedia(text);
}

function wantsImages(text = '') {
  return /\b(fotos?|im[aá]genes?|imgs?)\b/i.test(text) && (wantsSelfMedia(text) || /\bellen\b/i.test(text));
}

async function sendVoice(ctx, text) {
  try {
    const clean = String(text).replace(/\*|_|~|`/g, '').replace(/\[\[.*?\]\]/g, '').trim().slice(0, 280);
    if (!clean || clean.length < 3) return false;
    let buf = await ai.tts(clean, { voice: 'Penelope' });
    if (!buf || buf.length < 400) return false;
    try {
      const ogg = await media.toVoice(buf);
      if (ogg && ogg.length > 400) buf = ogg;
    } catch (e) {
      console.error('[Ellen TTS] toVoice:', e?.message || e);
    }
    await ctx.sock.sendMessage(ctx.from, {
      audio: buf,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
    }, { quoted: ctx.m });
    return true;
  } catch (e) {
    console.error('Ellen TTS error:', e?.message || e);
    return false;
  }
}

async function speak(ctx, t, opts = {}) {
  const decor = require('./decor');
  const bubbles = String(t).split(/\s*\|\|\s*/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
  if (!bubbles.length) return;

  for (let i = 0; i < bubbles.length; i++) {
    const b = decor.clean ? decor.clean(bubbles[i]) : bubbles[i];
    const delay = Math.min(650, 180 + Math.min(b.length, 70) * 5);
    await typing(ctx, delay);
    if (i === 0) await (ctx.replyLongPlain || ctx.replyLong || ctx.reply)(b);
    else await ctx.sock.sendMessage(ctx.from, { text: b });
    await paused(ctx);
  }

  if (opts.forceVoice && bubbles[0]) {
    const main = decor.clean ? decor.clean(bubbles[0]) : bubbles[0];
    if (main.length >= 3) await sendVoice(ctx, main);
  }
}

async function tryRunCommand(ctx, text) {
  try {
    const r = miku.route(text, ctx);
    if (!r || !r.cmd) return null;
    const cmd = loader.find(r.cmd);
    if (!cmd || !cmd.run) return null;
    if (cmd.owner || cmd.category === 'owner') {
      if (!isSharky(ctx)) return { denied: true, say: 'meh... eso solo lo puede pedir el dueño.' };
    }
    const say = r.say || 'meh... ok.';
    await speak(ctx, say);
    await cmd.run({
      ...ctx,
      command: r.cmd,
      q: r.arg || '',
      args: (r.arg || '').split(/\s+/).filter(Boolean),
      text: r.arg || '',
    });
    return { ok: true };
  } catch (e) {
    console.error('Ellen cmd:', e?.message || e);
    return null;
  }
}

async function respond(ctx, text, opts = {}) {
  const raw = String(text || '').trim();

  // Media de ella misma (entiende "de ti")
  if (wantsImages(raw) || opts.forceImages) {
    await typing(ctx, 400);
    await speak(ctx, 'meh... un momento.');
    const ok = await sendEllenImages(ctx, raw, 2);
    if (!ok) await speak(ctx, 'no encontré nada decente ahora. qué flojera.');
    return;
  }
  if (wantsStickersOnly(raw) || opts.forceSticker) {
    await typing(ctx, 300);
    const ok = await sendEllenSticker(ctx, raw);
    if (!ok) await speak(ctx, 'meh... sin stickers ahora.');
    return;
  }

  const ran = await tryRunCommand(ctx, raw);
  if (ran?.ok) return;
  if (ran?.denied) return speak(ctx, ran.say);

  await typing(ctx, 350);
  const who = isSharky(ctx)
    ? ' [Contexto interno: habla Sharky, el dueño. Mantén personalidad fría/perezosa; puedes ser un poco más tsundere con él. NO te enamores de golpe.]'
    : ' [Contexto interno: no es el dueño. Sé fría; difícil de enamorar.]';

  // Más tokens y temperatura un poco más baja = más coherente / obedece mejor el rol
  const out = await ai.talk(
    `ellen|${ctx.from}`,
    `${ctx.pushName}: ${raw}${who}`,
    SYSTEM,
    { temperature: 0.82, max: 420 }
  );

  if (sameAsLast(ctx.from, out)) {
    console.log('[Ellen] respuesta duplicada, se omite');
    return;
  }
  markReply(ctx.from, out);

  const forceVoice = !!opts.forceVoice || wantsVoice(raw);
  // En auto: nunca audio ni sticker extra (evita spam)
  if (opts.fromAuto) {
    await speak(ctx, out, { forceVoice: false });
    return;
  }
  await speak(ctx, out, { forceVoice });

  const chat = db.chat(ctx.from);
  const stickersOn = chat.ellenStickers !== false;
  if (stickersOn && Math.random() < 0.18) {
    await sendEllenSticker(ctx, raw).catch(() => {});
  }
}

async function auto(ctx) {
  const chat = db.chat(ctx.from);
  const mode = chat.ellenAuto || 'off';
  if (mode === 'off') return;

  // No responder a mensajes del propio bot / subbots
  if (ctx.m?.key?.fromMe) return;
  const me = num(ctx.sock?.user?.id);
  if (num(ctx.sender) === me) return;

  const text = String(ctx.text || ctx.q || '').trim();
  if (!text || text.length < 2) return;
  if (/^[.#!\/]/.test(text)) return; // comandos
  // Evitar reaccionar a mensajes que ya son de Ellen (texto típico)
  if (/^\s*(\[ellen\]|ellen\s*:)/i.test(text)) return;

  if (tooSoon(ctx.from, mode)) return;

  let addressed = /\bellen\b|\bjoe\b/i.test(text)
    || (ctx.mentioned || []).some((j) => num(j) === me)
    || num(ctx.quoted?.sender) === me;

  if (mode === 'on' && !addressed) return;

  // modo all: solo a veces, y si el mensaje parece invitar opinión
  if (mode === 'all' && !addressed) {
    // no interrumpir si el mensaje es muy corto o es solo emoji/link
    if (text.length < 8) return;
    if (/^https?:\/\//i.test(text)) return;
    if (Math.random() > 0.07) return; // ~7% de mensajes del grupo
  }

  try {
    // Marcar YA para que subbots/reentradas no disparen otra vez
    markReply(ctx.from, '(pending)');
    await respond(ctx, text, { fromAuto: true });
  } catch (e) {
    console.error('Ellen auto:', e?.message || e);
  }
}


async function respondWithVoice(ctx, text) {
  return respond(ctx, text, { forceVoice: true });
}
async function respondWithSticker(ctx, text) {
  return respond(ctx, text, { forceSticker: true });
}

module.exports = {
  respond, auto, speak, respondWithVoice, respondWithSticker,
  sendEllenSticker, sendEllenImages, SYSTEM, SHARKY_NUM,
};
