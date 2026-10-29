// ═══════════════════════════════════════════════
//  Memoria de Miku (persistente en database.json):
//  - buffer del grupo: lo último que se ha dicho (para saber de qué hablan)
//  - por persona: afinidad (cuánto se lleva con Miku), datos que contó de sí mismo y la última vez que habló
// ═══════════════════════════════════════════════
const db = require('./db');
const U = require('./utils');

const M = () => (db.data.miku ||= { buf: {}, users: {} });
const BUF_MAX = 40;

const STOP = new Set(('de la que el en y a los se del las un por con no una su para es al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos que unos yo otro otras otra el tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tu te ti tu tus ellas nosotras vosotros vosotras os mio mia mios mias tuyo tuya tuyos tuyas suyo suya suyos suyas nuestro nuestra nuestros nuestras vuestro vuestra vuestros vuestras esos esas estoy estas esta estamos estais estan este fue era soy eres somos son jaja jajaja jajajaja jeje xd bro pana vale bueno ok okay hola buenas dia dias noche tarde gracias favor aqui alli ahi ahora asi pues tipo todavia siempre nunca solo sola vez veces cosa cosas parece quiero puedo puede hacer hace tengo tiene tienes voy vas van ver visto').split(/\s+/));

function push(chatId, name, text) {
  const t = String(text || '').trim();
  if (!t || /^[.!/#]\w/.test(t) || t.length > 600) return;
  const m = M();
  const b = (m.buf[chatId] ||= []);
  b.push({ n: String(name || 'alguien').slice(0, 24), t: t.slice(0, 220), at: Date.now() });
  if (b.length > BUF_MAX) b.splice(0, b.length - BUF_MAX);
}

const recent = (chatId, n = 14) => (M().buf[chatId] || []).slice(-n);

// Palabras más repetidas en lo último que se habló = tema actual
function topic(chatId, n = 25) {
  const msgs = recent(chatId, n).filter((x) => Date.now() - x.at < 3 * 3600 * 1000);
  const freq = new Map();
  for (const x of msgs) {
    for (const w of new Set(U.strip(x.t.toLowerCase()).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !STOP.has(w)))) freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w);
}

function transcript(chatId, n = 14) {
  return recent(chatId, n).map((x) => `${x.n}: ${x.t}`).join('\n');
}

// ── Personas ──
const user = (num) => {
  const u = (M().users[num] ||= { aff: 0, facts: [], seen: 0, n: 0 });
  u.facts ||= [];
  return u;
};
const KIND = /\b(te quiero|te amo|linda|hermosa|bonita|preciosa|guapa|mejor bot|eres genial|gracias|eres lo maximo|cute|tierna|bella|me caes bien)\b/;
const RUDE = /\b(idiota|estupid|imbecil|callate|mierda|basura|inutil|asco|te odio|cierra la boca|apestas|eres mala|que fea)\b/;

// Actualiza afinidad y aprende datos sencillos que la persona cuenta de sí misma
function learn(num, name, text) {
  const u = user(num);
  const t = U.strip(String(text || '').toLowerCase());
  u.n++; u.seen = Date.now();
  if (name) u.name = name;
  if (KIND.test(t)) u.aff = Math.min(20, u.aff + 2);
  else if (RUDE.test(t)) u.aff = Math.max(-10, u.aff - 2);
  else if (u.n % 6 === 0) u.aff = Math.min(20, u.aff + 1); // hablar seguido = confianza
  const add = (s) => { s = s.trim().slice(0, 60); if (s && !u.facts.includes(s)) { u.facts.push(s); if (u.facts.length > 8) u.facts.shift(); } };
  let m;
  if ((m = t.match(/\bme llamo ([a-z]{2,20})/))) add(`se llama ${m[1]}`);
  if ((m = t.match(/\bmi cumple(?:anos)? es (?:el )?([a-z0-9 ]{3,20})/))) add(`su cumple es ${m[1]}`);
  if ((m = t.match(/\b(?:soy de|vivo en) ([a-z ]{3,25})/))) add(`es de ${m[1].trim()}`);
  if ((m = t.match(/\bme gusta(?:n)? (?:mucho )?(?:el |la |los |las )?([a-z0-9 ]{3,30})/))) add(`le gusta ${m[1].trim()}`);
  if ((m = t.match(/\b(?:mi anime favorito es|mi juego favorito es|mi cancion favorita es) ([a-z0-9 ]{2,30})/))) add(`favorito: ${m[1].trim()}`);
  return u;
}

module.exports = { push, recent, topic, transcript, user, learn };
